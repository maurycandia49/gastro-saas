from django.db.models import Q
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from categorias.models import Categoria
from inventory.models import Ingredient
from pedidos.customers import get_customers_for_business
from pedidos.models import Pedido
from productos.models import Producto
from promociones.models import Promocion
from .models import Negocio


EMPTY_RESULTS = {
    'products': [],
    'categories': [],
    'orders': [],
    'customers': [],
    'promotions': [],
    'inventory': [],
    'costing': [],
}


class GlobalSearchView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    limit = 5

    def get_business(self, request):
        business_id = request.query_params.get('business_id')
        if not business_id:
            return None
        return Negocio.objects.filter(pk=business_id, user=request.user).first()

    def get(self, request):
        business = self.get_business(request)
        if not business:
            return Response({'detail': 'Negocio no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        query = (request.query_params.get('q') or '').strip()
        if len(query) < 2:
            return Response(EMPTY_RESULTS)

        products = Producto.objects.filter(
            negocio=business,
        ).filter(Q(name__icontains=query) | Q(description__icontains=query)).select_related('categoria').order_by('name')[:self.limit]

        categories = Categoria.objects.filter(
            negocio=business,
        ).filter(Q(name__icontains=query) | Q(description__icontains=query)).order_by('order', 'name')[:self.limit]

        order_filter = Q(customer_name__icontains=query) | Q(customer_phone__icontains=query)
        if query.isdigit():
            order_filter |= Q(id=int(query))
        orders = Pedido.objects.filter(negocio=business).filter(order_filter).order_by('-created_at')[:self.limit]

        customers = [
            customer for customer in get_customers_for_business(business)
            if query.lower() in customer['name'].lower() or query in customer['phone']
        ][:self.limit]

        promotions = Promocion.objects.filter(
            negocio=business,
        ).filter(Q(name__icontains=query) | Q(description__icontains=query)).order_by('-created_at')[:self.limit]

        inventory = Ingredient.objects.filter(
            negocio=business,
        ).filter(
            Q(name__icontains=query) |
            Q(sku__icontains=query) |
            Q(barcode__icontains=query) |
            Q(supplier__icontains=query)
        ).order_by('name')[:self.limit]

        costing = Producto.objects.filter(
            negocio=business,
        ).filter(name__icontains=query).order_by('name')[:self.limit]

        return Response({
            'products': [
                {
                    'id': product.id,
                    'title': product.name,
                    'subtitle': product.categoria.name if product.categoria_id else 'Producto',
                    'url': f'/productos?highlight={product.id}',
                }
                for product in products
            ],
            'categories': [
                {
                    'id': category.id,
                    'title': category.name,
                    'subtitle': category.description or 'Categoria del menu',
                    'url': f'/categorias?highlight={category.id}',
                }
                for category in categories
            ],
            'orders': [
                {
                    'id': order.id,
                    'title': f'Pedido #{order.id}',
                    'subtitle': f'{order.customer_name} · {order.customer_phone or "sin telefono"}',
                    'url': f'/pedidos?order={order.id}',
                }
                for order in orders
            ],
            'customers': [
                {
                    'id': customer['phone'],
                    'title': customer['name'],
                    'subtitle': f'{customer["phone"]} · {customer["orders_count"]} pedidos',
                    'url': f'/clientes?phone={customer["phone"]}',
                }
                for customer in customers
            ],
            'promotions': [
                {
                    'id': promotion.id,
                    'title': promotion.name,
                    'subtitle': promotion.description or 'Promocion',
                    'url': f'/promociones?highlight={promotion.id}',
                }
                for promotion in promotions
            ],
            'inventory': [
                {
                    'id': ingredient.id,
                    'title': ingredient.name,
                    'subtitle': ingredient.sku or ingredient.supplier or f'Stock: {ingredient.current_stock} {ingredient.unit}',
                    'url': f'/inventario?highlight={ingredient.id}',
                }
                for ingredient in inventory
            ],
            'costing': [
                {
                    'id': product.id,
                    'title': product.name,
                    'subtitle': 'Analisis de costos y margenes',
                    'url': f'/costos?product={product.id}',
                }
                for product in costing
            ],
        })

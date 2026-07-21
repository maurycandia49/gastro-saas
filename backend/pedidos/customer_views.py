from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .customers import get_business_for_user, get_customer_detail, get_customers_for_business


class CustomerListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        business = get_business_for_user(request.user, request.query_params.get('business_id'))
        if not business:
            return Response({'detail': 'Negocio no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(get_customers_for_business(business))


class CustomerDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, phone):
        business = get_business_for_user(request.user, request.query_params.get('business_id'))
        if not business:
            return Response({'detail': 'Negocio no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        detail = get_customer_detail(business, phone)
        if not detail:
            return Response({'detail': 'Cliente no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(detail)

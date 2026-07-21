from rest_framework import serializers

from categorias.models import Categoria
from productos.models import Producto
from promociones.pricing import get_effective_price
from recetas.services import calculate_available_units
from .models import BusinessSchedule, ConfiguracionNegocio, Negocio
from .operations import ensure_business_settings, get_business_open_status


class NegocioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Negocio
        fields = [
            'id',
            'name',
            'description',
            'phone',
            'email',
            'address',
            'logo',
            'cover_image',
            'primary_color',
            'opening_hours',
            'instagram',
            'facebook',
            'active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ConfiguracionNegocioSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConfiguracionNegocio
        exclude = ['created_at', 'updated_at']
        read_only_fields = ['id', 'negocio']


class BusinessScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusinessSchedule
        fields = ['id', 'weekday', 'is_closed', 'opening_time', 'closing_time']
        read_only_fields = ['id']


class PublicProductoSerializer(serializers.ModelSerializer):
    original_price = serializers.SerializerMethodField()
    final_price = serializers.SerializerMethodField()
    has_promotion = serializers.SerializerMethodField()
    promotion_name = serializers.SerializerMethodField()
    promotion_featured = serializers.SerializerMethodField()
    discount_percentage = serializers.SerializerMethodField()
    out_of_operational_stock = serializers.SerializerMethodField()

    class Meta:
        model = Producto
        fields = ['id', 'categoria', 'name', 'description', 'price', 'original_price', 'final_price', 'has_promotion', 'promotion_name', 'promotion_featured', 'discount_percentage', 'out_of_operational_stock', 'image', 'available', 'order']

    def _price_info(self, obj):
        cache = getattr(obj, '_promotion_price_info', None)
        if cache is None:
            cache = get_effective_price(obj)
            obj._promotion_price_info = cache
        return cache

    def get_original_price(self, obj):
        return self._price_info(obj)['original_price']

    def get_final_price(self, obj):
        return self._price_info(obj)['final_price']

    def get_has_promotion(self, obj):
        return self._price_info(obj)['promotion_id'] is not None

    def get_promotion_name(self, obj):
        return self._price_info(obj)['promotion_name']

    def get_promotion_featured(self, obj):
        return self._price_info(obj)['promotion_featured']

    def get_discount_percentage(self, obj):
        return self._price_info(obj)['discount_percentage']

    def get_out_of_operational_stock(self, obj):
        settings = getattr(obj.negocio, 'settings', None)
        if not settings or not settings.prevent_sales_without_stock:
            return False
        availability = calculate_available_units(obj)
        return availability['available_units'] == 0


class PublicCategoriaSerializer(serializers.ModelSerializer):
    productos = PublicProductoSerializer(many=True, read_only=True)

    class Meta:
        model = Categoria
        fields = ['id', 'name', 'description', 'order', 'productos']


class PublicMenuSerializer(serializers.ModelSerializer):
    categorias = PublicCategoriaSerializer(many=True, read_only=True)
    is_open = serializers.SerializerMethodField()
    accepts_orders = serializers.SerializerMethodField()
    opening_status_message = serializers.SerializerMethodField()
    delivery_enabled = serializers.SerializerMethodField()
    pickup_enabled = serializers.SerializerMethodField()
    minimum_order = serializers.SerializerMethodField()
    delivery_fee = serializers.SerializerMethodField()
    free_delivery_from = serializers.SerializerMethodField()
    estimated_delivery_minutes = serializers.SerializerMethodField()
    estimated_pickup_minutes = serializers.SerializerMethodField()
    require_customer_phone = serializers.SerializerMethodField()
    require_delivery_address = serializers.SerializerMethodField()

    class Meta:
        model = Negocio
        fields = [
            'id',
            'name',
            'description',
            'phone',
            'email',
            'address',
            'logo',
            'cover_image',
            'primary_color',
            'opening_hours',
            'instagram',
            'facebook',
            'is_open',
            'accepts_orders',
            'opening_status_message',
            'delivery_enabled',
            'pickup_enabled',
            'minimum_order',
            'delivery_fee',
            'free_delivery_from',
            'estimated_delivery_minutes',
            'estimated_pickup_minutes',
            'require_customer_phone',
            'require_delivery_address',
            'categorias',
        ]

    def _settings(self, obj):
        return ensure_business_settings(obj)

    def _status(self, obj):
        cache = getattr(obj, '_open_status', None)
        if cache is None:
            cache = get_business_open_status(obj)
            obj._open_status = cache
        return cache

    def get_is_open(self, obj): return self._status(obj)['is_open']
    def get_accepts_orders(self, obj): return self._status(obj)['accepts_orders']
    def get_opening_status_message(self, obj): return self._status(obj)['message']
    def get_delivery_enabled(self, obj): return self._settings(obj).delivery_enabled
    def get_pickup_enabled(self, obj): return self._settings(obj).pickup_enabled
    def get_minimum_order(self, obj): return self._settings(obj).minimum_order
    def get_delivery_fee(self, obj): return self._settings(obj).delivery_fee
    def get_free_delivery_from(self, obj): return self._settings(obj).free_delivery_from
    def get_estimated_delivery_minutes(self, obj): return self._settings(obj).estimated_delivery_minutes
    def get_estimated_pickup_minutes(self, obj): return self._settings(obj).estimated_pickup_minutes
    def get_require_customer_phone(self, obj): return self._settings(obj).require_customer_phone
    def get_require_delivery_address(self, obj): return self._settings(obj).require_delivery_address

from django.conf import settings
from django.db import models


class Negocio(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='negocios',
        on_delete=models.CASCADE,
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    email = models.EmailField()
    address = models.CharField(max_length=512, blank=True)
    logo = models.ImageField(upload_to='logos/', blank=True, null=True)
    cover_image = models.ImageField(upload_to='covers/', blank=True, null=True)
    primary_color = models.CharField(max_length=7, default='#0f172a')
    opening_hours = models.TextField(blank=True)
    instagram = models.URLField(blank=True)
    facebook = models.URLField(blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class ConfiguracionNegocio(models.Model):
    negocio = models.OneToOneField(Negocio, related_name='settings', on_delete=models.CASCADE)
    currency = models.CharField(max_length=3, default='ARS')
    timezone = models.CharField(max_length=64, default='America/Argentina/Buenos_Aires')
    orders_enabled = models.BooleanField(default=True)
    delivery_enabled = models.BooleanField(default=True)
    pickup_enabled = models.BooleanField(default=True)
    minimum_order = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    delivery_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    free_delivery_from = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    estimated_delivery_minutes = models.PositiveIntegerField(blank=True, null=True)
    estimated_pickup_minutes = models.PositiveIntegerField(blank=True, null=True)
    whatsapp_number = models.CharField(max_length=50, blank=True)
    whatsapp_message_template = models.TextField(blank=True)
    require_customer_phone = models.BooleanField(default=False)
    require_delivery_address = models.BooleanField(default=True)
    show_out_of_stock_products = models.BooleanField(default=True)
    accept_orders_when_closed = models.BooleanField(default=False)
    automatic_order_acceptance = models.BooleanField(default=False)
    prevent_sales_without_stock = models.BooleanField(default=False)
    target_margin_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=35)
    low_margin_threshold = models.DecimalField(max_digits=5, decimal_places=2, default=20)
    cost_increase_alert_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=10)
    dead_product_days = models.PositiveIntegerField(default=14)
    inactive_customer_days = models.PositiveIntegerField(default=21)
    daily_sales_target = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    monthly_sales_target = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Configuracion {self.negocio}'


class BusinessSchedule(models.Model):
    negocio = models.ForeignKey(Negocio, related_name='schedules', on_delete=models.CASCADE)
    weekday = models.PositiveSmallIntegerField()
    is_closed = models.BooleanField(default=False)
    opening_time = models.TimeField(blank=True, null=True)
    closing_time = models.TimeField(blank=True, null=True)

    class Meta:
        ordering = ['weekday']
        constraints = [
            models.UniqueConstraint(fields=['negocio', 'weekday'], name='unique_business_weekday'),
        ]

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.weekday > 6:
            raise ValidationError({'weekday': 'El dia debe estar entre 0 y 6.'})
        if not self.is_closed:
            if not self.opening_time or not self.closing_time:
                raise ValidationError('Debes indicar apertura y cierre.')
            if self.opening_time >= self.closing_time:
                raise ValidationError({'closing_time': 'El cierre debe ser posterior a la apertura.'})

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

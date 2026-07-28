from django.conf import settings
from django.db import models

from inventory.models import Ingredient
from negocios.models import Negocio


class Supplier(models.Model):
    negocio = models.ForeignKey(Negocio, related_name='suppliers', on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    tax_id = models.CharField(max_length=80, blank=True)
    contact_name = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=80, blank=True)
    email = models.EmailField(blank=True)
    address = models.CharField(max_length=512, blank=True)
    notes = models.TextField(blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(fields=['negocio', 'name'], name='unique_supplier_name_per_business'),
        ]

    def __str__(self):
        return self.name


class Purchase(models.Model):
    STATUS_DRAFT = 'draft'
    STATUS_CONFIRMED = 'confirmed'
    STATUS_CANCELLED = 'cancelled'
    STATUS_CHOICES = [
        (STATUS_DRAFT, 'Draft'),
        (STATUS_CONFIRMED, 'Confirmed'),
        (STATUS_CANCELLED, 'Cancelled'),
    ]
    DOC_INVOICE = 'invoice'
    DOC_RECEIPT = 'receipt'
    DOC_DELIVERY_NOTE = 'delivery_note'
    DOC_OTHER = 'other'
    DOCUMENT_CHOICES = [
        (DOC_INVOICE, 'Invoice'),
        (DOC_RECEIPT, 'Receipt'),
        (DOC_DELIVERY_NOTE, 'Delivery note'),
        (DOC_OTHER, 'Other'),
    ]

    negocio = models.ForeignKey(Negocio, related_name='purchases', on_delete=models.CASCADE)
    supplier = models.ForeignKey(Supplier, related_name='purchases', on_delete=models.SET_NULL, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    document_type = models.CharField(max_length=30, choices=DOCUMENT_CHOICES, default=DOC_INVOICE)
    document_number = models.CharField(max_length=120, blank=True)
    purchase_date = models.DateField()
    notes = models.TextField(blank=True)
    document_image = models.ImageField(upload_to='purchase_documents/', blank=True, null=True)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    taxes = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discounts = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    confirmed_at = models.DateTimeField(blank=True, null=True)
    confirmed_by = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='confirmed_purchases', on_delete=models.SET_NULL, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-purchase_date', '-created_at']


class PurchaseItem(models.Model):
    PACKAGE_BAG = 'bag'
    PACKAGE_BOX = 'box'
    PACKAGE_PACK = 'pack'
    PACKAGE_BOTTLE = 'bottle'
    PACKAGE_CAN = 'can'
    PACKAGE_SACK = 'sack'
    PACKAGE_UNIT = 'unit'
    PACKAGE_OTHER = 'other'
    PACKAGE_CHOICES = [
        (PACKAGE_BAG, 'Bag'),
        (PACKAGE_BOX, 'Box'),
        (PACKAGE_PACK, 'Pack'),
        (PACKAGE_BOTTLE, 'Bottle'),
        (PACKAGE_CAN, 'Can'),
        (PACKAGE_SACK, 'Sack'),
        (PACKAGE_UNIT, 'Unit'),
        (PACKAGE_OTHER, 'Other'),
    ]

    purchase = models.ForeignKey(Purchase, related_name='items', on_delete=models.CASCADE)
    ingredient = models.ForeignKey(Ingredient, related_name='purchase_items', on_delete=models.PROTECT)
    description_snapshot = models.CharField(max_length=255)
    package_quantity = models.DecimalField(max_digits=12, decimal_places=3, blank=True, null=True)
    package_type = models.CharField(max_length=20, choices=PACKAGE_CHOICES, default=PACKAGE_UNIT)
    content_per_package = models.DecimalField(max_digits=12, decimal_places=3, blank=True, null=True)
    content_unit = models.CharField(max_length=20, choices=Ingredient.UNIT_CHOICES, blank=True)
    total_content_in_stock_unit = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    total_price = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    unit_cost_in_stock_unit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    unit = models.CharField(max_length=20, choices=Ingredient.UNIT_CHOICES)
    quantity_in_stock_unit = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    previous_purchase_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    new_purchase_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['id']

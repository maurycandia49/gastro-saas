from django.db import models
from django.utils import timezone

from negocios.models import Negocio


class BusinessOpportunity(models.Model):
    TYPE_CHOICES = [
        ('low_stock', 'Low stock'),
        ('stockout_risk', 'Stockout risk'),
        ('low_margin', 'Low margin'),
        ('negative_profit', 'Negative profit'),
        ('incomplete_recipe', 'Incomplete recipe'),
        ('missing_cost', 'Missing cost'),
        ('inactive_customer', 'Inactive customer'),
        ('sales_growth', 'Sales growth'),
        ('sales_drop', 'Sales drop'),
        ('dead_product', 'Dead product'),
        ('top_product', 'Top product'),
        ('promotion_expiring', 'Promotion expiring'),
        ('promotion_performance', 'Promotion performance'),
        ('pending_orders', 'Pending orders'),
        ('preparation_delay', 'Preparation delay'),
        ('business_victory', 'Business victory'),
    ]
    CATEGORY_CHOICES = [
        ('stock', 'Stock'),
        ('profitability', 'Profitability'),
        ('sales', 'Sales'),
        ('customers', 'Customers'),
        ('promotions', 'Promotions'),
        ('operations', 'Operations'),
        ('achievement', 'Achievement'),
    ]
    SEVERITY_CHOICES = [
        ('info', 'Info'),
        ('success', 'Success'),
        ('warning', 'Warning'),
        ('critical', 'Critical'),
    ]

    negocio = models.ForeignKey(Negocio, related_name='opportunities', on_delete=models.CASCADE)
    opportunity_type = models.CharField(max_length=40, choices=TYPE_CHOICES)
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    title = models.CharField(max_length=255)
    message = models.TextField()
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES)
    priority = models.IntegerField(default=0)
    score_impact = models.IntegerField(default=0)
    action_label = models.CharField(max_length=120, blank=True)
    action_url = models.CharField(max_length=255, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    fingerprint = models.CharField(max_length=255)
    active = models.BooleanField(default=True)
    read = models.BooleanField(default=False)
    dismissed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ['-priority', 'severity', '-created_at']
        constraints = [
            models.UniqueConstraint(fields=['negocio', 'fingerprint'], name='unique_business_opportunity_fingerprint'),
        ]

    def resolve(self):
        self.active = False
        self.resolved_at = timezone.now()
        self.save(update_fields=['active', 'resolved_at', 'updated_at'])

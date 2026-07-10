from django.conf import settings
from django.db import models


class Negocio(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='negocios',
        on_delete=models.CASCADE,
    )
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=50, blank=True)
    email = models.EmailField()
    address = models.CharField(max_length=512, blank=True)
    logo = models.ImageField(upload_to='logos/', blank=True, null=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name

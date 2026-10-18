from django.contrib import admin
from clients.models import Client


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ("name", "contact_name", "contact_email", "is_archived", "created_at")
    list_filter = ("is_archived", "created_at")
    search_fields = ("name", "contact_name", "contact_email")
    ordering = ("name",)

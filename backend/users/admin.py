from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _
from users.models import User


@admin.register(User)
class CustomUserAdmin(BaseUserAdmin):
    """
    Admin layout for the custom User model.
    Organizes fields around email-based authentication and role-based access.
    """

    ordering = ["email"]
    list_display = [
        "email",
        "first_name",
        "last_name",
        "role",
        "default_hourly_cost_rate",
        "is_active",
        "is_staff",
    ]
    list_filter = ["role", "is_active", "is_staff"]
    search_fields = ["email", "first_name", "last_name"]

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (
            _("Personal info"),
            {"fields": ("first_name", "last_name")},
        ),
        (
            _("Roles & Financial Rates"),
            {"fields": ("role", "default_hourly_cost_rate")},
        ),
        (
            _("Permissions"),
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        (
            _("Important dates"),
            {"fields": ("last_login", "created_at", "updated_at")},
        ),
    )
    readonly_fields = ["created_at", "updated_at"]

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "email",
                    "first_name",
                    "last_name",
                    "role",
                    "default_hourly_cost_rate",
                    "password1",
                    "password2",
                    "is_staff",
                    "is_active",
                ),
            },
        ),
    )

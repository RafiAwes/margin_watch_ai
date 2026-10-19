from django.contrib import admin
from expenses.models import Expense


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = (
        "project",
        "user",
        "category",
        "amount",
        "expense_date",
        "status",
        "reviewed_by",
        "reviewed_at",
        "created_at",
    )
    list_filter = ("status", "category", "project", "expense_date")
    search_fields = (
        "project__name",
        "user__email",
        "user__first_name",
        "user__last_name",
        "description",
        "review_note",
    )
    readonly_fields = ("reviewed_by", "reviewed_at", "created_at", "updated_at")
    date_hierarchy = "expense_date"

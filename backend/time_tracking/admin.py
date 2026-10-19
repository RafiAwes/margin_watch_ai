from django.contrib import admin
from time_tracking.models import TimeEntry


@admin.register(TimeEntry)
class TimeEntryAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "project",
        "work_date",
        "recorded_hours",
        "hourly_cost_snapshot",
        "computed_cost",
        "created_at",
    )
    list_filter = ("project", "work_date", "user")
    search_fields = ("user__email", "user__first_name", "user__last_name", "project__name", "description")
    readonly_fields = ("hourly_cost_snapshot", "computed_cost", "created_at", "updated_at")
    date_hierarchy = "work_date"

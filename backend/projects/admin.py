from django.contrib import admin
from projects.models import Project, ProjectAssignment


class ProjectAssignmentInline(admin.TabularInline):
    model = ProjectAssignment
    extra = 1
    fields = ("user", "is_active", "assigned_at")
    readonly_fields = ("assigned_at",)


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "client",
        "status",
        "contract_revenue",
        "planned_cost_budget",
        "currency",
        "is_archived",
        "created_at",
    )
    list_filter = ("status", "is_archived", "currency", "client")
    search_fields = ("name", "client__name", "description")
    inlines = [ProjectAssignmentInline]


@admin.register(ProjectAssignment)
class ProjectAssignmentAdmin(admin.ModelAdmin):
    list_display = ("project", "user", "is_active", "assigned_at", "assigned_by")
    list_filter = ("is_active", "project", "assigned_at")
    search_fields = ("project__name", "user__email", "user__first_name", "user__last_name")

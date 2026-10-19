from datetime import timedelta
from decimal import Decimal
from rest_framework import serializers
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from users.models import UserRole
from projects.models import Project, ProjectAssignment
from time_tracking.models import TimeEntry


class TimeEntrySerializer(serializers.ModelSerializer):
    """
    Serializer for labor time entries with role-based wage rate data masking.
    Follows docs/api-specification.md §5 and docs/security-and-permissions.md §3.5.
    """

    project_id = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.filter(is_archived=False),
        source="project",
        write_only=True,
    )
    project_name = serializers.CharField(source="project.name", read_only=True)
    user_id = serializers.UUIDField(source="user.id", read_only=True)
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_full_name = serializers.CharField(source="user.get_full_name", read_only=True)
    hourly_cost_snapshot = serializers.DecimalField(
        max_digits=10,
        decimal_places=4,
        read_only=True,
    )
    computed_cost = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = TimeEntry
        fields = [
            "id",
            "project",
            "project_id",
            "project_name",
            "user",
            "user_id",
            "user_email",
            "user_full_name",
            "work_date",
            "recorded_hours",
            "hourly_cost_snapshot",
            "computed_cost",
            "description",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "project",
            "user",
            "hourly_cost_snapshot",
            "computed_cost",
            "created_at",
            "updated_at",
        ]

    def get_computed_cost(self, obj):
        return str(obj.computed_cost)

    def validate_recorded_hours(self, value):
        if value <= Decimal("0.00"):
            raise serializers.ValidationError(_("Recorded hours must be strictly greater than 0.00."))
        if value > Decimal("24.00"):
            raise serializers.ValidationError(_("Recorded hours cannot exceed 24.00 hours per entry."))
        return value

    def validate_work_date(self, value):
        max_future = timezone.now().date() + timedelta(days=1)
        if value > max_future:
            raise serializers.ValidationError(_("Work date cannot be more than 1 day in the future."))
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        project = attrs.get("project") or (self.instance.project if self.instance else None)

        if request and request.user and request.user.is_authenticated:
            # TEAM_MEMBER must be actively assigned to the project to log time
            if request.user.role == UserRole.TEAM_MEMBER and project:
                is_assigned = ProjectAssignment.objects.filter(
                    project=project,
                    user=request.user,
                    is_active=True,
                ).exists()
                if not is_assigned:
                    raise serializers.ValidationError(
                        {"project_id": _("You must hold an active assignment on this project to log time.")}
                    )

        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user and request.user.is_authenticated:
            validated_data["user"] = request.user
            # Automatically snapshot user's current cost rate
            validated_data["hourly_cost_snapshot"] = request.user.default_hourly_cost_rate

        return super().create(validated_data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")

        # Team members never see cost rates or computed labor cost
        if request and getattr(request.user, "role", None) == UserRole.TEAM_MEMBER:
            data.pop("hourly_cost_snapshot", None)
            data.pop("computed_cost", None)

        return data

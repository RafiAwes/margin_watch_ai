from decimal import Decimal
from rest_framework import serializers
from django.utils.translation import gettext_lazy as _

from users.models import User, UserRole
from clients.models import Client
from projects.models import Project, ProjectAssignment, ProjectStatus


class ProjectClientSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = ["id", "name"]


class ProjectAssignmentSerializer(serializers.ModelSerializer):
    """
    Serializer for team member assignments to delivery projects.
    """

    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(is_active=True),
        source="user",
        write_only=True,
    )
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_full_name = serializers.CharField(source="user.get_full_name", read_only=True)
    user_role = serializers.CharField(source="user.role", read_only=True)
    assigned_by_email = serializers.EmailField(
        source="assigned_by.email", read_only=True, default=None
    )

    class Meta:
        model = ProjectAssignment
        fields = [
            "id",
            "project",
            "user",
            "user_id",
            "user_email",
            "user_full_name",
            "user_role",
            "assigned_by",
            "assigned_by_email",
            "assigned_at",
            "is_active",
        ]
        read_only_fields = [
            "id",
            "project",
            "user",
            "user_email",
            "user_full_name",
            "user_role",
            "assigned_by",
            "assigned_by_email",
            "assigned_at",
        ]

    def create(self, validated_data):
        project = validated_data["project"]
        user = validated_data["user"]
        request = self.context.get("request")
        assigned_by = request.user if request and request.user.is_authenticated else None

        # Handle reactivation if assignment record already exists
        assignment, created = ProjectAssignment.objects.get_or_create(
            project=project,
            user=user,
            defaults={"assigned_by": assigned_by, "is_active": True},
        )
        if not created and not assignment.is_active:
            assignment.is_active = True
            assignment.assigned_by = assigned_by
            assignment.save(update_fields=["is_active", "assigned_by"])

        return assignment


class ProjectSerializer(serializers.ModelSerializer):
    """
    Core delivery monitoring project serializer with dynamic role-based data masking.
    Follows docs/api-specification.md §4 and docs/security-and-permissions.md.
    """

    client = ProjectClientSummarySerializer(read_only=True)
    client_id = serializers.PrimaryKeyRelatedField(
        queryset=Client.objects.all(),
        source="client",
        write_only=True,
    )
    assigned_member_ids = serializers.SerializerMethodField(read_only=True)
    initial_member_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False,
        default=list,
    )
    planned_hourly_cost_rate = serializers.DecimalField(
        max_digits=10,
        decimal_places=4,
        source="planned_hourly_cost",
        required=False,
    )

    class Meta:
        model = Project
        fields = [
            "id",
            "client",
            "client_id",
            "name",
            "description",
            "contract_revenue",
            "planned_cost_budget",
            "planned_hourly_cost",
            "planned_hourly_cost_rate",
            "currency",
            "estimated_remaining_hours",
            "expected_remaining_expenses",
            "status",
            "start_date",
            "deadline",
            "assigned_member_ids",
            "initial_member_ids",
            "is_archived",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "client",
            "assigned_member_ids",
            "is_archived",
            "created_by",
            "created_at",
            "updated_at",
        ]

    def get_assigned_member_ids(self, obj):
        return list(
            obj.assignments.filter(is_active=True).values_list("user_id", flat=True)
        )

    def validate(self, attrs):
        start_date = attrs.get("start_date") or getattr(self.instance, "start_date", None)
        deadline = attrs.get("deadline") or getattr(self.instance, "deadline", None)
        if start_date and deadline and deadline < start_date:
            raise serializers.ValidationError(
                {"deadline": _("Project deadline cannot be earlier than its start date.")}
            )

        # planned_cost_budget must be positive
        budget = attrs.get("planned_cost_budget")
        if budget is not None and budget <= Decimal("0.00"):
            raise serializers.ValidationError(
                {"planned_cost_budget": _("Planned cost budget must be strictly greater than 0.00.")}
            )

        return attrs

    def create(self, validated_data):
        initial_member_ids = validated_data.pop("initial_member_ids", [])
        request = self.context.get("request")
        if request and request.user and request.user.is_authenticated:
            validated_data["created_by"] = request.user

        project = super().create(validated_data)

        # Provision initial team assignments if supplied
        if initial_member_ids:
            users = User.objects.filter(id__in=initial_member_ids, is_active=True)
            for user in users:
                ProjectAssignment.objects.create(
                    project=project,
                    user=user,
                    assigned_by=project.created_by,
                    is_active=True,
                )

        return project

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")

        # CONFIDENTIAL FINANCIAL DATA MASKING:
        # If requesting user is TEAM_MEMBER, confidential financial baselines must be stripped
        if request and getattr(request.user, "role", None) == UserRole.TEAM_MEMBER:
            data.pop("contract_revenue", None)
            data.pop("planned_cost_budget", None)
            data.pop("planned_hourly_cost", None)
            data.pop("planned_hourly_cost_rate", None)
            data.pop("expected_remaining_expenses", None)

        return data

from decimal import Decimal
from rest_framework import serializers
from django.utils.translation import gettext_lazy as _

from users.models import UserRole
from projects.models import Project, ProjectAssignment
from expenses.models import Expense, ExpenseCategory, ExpenseStatus


class ExpenseSerializer(serializers.ModelSerializer):
    """
    Serializer for direct project expenditures.
    Enforces active project assignments on submission and preserves review state immutability.
    Follows docs/api-specification.md §6.
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
    reviewed_by_id = serializers.UUIDField(source="reviewed_by.id", read_only=True, default=None)
    reviewed_by_name = serializers.CharField(source="reviewed_by.get_full_name", read_only=True, default=None)
    reviewed_by_email = serializers.EmailField(source="reviewed_by.email", read_only=True, default=None)

    class Meta:
        model = Expense
        fields = [
            "id",
            "project",
            "project_id",
            "project_name",
            "user",
            "user_id",
            "user_email",
            "user_full_name",
            "category",
            "amount",
            "description",
            "expense_date",
            "status",
            "reviewed_by",
            "reviewed_by_id",
            "reviewed_by_name",
            "reviewed_by_email",
            "reviewed_at",
            "review_note",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "project",
            "user",
            "status",
            "reviewed_by",
            "reviewed_at",
            "review_note",
            "created_at",
            "updated_at",
        ]

    def validate_amount(self, value):
        if value <= Decimal("0.00"):
            raise serializers.ValidationError(_("Expense amount must be strictly greater than 0.00."))
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        project = attrs.get("project") or (self.instance.project if self.instance else None)

        # Non-managers must hold an active assignment to submit an expense
        if request and request.user and request.user.is_authenticated:
            if request.user.role == UserRole.TEAM_MEMBER and project:
                is_assigned = ProjectAssignment.objects.filter(
                    project=project,
                    user=request.user,
                    is_active=True,
                ).exists()
                if not is_assigned:
                    raise serializers.ValidationError(
                        {"project_id": _("You must hold an active assignment on this project to submit an expense.")}
                    )

        # If updating, ensure expense has not already been approved or rejected
        if self.instance and self.instance.status in [ExpenseStatus.APPROVED, ExpenseStatus.REJECTED]:
            raise serializers.ValidationError(
                _("Reviewed expenses (Approved or Rejected) cannot be modified.")
            )

        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user and request.user.is_authenticated:
            validated_data["user"] = request.user
            validated_data["status"] = ExpenseStatus.PENDING

        return super().create(validated_data)


class ExpenseReviewSerializer(serializers.Serializer):
    """
    Serializer for manager expense approval or rejection action.
    Follows docs/api-specification.md §6.2.
    """

    action = serializers.ChoiceField(choices=["APPROVE", "REJECT"])
    review_note = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        action = attrs.get("action")
        note = attrs.get("review_note", "").strip()

        if action == "REJECT" and not note:
            raise serializers.ValidationError(
                {"review_note": _("A non-empty review note is mandatory when rejecting an expense.")}
            )

        attrs["review_note"] = note
        return attrs

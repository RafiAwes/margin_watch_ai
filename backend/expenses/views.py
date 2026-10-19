from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from users.models import UserRole
from expenses.models import Expense, ExpenseStatus
from expenses.serializers import ExpenseSerializer, ExpenseReviewSerializer
from expenses.permissions import IsExpenseOwnerOrManager, IsManagerUser


class ExpenseViewSet(viewsets.ModelViewSet):
    """
    ViewSet for direct project expenditures.
    Provides submission for team members, review/approval workflow for managers, and query filtering.
    Follows docs/api-specification.md §6 and docs/security-and-permissions.md.
    """

    serializer_class = ExpenseSerializer
    permission_classes = [permissions.IsAuthenticated, IsExpenseOwnerOrManager]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Expense.objects.none()

        if user.role == UserRole.MANAGER:
            queryset = Expense.objects.select_related("project", "user", "reviewed_by").all()
            target_user_id = self.request.query_params.get("user_id")
            if target_user_id:
                queryset = queryset.filter(user_id=target_user_id)
        else:
            queryset = Expense.objects.filter(user=user).select_related("project", "user", "reviewed_by")

        # Filtering
        project_id = self.request.query_params.get("project_id")
        if project_id:
            queryset = queryset.filter(project_id=project_id)

        status_param = self.request.query_params.get("status")
        if status_param:
            queryset = queryset.filter(status=status_param.upper())

        category = self.request.query_params.get("category")
        if category:
            queryset = queryset.filter(category=category.upper())

        date_from = self.request.query_params.get("date_from")
        if date_from:
            queryset = queryset.filter(expense_date__gte=date_from)

        date_to = self.request.query_params.get("date_to")
        if date_to:
            queryset = queryset.filter(expense_date__lte=date_to)

        return queryset

    @action(
        detail=True,
        methods=["POST"],
        permission_classes=[permissions.IsAuthenticated, IsManagerUser],
        url_path="review",
    )
    def review(self, request, pk=None):
        """
        Review an expense submission (APPROVE or REJECT).
        Enforces state machine: expenses in APPROVED or REJECTED state cannot be re-reviewed.
        """
        expense = self.get_object()

        if expense.status in [ExpenseStatus.APPROVED, ExpenseStatus.REJECTED]:
            return Response(
                {"detail": _("Expense has already been reviewed.")},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        serializer = ExpenseReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        review_action = serializer.validated_data["action"]
        review_note = serializer.validated_data["review_note"]

        if review_action == "APPROVE":
            expense.status = ExpenseStatus.APPROVED
        elif review_action == "REJECT":
            expense.status = ExpenseStatus.REJECTED

        expense.reviewed_by = request.user
        expense.reviewed_at = timezone.now()
        expense.review_note = review_note
        expense.save()

        response_data = ExpenseSerializer(expense, context={"request": request}).data
        return Response(response_data, status=status.HTTP_200_OK)

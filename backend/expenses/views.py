from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from config.exceptions import BusinessRuleViolation
from config.query_params import date_param, uuid_param
from users.models import UserRole
from expenses.models import Expense, ExpenseStatus
from expenses.serializers import ExpenseSerializer, ExpenseReviewSerializer
from expenses.permissions import IsExpenseOwnerOrManager, IsManagerUser


class ExpenseViewSet(viewsets.ModelViewSet):
    """
    ViewSet for direct project expenditures.
    Provides submission for team members, review/approval workflow for managers, and query filtering.
    Filters: ?project_id=, ?client_id=, ?user_id= (managers), ?status=, ?category=, ?date_from=, ?date_to=;
    ?search= on description and project name; ?ordering= on expense_date, amount, created_at.
    Follows docs/api-specification.md §6 and docs/security-and-permissions.md.
    """

    serializer_class = ExpenseSerializer
    permission_classes = [permissions.IsAuthenticated, IsExpenseOwnerOrManager]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["description", "project__name"]
    ordering_fields = ["expense_date", "amount", "created_at"]
    ordering = ["-expense_date", "-created_at"]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Expense.objects.none()

        if user.role == UserRole.MANAGER:
            queryset = Expense.objects.select_related("project", "user", "reviewed_by").all()
            target_user_id = uuid_param(self.request, "user_id")
            if target_user_id:
                queryset = queryset.filter(user_id=target_user_id)
        else:
            queryset = Expense.objects.filter(user=user).select_related("project", "user", "reviewed_by")

        # Filtering
        project_id = uuid_param(self.request, "project_id")
        if project_id:
            queryset = queryset.filter(project_id=project_id)

        client_id = uuid_param(self.request, "client_id")
        if client_id:
            queryset = queryset.filter(project__client_id=client_id)

        status_param = self.request.query_params.get("status")
        if status_param:
            queryset = queryset.filter(status=status_param.upper())

        category = self.request.query_params.get("category")
        if category:
            queryset = queryset.filter(category=category.upper())

        date_from = date_param(self.request, "date_from")
        if date_from:
            queryset = queryset.filter(expense_date__gte=date_from)

        date_to = date_param(self.request, "date_to")
        if date_to:
            queryset = queryset.filter(expense_date__lte=date_to)

        return queryset

    def destroy(self, request, *args, **kwargs):
        """
        Delete a PENDING expense.
        Reviewed expenses (APPROVED or REJECTED) are part of the financial audit trail and cannot be deleted.
        """
        expense = self.get_object()

        if expense.status in [ExpenseStatus.APPROVED, ExpenseStatus.REJECTED]:
            raise BusinessRuleViolation(_("Reviewed expenses (Approved or Rejected) cannot be deleted."))

        return super().destroy(request, *args, **kwargs)

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
            raise BusinessRuleViolation(_("Expense has already been reviewed."))

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

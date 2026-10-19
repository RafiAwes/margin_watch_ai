from rest_framework import viewsets, permissions, status
from rest_framework.response import Response

from users.models import UserRole
from time_tracking.models import TimeEntry
from time_tracking.serializers import TimeEntrySerializer
from time_tracking.permissions import IsTimeEntryOwnerOrManager


class TimeEntryViewSet(viewsets.ModelViewSet):
    """
    ViewSet for labor time entries.
    Provides role-based querying: managers inspect all entries; team members are scoped to their own.
    Follows docs/api-specification.md §5 and docs/security-and-permissions.md.
    """

    serializer_class = TimeEntrySerializer
    permission_classes = [permissions.IsAuthenticated, IsTimeEntryOwnerOrManager]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return TimeEntry.objects.none()

        if user.role == UserRole.MANAGER:
            queryset = TimeEntry.objects.select_related("project", "user").all()
            # Managers can filter by target user
            target_user_id = self.request.query_params.get("user_id")
            if target_user_id:
                queryset = queryset.filter(user_id=target_user_id)
        else:
            # Team members are strictly scoped to their own time entries
            queryset = TimeEntry.objects.filter(user=user).select_related("project", "user")

        # Common filters
        project_id = self.request.query_params.get("project_id")
        if project_id:
            queryset = queryset.filter(project_id=project_id)

        date_from = self.request.query_params.get("date_from")
        if date_from:
            queryset = queryset.filter(work_date__gte=date_from)

        date_to = self.request.query_params.get("date_to")
        if date_to:
            queryset = queryset.filter(work_date__lte=date_to)

        return queryset

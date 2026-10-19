from rest_framework import permissions
from users.models import UserRole


class IsTimeEntryOwnerOrManager(permissions.BasePermission):
    """
    Object-level permission allowing managers full access to all time entries,
    and team members access strictly to their own recorded time entries.
    """

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if not (request.user and request.user.is_authenticated):
            return False

        # Managers can inspect, update, or delete any time entry
        if getattr(request.user, "role", None) == UserRole.MANAGER:
            return True

        # Team members can only access their own entries
        return obj.user_id == request.user.id

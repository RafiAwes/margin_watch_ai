from rest_framework import permissions
from users.models import UserRole


class IsManagerUser(permissions.BasePermission):
    """
    Allows access strictly to authenticated managers.
    """

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "role", None) == UserRole.MANAGER
        )


class IsExpenseOwnerOrManager(permissions.BasePermission):
    """
    Object-level permission allowing managers full access to any expense,
    and team members access strictly to their own submitted expenses.
    """

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if not (request.user and request.user.is_authenticated):
            return False

        if getattr(request.user, "role", None) == UserRole.MANAGER:
            return True

        return obj.user_id == request.user.id

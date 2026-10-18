from rest_framework import permissions
from users.models import UserRole


class IsManager(permissions.BasePermission):
    """
    Allows access strictly to authenticated users with the MANAGER role.
    """

    message = "Only agency managers are authorized to perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "role", None) == UserRole.MANAGER
        )


class IsTeamMember(permissions.BasePermission):
    """
    Allows access strictly to authenticated users with the TEAM_MEMBER role.
    """

    message = "Only team members are authorized to access this resource."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "role", None) == UserRole.TEAM_MEMBER
        )


class IsOwnerOrManager(permissions.BasePermission):
    """
    Object-level permission allowing access if the requesting user is a MANAGER,
    or if the target object is the requesting user themselves (or owned by them).
    """

    message = "You do not have permission to view or modify this record."

    def has_object_permission(self, request, view, obj):
        if not (request.user and request.user.is_authenticated):
            return False

        if getattr(request.user, "role", None) == UserRole.MANAGER:
            return True

        # Target object is the User model instance
        if hasattr(obj, "id") and str(obj.id) == str(request.user.id):
            return True

        # Target object has a user foreign key or user_id attribute
        if hasattr(obj, "user_id") and str(obj.user_id) == str(request.user.id):
            return True
        if hasattr(obj, "user") and obj.user == request.user:
            return True

        return False

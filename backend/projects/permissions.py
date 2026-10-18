from rest_framework import permissions
from users.models import UserRole
from projects.models import Project, ProjectAssignment


class IsAssignedTeamMember(permissions.BasePermission):
    """
    Object-level permission granting access if the user is a MANAGER,
    or if the user has an active ProjectAssignment for the project.
    Follows docs/security-and-permissions.md.
    """

    message = "You are not assigned to this project."

    def has_object_permission(self, request, view, obj):
        if not (request.user and request.user.is_authenticated):
            return False

        # Managers have unrestricted operational oversight
        if getattr(request.user, "role", None) == UserRole.MANAGER:
            return True

        # Target is a Project instance
        if isinstance(obj, Project):
            return ProjectAssignment.objects.filter(
                project=obj,
                user=request.user,
                is_active=True,
            ).exists()

        # Target is a ProjectAssignment instance
        if isinstance(obj, ProjectAssignment):
            return obj.user_id == request.user.id

        # Target object has a project attribute (e.g. TimeEntry, Expense)
        project = getattr(obj, "project", None)
        if project:
            return ProjectAssignment.objects.filter(
                project=project,
                user=request.user,
                is_active=True,
            ).exists()

        return False

from config.ordering import StableOrderingFilter
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
from django.db.models import Prefetch
from django.shortcuts import get_object_or_404

from config.query_params import uuid_param
from users.models import User, UserRole
from users.permissions import IsManager
from projects.models import Project, ProjectAssignment
from projects.permissions import IsAssignedTeamMember
from projects.serializers import (
    ProjectSerializer,
    ProjectAssignmentSerializer,
)


def apply_project_filters(queryset, request):
    """Shared project list filters: ?client_id=, ?status=, ?is_archived= (also used by profitability)."""
    client_id = uuid_param(request, "client_id")
    if client_id:
        queryset = queryset.filter(client_id=client_id)

    status_param = request.query_params.get("status")
    if status_param:
        queryset = queryset.filter(status=status_param.upper())

    is_archived_param = request.query_params.get("is_archived")
    if is_archived_param is not None:
        if is_archived_param.lower() in ["true", "1"]:
            queryset = queryset.filter(is_archived=True)
        elif is_archived_param.lower() in ["false", "0"]:
            queryset = queryset.filter(is_archived=False)

    return queryset


class ProjectViewSet(viewsets.ModelViewSet):
    """
    Core delivery project API.
    - Managers have full access across all agency projects.
    - Team Members only see projects where they hold an active assignment.
    - Financial baselines are masked from Team Members.
    Follows docs/api-specification.md §4 and docs/security-and-permissions.md.
    """

    serializer_class = ProjectSerializer
    filter_backends = [filters.SearchFilter, StableOrderingFilter]
    search_fields = ["name", "client__name", "description"]
    ordering_fields = ["name", "created_at", "updated_at", "deadline", "status"]
    ordering = ["-created_at"]

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsAuthenticated(), IsManager()]
        return [IsAuthenticated(), IsAssignedTeamMember()]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Project.objects.none()

        if getattr(user, "role", None) == UserRole.MANAGER:
            queryset = Project.objects.all().select_related("client", "created_by")
        else:
            queryset = (
                Project.objects.filter(
                    assignments__user=user,
                    assignments__is_active=True,
                )
                .distinct()
                .select_related("client")
            )

        active_assignments = Prefetch(
            "assignments",
            queryset=ProjectAssignment.objects.filter(is_active=True).only("id", "project_id", "user_id"),
            to_attr="active_assignments",
        )
        return apply_project_filters(queryset.prefetch_related(active_assignments), self.request)

    def destroy(self, request, *args, **kwargs):
        """Soft-archive project to protect financial audit history."""
        project = self.get_object()
        project.is_archived = True
        project.save(update_fields=["is_archived", "updated_at"])
        return Response(
            {
                "detail": f"Project '{project.name}' has been archived successfully.",
                "is_archived": True,
            },
            status=status.HTTP_200_OK,
        )

    # Sub-Resource Actions: Team Member Assignments
    @action(
        detail=True,
        methods=["get", "post"],
        permission_classes=[IsAuthenticated, IsManager],
        url_path="assignments",
    )
    def assignments(self, request, pk=None):
        project = self.get_object()

        if request.method == "GET":
            assignments = project.assignments.filter(is_active=True).select_related(
                "user", "assigned_by"
            )
            serializer = ProjectAssignmentSerializer(assignments, many=True)
            return Response(serializer.data)

        if request.method == "POST":
            user_id = request.data.get("user_id")
            if not user_id:
                raise ValidationError({"user_id": ["This field is required."]})

            try:
                user = get_object_or_404(User, id=user_id, is_active=True)
            except DjangoValidationError:
                # Malformed UUID: treat like any other unknown user
                raise Http404

            assignment, created = ProjectAssignment.objects.get_or_create(
                project=project,
                user=user,
                defaults={"assigned_by": request.user, "is_active": True},
            )
            if not created and assignment.is_active:
                raise ValidationError({"user_id": ["User is already actively assigned to this project."]})

            if not assignment.is_active:
                assignment.is_active = True
                assignment.assigned_by = request.user
                assignment.save(update_fields=["is_active", "assigned_by"])

            serializer = ProjectAssignmentSerializer(assignment)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=["delete"],
        permission_classes=[IsAuthenticated, IsManager],
        url_path="assignments/(?P<assignment_id>[^/.]+)",
    )
    def revoke_assignment(self, request, pk=None, assignment_id=None):
        project = self.get_object()
        assignment = get_object_or_404(
            ProjectAssignment,
            id=assignment_id,
            project=project,
        )
        assignment.is_active = False
        assignment.save(update_fields=["is_active"])
        return Response(
            {"detail": f"Assignment for {assignment.user.email} has been revoked."},
            status=status.HTTP_200_OK,
        )

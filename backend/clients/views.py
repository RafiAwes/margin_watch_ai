from rest_framework import viewsets, status, filters
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import ProtectedError

from users.permissions import IsManager
from clients.models import Client
from clients.serializers import ClientSerializer


class ClientViewSet(viewsets.ModelViewSet):
    """
    CRUD API for commercial clients. Restricted strictly to users with the MANAGER role.
    Follows docs/api-specification.md §3 and docs/backend/backend-apps-and-data-models.md §3.2.
    """

    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticated, IsManager]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "contact_name", "contact_email"]
    ordering_fields = ["name", "created_at", "updated_at"]
    ordering = ["name"]

    def get_queryset(self):
        queryset = Client.objects.all()
        is_archived_param = self.request.query_params.get("is_archived")
        if is_archived_param is not None:
            if is_archived_param.lower() in ["true", "1"]:
                queryset = queryset.filter(is_archived=True)
            elif is_archived_param.lower() in ["false", "0"]:
                queryset = queryset.filter(is_archived=False)
        return queryset

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        has_projects = instance.projects.exists()

        # If hard_delete query parameter is explicitly requested
        if request.query_params.get("hard_delete") in ["true", "1"]:
            try:
                self.perform_destroy(instance)
                return Response(status=status.HTTP_204_NO_CONTENT)
            except ProtectedError:
                raise ValidationError(
                    "Cannot delete client with existing project deliveries. "
                    "Please archive the client instead to preserve financial history."
                )

        # Default behavior: soft-archive to safeguard relational integrity
        instance.is_archived = True
        instance.save(update_fields=["is_archived", "updated_at"])
        return Response(
            {
                "detail": f"Client '{instance.name}' has been archived successfully.",
                "is_archived": True,
            },
            status=status.HTTP_200_OK,
        )

from rest_framework import serializers
from clients.models import Client


class ClientSerializer(serializers.ModelSerializer):
    """
    Serializer for commercial Client records. Follows docs/api-specification.md §3.
    """

    projects_count = serializers.SerializerMethodField(read_only=True)
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)

    class Meta:
        model = Client
        fields = [
            "id",
            "name",
            "contact_name",
            "contact_email",
            "contact_phone",
            "notes",
            "is_archived",
            "projects_count",
            "created_by",
            "created_by_email",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "projects_count",
            "created_by",
            "created_by_email",
            "created_at",
            "updated_at",
        ]

    def get_projects_count(self, obj):
        # Annotated by ClientViewSet.get_queryset to avoid one COUNT query per client
        annotated = getattr(obj, "projects_total", None)
        return annotated if annotated is not None else obj.projects.count()

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user and request.user.is_authenticated:
            validated_data["created_by"] = request.user
        return super().create(validated_data)

from rest_framework import serializers
from rest_framework_simplejwt.serializers import (
    TokenObtainPairSerializer,
    TokenRefreshSerializer,
)
from rest_framework_simplejwt.exceptions import InvalidToken
from users.models import User, UserRole


class UserSerializer(serializers.ModelSerializer):
    """
    Serializer for User profile representation.
    Enforces role-based rate masking: `default_hourly_cost_rate` is only visible
    if the requesting user is an AGENCY_MANAGER.
    """

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "role",
            "default_hourly_cost_rate",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "email", "role", "created_at", "updated_at"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")

        # Security rate masking: only AGENCY_MANAGER can view internal hourly rates
        requesting_user = getattr(request, "user", None)
        is_manager = requesting_user and getattr(requesting_user, "role", None) == UserRole.AGENCY_MANAGER

        if not is_manager:
            data.pop("default_hourly_cost_rate", None)

        return data


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Custom JWT obtain pair serializer that:
    1. Normalizes email input (case-insensitive).
    2. Emits access_token and refresh_token matching docs/api-specification.md.
    3. Embeds user profile identity into the login response.
    """

    def validate(self, attrs):
        # Normalize email address before authentication
        if "email" in attrs:
            attrs["email"] = attrs["email"].strip().lower()

        data = super().validate(attrs)

        # Conforming to docs/api-specification.md response format
        data["access_token"] = str(data["access"])
        data["refresh_token"] = str(data["refresh"])
        data["user"] = {
            "id": str(self.user.id),
            "email": self.user.email,
            "first_name": self.user.first_name,
            "last_name": self.user.last_name,
            "role": self.user.role,
        }
        return data


class CustomTokenRefreshSerializer(TokenRefreshSerializer):
    """
    Custom JWT refresh serializer accepting either `refresh` or `refresh_token`
    and returning both `access_token` and standard `access`.
    """

    refresh = serializers.CharField(required=False)
    refresh_token = serializers.CharField(required=False, write_only=True)

    def validate(self, attrs):
        refresh_val = attrs.get("refresh") or attrs.get("refresh_token")
        if not refresh_val:
            raise serializers.ValidationError({"refresh": ["This field is required."]})

        attrs["refresh"] = refresh_val
        data = super().validate(attrs)
        data["access_token"] = str(data["access"])
        if "refresh" in data:
            data["refresh_token"] = str(data["refresh"])
        return data


from decimal import Decimal
from rest_framework import serializers
from rest_framework_simplejwt.serializers import (
    TokenObtainPairSerializer,
    TokenRefreshSerializer,
)
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from users.models import User, UserRole


class UserSerializer(serializers.ModelSerializer):
    """
    Serializer for User representation.
    Enforces role-based rate masking: `default_hourly_cost_rate` is only visible
    if the requesting user is an agency MANAGER.
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
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "email", "role", "created_at", "updated_at"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")

        # Security rate masking: only MANAGER can view internal hourly rates
        requesting_user = getattr(request, "user", None)
        is_manager = requesting_user and getattr(requesting_user, "role", None) == UserRole.MANAGER

        if not is_manager:
            data.pop("default_hourly_cost_rate", None)

        return data


class UserCreateSerializer(serializers.ModelSerializer):
    """
    Manager-only serializer to provision new agency users.
    """

    password = serializers.CharField(write_only=True, min_length=8, style={"input_type": "password"})

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "password",
            "first_name",
            "last_name",
            "role",
            "default_hourly_cost_rate",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate_email(self, value):
        normalized = value.strip().lower()
        if User.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError("A user with this email address already exists.")
        return normalized

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class UserRegisterSerializer(UserCreateSerializer):
    """
    Public registration serializer for new agency users.
    Accepts email, password, and optional first_name, last_name, role, and rate.
    """

    first_name = serializers.CharField(required=False, allow_blank=True, default="")
    last_name = serializers.CharField(required=False, allow_blank=True, default="")
    default_hourly_cost_rate = serializers.DecimalField(
        max_digits=10,
        decimal_places=4,
        required=False,
        default=Decimal("0.0000"),
    )


class UserUpdateSerializer(serializers.ModelSerializer):
    """
    Manager-only serializer to update user role, default hourly rate, or status.
    Guards against self-lockout (demoting or deactivating the agency's sole active manager).
    """

    class Meta:
        model = User
        fields = [
            "first_name",
            "last_name",
            "role",
            "default_hourly_cost_rate",
            "is_active",
        ]

    def validate(self, attrs):
        instance = self.instance
        request = self.context.get("request")

        if instance and request and instance.id == request.user.id:
            new_role = attrs.get("role", instance.role)
            new_active = attrs.get("is_active", instance.is_active)

            # Check if self-demoting or self-deactivating
            if (new_role != UserRole.MANAGER or not new_active) and instance.role == UserRole.MANAGER:
                other_managers = (
                    User.objects.filter(role=UserRole.MANAGER, is_active=True)
                    .exclude(id=instance.id)
                    .exists()
                )
                if not other_managers:
                    raise serializers.ValidationError(
                        {"role": "You cannot demote or deactivate the only active manager in the agency."}
                    )

        return attrs


class LogoutSerializer(serializers.Serializer):
    """
    Serializer to handle user logout by blacklisting the active refresh token.
    Accepts either `refresh` or `refresh_token`.
    """

    refresh = serializers.CharField(required=False)
    refresh_token = serializers.CharField(required=False, write_only=True)

    def validate(self, attrs):
        token = attrs.get("refresh") or attrs.get("refresh_token")
        if not token:
            raise serializers.ValidationError({"refresh": ["A refresh token is required to log out."]})
        attrs["token"] = token
        return attrs

    def save(self, **kwargs):
        try:
            refresh_token = RefreshToken(self.validated_data["token"])
            refresh_token.blacklist()
        except TokenError as e:
            raise serializers.ValidationError({"refresh": [str(e)]})


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

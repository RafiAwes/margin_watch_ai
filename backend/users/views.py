from rest_framework import generics, permissions, status, viewsets
from rest_framework.response import Response
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from users.models import User
from users.permissions import IsManager
from users.serializers import (
    CustomTokenObtainPairSerializer,
    CustomTokenRefreshSerializer,
    LogoutSerializer,
    UserCreateSerializer,
    UserSerializer,
    UserUpdateSerializer,
)


class CustomTokenObtainPairView(TokenObtainPairView):
    """
    POST /api/v1/auth/login/
    Public endpoint to authenticate user credentials and issue signed JWT tokens.
    """

    serializer_class = CustomTokenObtainPairSerializer


class CustomTokenRefreshView(TokenRefreshView):
    """
    POST /api/v1/auth/refresh/
    Public endpoint to renew an expired access token using a valid refresh token.
    """

    serializer_class = CustomTokenRefreshSerializer


class LogoutView(generics.GenericAPIView):
    """
    POST /api/v1/auth/logout/
    Revoke an active refresh token by adding it to the SimpleJWT blacklist.
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = LogoutSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {"detail": "Successfully logged out."},
            status=status.HTTP_200_OK,
        )


class CurrentUserView(generics.RetrieveUpdateAPIView):
    """
    GET /api/v1/auth/me/
    Retrieve the profile of the currently authenticated user with role-based rate masking.
    PATCH/PUT /api/v1/auth/me/
    Update own profile information (first_name, last_name).
    """

    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class UserViewSet(viewsets.ModelViewSet):
    """
    Agency user management endpoints:
    - GET /api/v1/users/: List active users (Managers see rates; Team members see profiles with rates masked).
    - POST /api/v1/users/: Create a new agency user (Manager only).
    - GET /api/v1/users/{id}/: Retrieve user details (Authenticated).
    - PATCH/PUT /api/v1/users/{id}/: Update user details, role, or rate (Manager only).
    - DELETE /api/v1/users/{id}/: Soft-deactivate user account (Manager only).
    """

    queryset = User.objects.all().order_by("email")
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsManager()]
        return [permissions.IsAuthenticated()]

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        elif self.action in ["update", "partial_update"]:
            return UserUpdateSerializer
        return UserSerializer

    def get_queryset(self):
        user = self.request.user
        # Managers can pass ?include_inactive=true to view deactivated users
        if getattr(user, "is_manager", False) and self.request.query_params.get("include_inactive") == "true":
            return User.objects.all().order_by("email")
        return User.objects.filter(is_active=True).order_by("email")

    def perform_destroy(self, instance):
        # Soft-delete: mark inactive to protect audit trail and relational history
        if instance.id == self.request.user.id and instance.is_manager:
            other_managers = (
                User.objects.filter(role=instance.role, is_active=True)
                .exclude(id=instance.id)
                .exists()
            )
            if not other_managers:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({"detail": "Cannot deactivate the only active manager."})

        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])

from rest_framework import generics, permissions
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from users.models import User
from users.serializers import (
    CustomTokenObtainPairSerializer,
    CustomTokenRefreshSerializer,
    UserSerializer,
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

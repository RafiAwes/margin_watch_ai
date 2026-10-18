from django.urls import path
from users.views import (
    CustomTokenObtainPairView,
    CustomTokenRefreshView,
    CurrentUserView,
    LogoutView,
)

app_name = "users"

urlpatterns = [
    path("login/", CustomTokenObtainPairView.as_view(), name="auth-login"),
    path("refresh/", CustomTokenRefreshView.as_view(), name="auth-refresh"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("me/", CurrentUserView.as_view(), name="auth-me"),
]

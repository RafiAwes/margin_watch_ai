from django.contrib import admin
from django.urls import path, include


from rest_framework.routers import DefaultRouter
from users.views import UserViewSet
from clients.views import ClientViewSet
from projects.views import ProjectViewSet

router = DefaultRouter()
router.register(r"users", UserViewSet, basename="user")
router.register(r"clients", ClientViewSet, basename="client")
router.register(r"projects", ProjectViewSet, basename="project")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/auth/", include("users.urls")),
    path("api/v1/", include(router.urls)),
    path("api-auth/", include("rest_framework.urls")),
]


from django.contrib import admin
from django.urls import path, include


from rest_framework.routers import DefaultRouter
from users.views import UserViewSet
from clients.views import ClientViewSet
from projects.views import ProjectViewSet
from time_tracking.views import TimeEntryViewSet
from expenses.views import ExpenseViewSet

router = DefaultRouter()
router.register(r"users", UserViewSet, basename="user")
router.register(r"clients", ClientViewSet, basename="client")
router.register(r"projects", ProjectViewSet, basename="project")
router.register(r"time-entries", TimeEntryViewSet, basename="time-entry")
router.register(r"expenses", ExpenseViewSet, basename="expense")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/auth/", include("users.urls")),
    # Before the router so /projects/financial-summaries/ is not read as a project id
    path("api/v1/", include("profitability.urls")),
    path("api/v1/", include(router.urls)),
    path("api-auth/", include("rest_framework.urls")),
]


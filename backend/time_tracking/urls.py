from rest_framework.routers import DefaultRouter
from time_tracking.views import TimeEntryViewSet

router = DefaultRouter()
router.register(r"", TimeEntryViewSet, basename="time-entry")

urlpatterns = router.urls

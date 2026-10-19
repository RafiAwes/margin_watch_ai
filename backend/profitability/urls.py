from django.urls import path

from profitability.views import (
    DashboardSummaryView,
    ProjectFinancialSummaryListView,
    ProjectFinancialSummaryView,
)

# Included before the DRF router in config/urls.py so "financial-summaries" is not
# captured as a project id by the projects detail route.
urlpatterns = [
    path(
        "projects/financial-summaries/",
        ProjectFinancialSummaryListView.as_view(),
        name="project-financial-summaries",
    ),
    path(
        "projects/<str:pk>/financial-summary/",
        ProjectFinancialSummaryView.as_view(),
        name="project-financial-summary",
    ),
    path("dashboard/summary/", DashboardSummaryView.as_view(), name="dashboard-summary"),
]

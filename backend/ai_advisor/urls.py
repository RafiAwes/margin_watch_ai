from django.urls import path

from ai_advisor.views import ProjectAIRiskAnalysisView

# Included before the DRF router in config/urls.py (same reason as profitability.urls)
urlpatterns = [
    path(
        "projects/<str:pk>/ai-risk-analysis/",
        ProjectAIRiskAnalysisView.as_view(),
        name="project-ai-risk-analysis",
    ),
]

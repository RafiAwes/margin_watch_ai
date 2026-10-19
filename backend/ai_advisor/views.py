import uuid

from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from ai_advisor.services import analyze_project
from projects.models import Project
from users.permissions import IsManager


class ProjectAIRiskAnalysisView(APIView):
    """
    POST /api/v1/projects/{id}/ai-risk-analysis/
    Advisory-only explanation of the deterministic financial summary (docs/api-specification.md §8.1).
    Manager-only, 10 requests/hour/user (security-and-permissions.md §5.2). Never writes data.
    """

    permission_classes = [IsAuthenticated, IsManager]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "ai_advisor"

    def post(self, request, pk):
        try:
            project_id = uuid.UUID(str(pk))
        except ValueError:
            raise NotFound()
        project = Project.objects.filter(pk=project_id).first()
        if project is None:
            raise NotFound()

        result = analyze_project(project)
        return Response(
            {
                "project_id": result.project_id,
                "deterministic_status": result.deterministic_status,
                "ai_advisor": result.advice,
                "generated_at": result.generated_at,
                "model": result.model,
                "cached": result.cached,
            }
        )

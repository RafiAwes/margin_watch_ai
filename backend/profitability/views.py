import uuid

from rest_framework import filters, generics
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from profitability.selectors import summarize_projects
from profitability.serializers import portfolio_summary_data, project_summary_data
from profitability.services import summarize_portfolio
from projects.models import Project, ProjectStatus
from projects.views import apply_project_filters
from users.permissions import IsManager


class ProjectFinancialSummaryView(APIView):
    """
    GET /api/v1/projects/{id}/financial-summary/
    Authoritative financial calculation and deterministic risk classification for one project.
    Manager-only (docs/api-specification.md §7.2).
    """

    permission_classes = [IsAuthenticated, IsManager]

    def get(self, request, pk):
        try:
            project_id = uuid.UUID(str(pk))
        except ValueError:
            raise NotFound()
        project = Project.objects.filter(pk=project_id).first()
        if project is None:
            raise NotFound()

        [(project, summary)] = summarize_projects([project])
        return Response(project_summary_data(project, summary))


class ProjectFinancialSummaryListView(generics.GenericAPIView):
    """
    GET /api/v1/projects/financial-summaries/
    Paginated financial summaries for many projects in a fixed number of queries.
    Filters as /api/v1/projects/: ?client_id=, ?status=, ?is_archived=, ?search=, ?ordering=.
    """

    permission_classes = [IsAuthenticated, IsManager]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "client__name", "description"]
    ordering_fields = ["name", "created_at", "updated_at", "deadline", "status"]
    ordering = ["-created_at"]

    def get_queryset(self):
        return apply_project_filters(Project.objects.all(), self.request)

    def get(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        projects = page if page is not None else list(queryset)
        data = [project_summary_data(p, s) for p, s in summarize_projects(projects)]
        if page is not None:
            return self.get_paginated_response(data)
        return Response(data)


class DashboardSummaryView(APIView):
    """
    GET /api/v1/dashboard/summary/?currency=USD
    Portfolio totals over ACTIVE, non-archived projects in one currency (financial-rules §4.2).
    Manager-only (docs/api-specification.md §7.1).
    """

    permission_classes = [IsAuthenticated, IsManager]

    def get(self, request):
        currency = request.query_params.get("currency", "USD").strip().upper()
        if len(currency) != 3 or not currency.isalpha():
            raise ValidationError({"currency": ["Use a 3-letter ISO currency code, e.g. USD."]})

        projects = Project.objects.filter(
            status=ProjectStatus.ACTIVE, is_archived=False, currency=currency
        ).order_by("name")
        summaries = [summary for _, summary in summarize_projects(projects)]
        return Response(portfolio_summary_data(summarize_portfolio(summaries, currency=currency)))

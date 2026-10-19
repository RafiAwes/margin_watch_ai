import json
import uuid
from decimal import Decimal as D
from unittest import mock

from django.core.cache import cache
from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from rest_framework import status
from rest_framework.test import APIClient

from ai_advisor import services
from ai_advisor.client import AdvisorQuotaExceeded, AdvisorTimeout
from ai_advisor.tests.test_services import VALID_REPLY, FakeClient
from clients.models import Client
from projects.models import Project, ProjectAssignment
from time_tracking.models import TimeEntry
from users.models import User, UserRole


@override_settings(GEMINI_MODEL="gemini-test-model")
class AIRiskAnalysisApiTests(TestCase):
    def setUp(self):
        cache.clear()  # also resets throttle history
        self.api = APIClient()
        self.manager = User.objects.create_user(
            email="manager@agency.com", password="ManagerPass123!", role=UserRole.MANAGER,
            default_hourly_cost_rate=D("100.0000"),
        )
        self.developer = User.objects.create_user(
            email="dev@agency.com", password="DevPass123!", role=UserRole.TEAM_MEMBER,
        )
        client = Client.objects.create(name="Acme Corp", created_by=self.manager)
        self.project = Project.objects.create(
            client=client, name="Scenario 2", contract_revenue=D("10000.00"),
            planned_cost_budget=D("6000.00"), planned_hourly_cost=D("50.0000"),
            estimated_remaining_hours=D("50.00"), created_by=self.manager,
        )
        ProjectAssignment.objects.create(project=self.project, user=self.developer, assigned_by=self.manager)
        for _ in range(2):
            TimeEntry.objects.create(
                project=self.project, user=self.manager, work_date="2026-10-01",
                recorded_hours=D("20.00"), description="Build",
            )
        self.url = f"/api/v1/projects/{self.project.id}/ai-risk-analysis/"

    def post(self, fake=None, url=None):
        with mock.patch.object(services, "get_client", return_value=fake or FakeClient()):
            return self.api.post(url or self.url)

    def test_success_response_shape(self):
        self.api.force_authenticate(self.manager)
        response = self.post()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(set(data), {"project_id", "deterministic_status", "ai_advisor", "generated_at", "model", "cached"})
        self.assertEqual(data["project_id"], str(self.project.id))
        self.assertEqual(data["deterministic_status"], "at_risk")
        self.assertEqual(data["ai_advisor"], VALID_REPLY)
        self.assertEqual(data["model"], "gemini-test-model")
        self.assertFalse(data["cached"])

        self.assertTrue(self.post().json()["cached"])

    def test_tc_ai_05_no_database_writes(self):
        self.api.force_authenticate(self.manager)
        with CaptureQueriesContext(connection) as queries:
            response = self.post()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        writes = [q["sql"] for q in queries.captured_queries
                  if q["sql"].lstrip().split(" ", 1)[0].upper() in ("INSERT", "UPDATE", "DELETE")]
        self.assertEqual(writes, [])

    def test_provider_failures_use_the_error_envelope(self):
        self.api.force_authenticate(self.manager)
        for error, code in ((AdvisorTimeout(), "AI_TIMEOUT"), (AdvisorQuotaExceeded(), "AI_QUOTA_EXCEEDED")):
            response = self.post(FakeClient(error=error))
            self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
            self.assertEqual(response.json()["error"]["code"], code)
            self.assertIn("Deterministic financials remain valid", response.json()["error"]["message"])

        response = self.post(FakeClient(reply="not json"))
        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertEqual(response.json()["error"]["code"], "AI_RESPONSE_INVALID")

        # The deterministic summary is unaffected by AI failures
        summary = self.api.get(f"/api/v1/projects/{self.project.id}/financial-summary/")
        self.assertEqual(summary.status_code, status.HTTP_200_OK)

    @override_settings(GEMINI_API_KEY="")
    def test_not_configured(self):
        self.api.force_authenticate(self.manager)
        response = self.api.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.json()["error"]["code"], "AI_NOT_CONFIGURED")

    def test_permissions_and_not_found(self):
        response = self.api.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        self.api.force_authenticate(self.developer)  # assigned, but not a manager
        response = self.post()
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.api.force_authenticate(self.manager)
        for bad in (uuid.uuid4(), "not-a-uuid"):
            response = self.post(url=f"/api/v1/projects/{bad}/ai-risk-analysis/")
            self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        self.assertEqual(self.api.get(self.url).status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_rate_limited_to_10_per_hour(self):
        self.api.force_authenticate(self.manager)
        for _ in range(10):
            self.assertEqual(self.post().status_code, status.HTTP_200_OK)
        response = self.post()
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(response.json()["error"]["code"], "THROTTLED")

import uuid
from datetime import timedelta
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from users.models import User, UserRole
from clients.models import Client
from projects.models import Project
from expenses.models import Expense, ExpenseCategory, ExpenseStatus
from time_tracking.models import TimeEntry


class ErrorEnvelopeTests(TestCase):
    """
    Every error response uses the envelope from docs/api-specification.md §1.4:
    {"error": {"code": ..., "message": ..., "details": [{"field": ..., "issue": ...}]}}
    """

    def setUp(self):
        self.client = APIClient()
        self.manager = User.objects.create_user(
            email="manager@agency.com",
            password="ManagerPass123!",
            role=UserRole.MANAGER,
        )
        self.developer = User.objects.create_user(
            email="dev@agency.com",
            password="DevPass123!",
            role=UserRole.TEAM_MEMBER,
        )
        self.client_obj = Client.objects.create(name="Acme Corp", created_by=self.manager)
        self.project = Project.objects.create(
            client=self.client_obj,
            name="Cloud Platform",
            contract_revenue=Decimal("50000.00"),
            planned_cost_budget=Decimal("30000.00"),
            planned_hourly_cost=Decimal("100.0000"),
            created_by=self.manager,
        )

    def assertEnvelope(self, response, expected_status, expected_code):
        self.assertEqual(response.status_code, expected_status)
        self.assertEqual(set(response.data.keys()), {"error"})
        error = response.data["error"]
        self.assertEqual(error["code"], expected_code)
        self.assertTrue(error["message"])
        self.assertIsInstance(error["details"], list)
        return error

    def test_validation_error_lists_field_issues(self):
        self.client.force_authenticate(user=self.manager)
        response = self.client.post(
            "/api/v1/time-entries/",
            {
                "project_id": str(self.project.id),
                "work_date": str(timezone.now().date()),
                "recorded_hours": "25.00",
                "description": "Too long a day",
            },
        )
        error = self.assertEnvelope(response, status.HTTP_400_BAD_REQUEST, "VALIDATION_ERROR")
        self.assertIn("recorded_hours", [d["field"] for d in error["details"]])
        self.assertTrue(all(d["issue"] for d in error["details"]))

    def test_unauthenticated_request(self):
        response = self.client.get("/api/v1/projects/")
        self.assertEnvelope(response, status.HTTP_401_UNAUTHORIZED, "NOT_AUTHENTICATED")

    def test_invalid_token(self):
        self.client.credentials(HTTP_AUTHORIZATION="Bearer not-a-real-token")
        response = self.client.get("/api/v1/projects/")
        self.assertEnvelope(response, status.HTTP_401_UNAUTHORIZED, "TOKEN_NOT_VALID")

    def test_permission_denied(self):
        self.client.force_authenticate(user=self.developer)
        response = self.client.post("/api/v1/clients/", {"name": "Not allowed"})
        self.assertEnvelope(response, status.HTTP_403_FORBIDDEN, "PERMISSION_DENIED")

    def test_not_found(self):
        self.client.force_authenticate(user=self.manager)
        response = self.client.get(f"/api/v1/projects/{uuid.uuid4()}/")
        self.assertEnvelope(response, status.HTTP_404_NOT_FOUND, "NOT_FOUND")

    def test_malformed_assignment_user_id_returns_404(self):
        self.client.force_authenticate(user=self.manager)
        response = self.client.post(
            f"/api/v1/projects/{self.project.id}/assignments/",
            {"user_id": "not-a-uuid"},
        )
        self.assertEnvelope(response, status.HTTP_404_NOT_FOUND, "NOT_FOUND")

    def test_business_rule_violation(self):
        expense = Expense.objects.create(
            project=self.project,
            user=self.developer,
            category=ExpenseCategory.OTHER,
            amount=Decimal("40.00"),
            description="Books",
            expense_date=timezone.now().date(),
            status=ExpenseStatus.APPROVED,
            reviewed_by=self.manager,
            reviewed_at=timezone.now(),
        )
        self.client.force_authenticate(user=self.manager)
        response = self.client.delete(f"/api/v1/expenses/{expense.id}/")
        self.assertEnvelope(
            response, status.HTTP_422_UNPROCESSABLE_ENTITY, "BUSINESS_RULE_VIOLATION"
        )


class PaginationAndFilterTests(TestCase):
    """
    Collection endpoints use the envelope from docs/api-specification.md §1.3 and accept
    filters, search, and ordering (Task 5.8).
    """

    def setUp(self):
        self.client = APIClient()
        self.manager = User.objects.create_user(
            email="manager@agency.com",
            password="ManagerPass123!",
            role=UserRole.MANAGER,
            default_hourly_cost_rate=Decimal("100.0000"),
        )
        self.client.force_authenticate(user=self.manager)
        self.acme = Client.objects.create(name="Acme Corp", created_by=self.manager)
        self.apex = Client.objects.create(name="Apex Retail", created_by=self.manager)
        self.alpha = Project.objects.create(
            client=self.acme,
            name="Project Alpha",
            contract_revenue=Decimal("50000.00"),
            planned_cost_budget=Decimal("30000.00"),
            planned_hourly_cost=Decimal("100.0000"),
            created_by=self.manager,
        )
        self.beta = Project.objects.create(
            client=self.apex,
            name="Project Beta",
            contract_revenue=Decimal("20000.00"),
            planned_cost_budget=Decimal("12000.00"),
            planned_hourly_cost=Decimal("100.0000"),
            created_by=self.manager,
        )
        self.today = timezone.now().date()

    def test_list_response_uses_pagination_envelope(self):
        Client.objects.create(name="Starlight Labs", created_by=self.manager)
        response = self.client.get("/api/v1/clients/?page_size=2")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            set(response.data.keys()), {"count", "next", "previous", "page_size", "results"}
        )
        self.assertEqual(response.data["count"], 3)
        self.assertEqual(response.data["page_size"], 2)
        self.assertEqual(len(response.data["results"]), 2)
        self.assertIsNotNone(response.data["next"])
        self.assertIsNone(response.data["previous"])

        page_2 = self.client.get("/api/v1/clients/?page_size=2&page=2")
        self.assertEqual(len(page_2.data["results"]), 1)
        self.assertIsNone(page_2.data["next"])

    def test_default_and_maximum_page_size(self):
        response = self.client.get("/api/v1/projects/")
        self.assertEqual(response.data["page_size"], 20)
        response = self.client.get("/api/v1/projects/?page_size=500")
        self.assertEqual(response.data["page_size"], 100)

    def test_time_entries_filter_by_client_and_date_range(self):
        TimeEntry.objects.create(
            project=self.alpha, user=self.manager, work_date=self.today,
            recorded_hours=Decimal("2.00"), description="Alpha today",
        )
        TimeEntry.objects.create(
            project=self.alpha, user=self.manager, work_date=self.today - timedelta(days=10),
            recorded_hours=Decimal("3.00"), description="Alpha last week",
        )
        TimeEntry.objects.create(
            project=self.beta, user=self.manager, work_date=self.today,
            recorded_hours=Decimal("4.00"), description="Beta today",
        )

        response = self.client.get(f"/api/v1/time-entries/?client_id={self.acme.id}")
        self.assertEqual(response.data["count"], 2)

        response = self.client.get(
            f"/api/v1/time-entries/?client_id={self.acme.id}&date_from={self.today}"
        )
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["description"], "Alpha today")

        response = self.client.get("/api/v1/time-entries/?search=Beta")
        self.assertEqual(response.data["count"], 1)

    def test_expenses_filter_search_and_ordering(self):
        for project, amount, description in [
            (self.alpha, "50.00", "Figma seats"),
            (self.alpha, "500.00", "Load testing cluster"),
            (self.beta, "75.00", "Client workshop travel"),
        ]:
            Expense.objects.create(
                project=project, user=self.manager, category=ExpenseCategory.OTHER,
                amount=Decimal(amount), description=description, expense_date=self.today,
            )

        response = self.client.get(f"/api/v1/expenses/?client_id={self.apex.id}")
        self.assertEqual(response.data["count"], 1)

        response = self.client.get("/api/v1/expenses/?search=cluster")
        self.assertEqual(response.data["count"], 1)

        response = self.client.get(f"/api/v1/expenses/?project_id={self.alpha.id}&ordering=-amount")
        self.assertEqual([e["amount"] for e in response.data["results"]], ["500.00", "50.00"])

    def test_malformed_filter_values_return_validation_errors(self):
        for url, field in [
            ("/api/v1/time-entries/?date_from=yesterday", "date_from"),
            ("/api/v1/expenses/?project_id=not-a-uuid", "project_id"),
            ("/api/v1/projects/?client_id=123", "client_id"),
        ]:
            response = self.client.get(url)
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, url)
            self.assertEqual(response.data["error"]["code"], "VALIDATION_ERROR")
            self.assertIn(field, [d["field"] for d in response.data["error"]["details"]])

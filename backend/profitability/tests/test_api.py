import uuid
from decimal import Decimal as D

from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from clients.models import Client
from expenses.models import Expense, ExpenseCategory, ExpenseStatus
from projects.models import Project, ProjectAssignment, ProjectStatus
from time_tracking.models import TimeEntry
from users.models import User, UserRole


class FinancialApiTestBase(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.manager = User.objects.create_user(
            email="manager@agency.com", password="ManagerPass123!", role=UserRole.MANAGER,
            default_hourly_cost_rate=D("100.0000"),
        )
        self.developer = User.objects.create_user(
            email="dev@agency.com", password="DevPass123!", role=UserRole.TEAM_MEMBER,
            default_hourly_cost_rate=D("50.0000"),
        )
        self.acme = Client.objects.create(name="Acme Corp", created_by=self.manager)
        self.today = timezone.now().date()

    def project(self, name, *, remaining="40.00", currency="USD", status_=ProjectStatus.ACTIVE,
                archived=False, revenue="10000.00", budget="6000.00"):
        return Project.objects.create(
            client=self.acme, name=name, contract_revenue=D(revenue), planned_cost_budget=D(budget),
            planned_hourly_cost=D("50.0000"),
            estimated_remaining_hours=D(remaining) if remaining is not None else None,
            currency=currency, status=status_, is_archived=archived, created_by=self.manager,
        )

    def log_cost(self, project, total):
        """Logs labor at the manager's $100/hr in ≤ 20 h entries."""
        remaining = D(total) / D("100")
        while remaining > 0:
            hours = min(remaining, D("20"))
            TimeEntry.objects.create(
                project=project, user=self.manager, work_date=self.today,
                recorded_hours=hours, description="Delivery",
            )
            remaining -= hours

    def expense(self, project, amount, status_=ExpenseStatus.PENDING):
        extra = {} if status_ == ExpenseStatus.PENDING else {"reviewed_by": self.manager, "reviewed_at": timezone.now()}
        if status_ == ExpenseStatus.REJECTED:
            extra["review_note"] = "Not billable."
        Expense.objects.create(
            project=project, user=self.manager, category=ExpenseCategory.OTHER, amount=D(amount),
            description="Licence", expense_date=self.today, status=status_, **extra,
        )


class ProjectFinancialSummaryApiTests(FinancialApiTestBase):
    def test_complete_forecast_matches_scenario_1(self):
        project = self.project("Scenario 1")
        self.log_cost(project, "1500.00")
        self.expense(project, "500.00", ExpenseStatus.APPROVED)
        self.expense(project, "120.00", ExpenseStatus.PENDING)
        self.expense(project, "80.00", ExpenseStatus.REJECTED)

        self.api.force_authenticate(self.manager)
        response = self.api.get(f"/api/v1/projects/{project.id}/financial-summary/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()

        self.assertEqual(data["project_id"], str(project.id))
        self.assertEqual(data["currency"], "USD")
        self.assertEqual(data["baselines"], {
            "contract_revenue": "10000.00", "planned_cost_budget": "6000.00",
            "planned_hourly_cost_rate": "50.0000", "estimated_remaining_hours": "40.00",
            "expected_remaining_expenses": "0.00", "planned_profit": "4000.00",
            "planned_margin_percentage": "40.00",
        })
        self.assertEqual(data["actuals"], {
            "total_hours_logged": "15.00", "actual_labor_cost": "1500.00",
            "approved_expense_cost": "500.00", "actual_total_cost": "2000.00",
            "pending_expense_cost": "120.00", "pending_expense_count": 1,
            "rejected_expense_cost": "80.00", "budget_consumption_percentage": "33.33",
        })
        self.assertEqual(data["forecast"], {
            "forecast_available": True, "estimated_remaining_labor_cost": "2000.00",
            "projected_final_cost": "4000.00", "projected_cost_variance": "-2000.00",
            "projected_profit": "6000.00", "projected_profit_margin_percentage": "60.00",
            "reason_unavailable": None,
        })
        self.assertEqual(data["risk"]["status"], "healthy")
        self.assertEqual(data["risk"]["rule"], 4)
        self.assertEqual(len(data["risk"]["reasons"]), 2)
        self.assertEqual(data["metadata"]["warning_threshold_percentage"], "80.00")

    def test_missing_estimate_suppresses_forecast(self):
        project = self.project("No estimate", remaining=None)
        self.log_cost(project, "2000.00")

        self.api.force_authenticate(self.manager)
        data = self.api.get(f"/api/v1/projects/{project.id}/financial-summary/").json()
        self.assertIsNone(data["baselines"]["estimated_remaining_hours"])
        self.assertEqual(data["actuals"]["budget_consumption_percentage"], "33.33")
        self.assertFalse(data["forecast"]["forecast_available"])
        for key in ("estimated_remaining_labor_cost", "projected_final_cost", "projected_profit",
                    "projected_profit_margin_percentage", "projected_cost_variance"):
            self.assertIsNone(data["forecast"][key], key)
        self.assertIn("null", data["forecast"]["reason_unavailable"])
        self.assertEqual(data["risk"]["status"], "insufficient_data")

    def test_over_budget(self):
        project = self.project("Overrun", remaining=None)
        self.log_cost(project, "6200.00")

        self.api.force_authenticate(self.manager)
        data = self.api.get(f"/api/v1/projects/{project.id}/financial-summary/").json()
        self.assertEqual(data["risk"]["status"], "over_budget")
        self.assertEqual(data["actuals"]["budget_consumption_percentage"], "103.33")

    def test_permissions_and_not_found(self):
        project = self.project("Guarded")
        ProjectAssignment.objects.create(project=project, user=self.developer, assigned_by=self.manager)
        url = f"/api/v1/projects/{project.id}/financial-summary/"

        response = self.api.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.json()["error"]["code"], "NOT_AUTHENTICATED")

        # Even an assigned team member cannot see financials
        self.api.force_authenticate(self.developer)
        response = self.api.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.json()["error"]["code"], "PERMISSION_DENIED")

        self.api.force_authenticate(self.manager)
        for bad_id in (uuid.uuid4(), "not-a-uuid"):
            response = self.api.get(f"/api/v1/projects/{bad_id}/financial-summary/")
            self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
            self.assertEqual(response.json()["error"]["code"], "NOT_FOUND")

    def test_fixed_query_count(self):
        project = self.project("Busy")
        self.log_cost(project, "4000.00")
        for _ in range(5):
            self.expense(project, "10.00", ExpenseStatus.APPROVED)

        self.api.force_authenticate(self.manager)
        with self.assertNumQueries(3):  # project + time entries + expenses
            self.api.get(f"/api/v1/projects/{project.id}/financial-summary/")


class ProjectFinancialSummaryListApiTests(FinancialApiTestBase):
    def test_paginated_list_with_filters(self):
        alpha = self.project("Alpha")
        beta = self.project("Beta", status_=ProjectStatus.ON_HOLD)
        self.project("Gamma")
        self.log_cost(alpha, "1000.00")

        self.api.force_authenticate(self.manager)
        response = self.api.get("/api/v1/projects/financial-summaries/?page_size=2")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["count"], 3)
        self.assertEqual(len(data["results"]), 2)
        self.assertIsNotNone(data["next"])

        data = self.api.get("/api/v1/projects/financial-summaries/?status=on_hold").json()
        self.assertEqual([r["project_id"] for r in data["results"]], [str(beta.id)])

        data = self.api.get("/api/v1/projects/financial-summaries/?search=Alpha").json()
        self.assertEqual(data["count"], 1)
        self.assertEqual(data["results"][0]["actuals"]["actual_total_cost"], "1000.00")

    def test_query_count_does_not_grow_with_projects(self):
        for i in range(6):
            p = self.project(f"P{i}")
            self.log_cost(p, "100.00")
            self.expense(p, "5.00", ExpenseStatus.APPROVED)

        self.api.force_authenticate(self.manager)
        with self.assertNumQueries(4):  # count + page + time entries + expenses
            response = self.api.get("/api/v1/projects/financial-summaries/")
        self.assertEqual(response.json()["count"], 6)

    def test_team_member_forbidden(self):
        self.api.force_authenticate(self.developer)
        response = self.api.get("/api/v1/projects/financial-summaries/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_route_is_not_captured_by_project_detail(self):
        self.api.force_authenticate(self.manager)
        response = self.api.get("/api/v1/projects/financial-summaries/")
        self.assertIn("results", response.json())


class DashboardSummaryApiTests(FinancialApiTestBase):
    def test_portfolio_totals_cover_active_projects_in_one_currency(self):
        healthy = self.project("Healthy")
        self.log_cost(healthy, "2000.00")
        self.expense(healthy, "300.00", ExpenseStatus.PENDING)

        at_risk = self.project("At risk", remaining="50.00")
        self.log_cost(at_risk, "4000.00")

        over = self.project("Over", remaining=None)
        self.log_cost(over, "6200.00")

        # Excluded: not active, archived, other currency
        excluded = [
            self.project("Planning", status_=ProjectStatus.PLANNING),
            self.project("Archived", archived=True),
            self.project("Euro", currency="EUR"),
        ]
        for p in excluded:
            self.log_cost(p, "9000.00")
            self.expense(p, "999.00", ExpenseStatus.PENDING)

        self.api.force_authenticate(self.manager)
        response = self.api.get("/api/v1/dashboard/summary/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), {
            "currency": "USD",
            "active_projects_count": 3,
            "total_contract_revenue": "30000.00",
            "total_planned_cost_budget": "18000.00",
            "total_actual_cost_to_date": "12200.00",
            "portfolio_budget_consumption_percentage": "67.78",
            "projects_at_risk_count": 1,
            "projects_over_budget_count": 1,
            "risk_counts": {"healthy": 1, "at_risk": 1, "over_budget": 1, "insufficient_data": 0},
            "forecastable_projects_count": 2,
            "total_projected_final_cost": "10500.00",
            "aggregate_projected_margin_percentage": "47.50",
            "pending_expenses_count": 1,
            "pending_expenses_amount": "300.00",
        })

    def test_currency_parameter(self):
        euro = self.project("Euro", currency="EUR")
        self.log_cost(euro, "1000.00")

        self.api.force_authenticate(self.manager)
        data = self.api.get("/api/v1/dashboard/summary/?currency=eur").json()
        self.assertEqual(data["currency"], "EUR")
        self.assertEqual(data["active_projects_count"], 1)
        self.assertEqual(data["total_actual_cost_to_date"], "1000.00")

        response = self.api.get("/api/v1/dashboard/summary/?currency=dollars")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.json()["error"]["details"][0]["field"], "currency")

    def test_empty_portfolio(self):
        self.api.force_authenticate(self.manager)
        data = self.api.get("/api/v1/dashboard/summary/").json()
        self.assertEqual(data["active_projects_count"], 0)
        self.assertIsNone(data["portfolio_budget_consumption_percentage"])
        self.assertIsNone(data["aggregate_projected_margin_percentage"])

    def test_team_member_forbidden(self):
        self.api.force_authenticate(self.developer)
        response = self.api.get("/api/v1/dashboard/summary/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

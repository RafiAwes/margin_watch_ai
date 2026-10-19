from decimal import Decimal as D

from django.test import TestCase, override_settings
from django.utils import timezone

from clients.models import Client
from expenses.models import Expense, ExpenseCategory, ExpenseStatus
from profitability.selectors import load_financial_inputs, summarize_projects
from profitability.services import RiskStatus
from projects.models import Project
from time_tracking.models import TimeEntry
from users.models import User, UserRole


class SelectorTests(TestCase):
    def setUp(self):
        self.manager = User.objects.create_user(
            email="manager@agency.com", password="ManagerPass123!", role=UserRole.MANAGER,
            default_hourly_cost_rate=D("62.5000"),
        )
        self.client_obj = Client.objects.create(name="Acme Corp", created_by=self.manager)
        self.today = timezone.now().date()
        self.projects = [
            Project.objects.create(
                client=self.client_obj, name=f"Project {i}", contract_revenue=D("10000.00"),
                planned_cost_budget=D("6000.00"), planned_hourly_cost=D("50.0000"),
                estimated_remaining_hours=D("40.00"), created_by=self.manager,
            )
            for i in range(3)
        ]

    def log(self, project, hours):
        return TimeEntry.objects.create(
            project=project, user=self.manager, work_date=self.today,
            recorded_hours=D(hours), description="Delivery work",
        )

    def expense(self, project, amount, status):
        extra = {}
        if status != ExpenseStatus.PENDING:
            extra = {"reviewed_by": self.manager, "reviewed_at": timezone.now()}
        if status == ExpenseStatus.REJECTED:
            extra["review_note"] = "Out of scope."
        return Expense.objects.create(
            project=project, user=self.manager, category=ExpenseCategory.OTHER,
            amount=D(amount), description="Licence", expense_date=self.today, status=status, **extra,
        )

    def test_fixed_query_count_regardless_of_project_count(self):
        for project in self.projects:
            self.log(project, "2.00")
            self.expense(project, "100.00", ExpenseStatus.APPROVED)

        with self.assertNumQueries(2):
            load_financial_inputs(self.projects)

        with self.assertNumQueries(3):
            summarize_projects(Project.objects.filter(id__in=[p.id for p in self.projects]))

    def test_only_approved_expenses_reach_actual_cost(self):
        project = self.projects[0]
        self.expense(project, "1000.00", ExpenseStatus.APPROVED)
        self.expense(project, "500.00", ExpenseStatus.PENDING)
        self.expense(project, "200.00", ExpenseStatus.REJECTED)

        [(_, summary)] = summarize_projects([project])
        self.assertEqual(summary.approved_expense_cost, D("1000.00"))
        self.assertEqual(summary.actual_total_cost, D("1000.00"))
        self.assertEqual(summary.pending_expense_cost, D("500.00"))
        self.assertEqual(summary.pending_expense_count, 1)
        self.assertEqual(summary.rejected_expense_cost, D("200.00"))

    def test_labor_cost_reconciles_with_time_entry_ledger(self):
        project = self.projects[0]
        entries = [self.log(project, h) for h in ("1.33", "1.33", "7.25")]

        [(_, summary)] = summarize_projects([project])
        ledger_total = sum(e.computed_cost for e in entries)
        self.assertEqual(summary.actual_labor_cost, ledger_total)
        self.assertEqual(summary.actual_labor_cost, D("619.39"))  # 83.13 + 83.13 + 453.13
        self.assertEqual(summary.total_hours_logged, D("9.91"))

    def test_rate_snapshot_protects_history_from_rate_changes(self):
        project = self.projects[0]
        self.log(project, "10.00")  # 10 h × $62.50 = $625.00

        self.manager.default_hourly_cost_rate = D("200.0000")
        self.manager.save()

        [(_, summary)] = summarize_projects([project])
        self.assertEqual(summary.actual_labor_cost, D("625.00"))

    def test_project_without_activity(self):
        [(_, summary)] = summarize_projects([self.projects[1]])
        self.assertEqual(summary.actual_total_cost, D("0.00"))
        self.assertEqual(summary.risk.status, RiskStatus.HEALTHY)

    @override_settings(MARGINWATCH_CONSUMPTION_WARNING_PCT=None)
    def test_warning_threshold_comes_from_settings(self):
        project = self.projects[0]
        self.expense(project, "4900.00", ExpenseStatus.APPROVED)
        project.estimated_remaining_hours = D("10.00")
        project.save()

        [(_, summary)] = summarize_projects([project])
        self.assertIsNone(summary.warning_threshold_percentage)
        self.assertEqual(summary.risk.status, RiskStatus.HEALTHY)

        with self.settings(MARGINWATCH_CONSUMPTION_WARNING_PCT=D("80.00")):
            [(_, summary)] = summarize_projects([project])
            self.assertEqual(summary.risk.status, RiskStatus.AT_RISK)

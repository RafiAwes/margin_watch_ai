import json
from decimal import Decimal as D

from django.test import TestCase
from django.utils import timezone

from ai_advisor.context import CONTEXT_KEYS, build_context, project_code
from clients.models import Client
from expenses.models import Expense, ExpenseCategory, ExpenseStatus
from profitability.selectors import summarize_projects
from projects.models import Project
from time_tracking.models import TimeEntry
from users.models import User, UserRole


class ContextSanitizationTests(TestCase):
    def setUp(self):
        self.manager = User.objects.create_user(
            email="sarah.connor@agency.com", password="ManagerPass123!", role=UserRole.MANAGER,
            first_name="Sarah", last_name="Connor", default_hourly_cost_rate=D("100.0000"),
        )
        self.developer = User.objects.create_user(
            email="alex.mercer@agency.com", password="DevPass123!", role=UserRole.TEAM_MEMBER,
            first_name="Alex", last_name="Mercer", default_hourly_cost_rate=D("73.5000"),
        )
        client = Client.objects.create(
            name="Acme Secret Holdings", contact_name="Jane Client",
            contact_email="jane@acme-secret.com", created_by=self.manager,
        )
        self.project = Project.objects.create(
            client=client, name="Project Nightingale", description="Confidential merger portal",
            contract_revenue=D("45000.00"), planned_cost_budget=D("28000.00"),
            planned_hourly_cost=D("75.0000"), estimated_remaining_hours=D("140.00"),
            created_by=self.manager,
        )
        today = timezone.now().date()
        TimeEntry.objects.create(
            project=self.project, user=self.developer, work_date=today,
            recorded_hours=D("8.00"), description="Integrated the Nightingale SSO flow",
        )
        Expense.objects.create(
            project=self.project, user=self.developer, category=ExpenseCategory.SOFTWARE_LICENSE,
            amount=D("450.00"), description="Figma seats for Alex", expense_date=today,
            status=ExpenseStatus.PENDING,
        )
        [(_, self.summary)] = summarize_projects([self.project])

    def test_only_allow_listed_keys(self):
        context = build_context(self.project, self.summary)
        self.assertEqual(tuple(context), CONTEXT_KEYS)

    def test_no_personal_or_client_identifying_data(self):
        payload = json.dumps(build_context(self.project, self.summary))
        for forbidden in (
            "Sarah", "Connor", "Alex", "Mercer", "sarah.connor@agency.com", "alex.mercer@agency.com",
            "Acme", "Jane", "jane@acme-secret.com", "Nightingale", "Confidential merger portal",
            "Figma seats", "SSO flow", "73.5",  # an individual's personal rate
            str(self.project.id), str(self.developer.id),
        ):
            self.assertNotIn(forbidden, payload, forbidden)

    def test_values_match_the_deterministic_summary(self):
        context = build_context(self.project, self.summary)
        self.assertEqual(context["project_code"], project_code(self.project.id))
        self.assertTrue(context["project_code"].startswith("PRJ-"))
        self.assertEqual(context["contract_revenue"], "45000.00")
        self.assertEqual(context["actual_labor_cost"], "588.00")  # 8 h × $73.50 snapshot
        self.assertEqual(context["planned_hourly_cost_rate"], "75.0000")
        self.assertEqual(context["pending_expenses_count"], 1)
        self.assertEqual(context["pending_expenses_total"], "450.00")
        self.assertEqual(context["deterministic_status"], self.summary.risk.status)
        self.assertEqual(context["deterministic_reasons"], list(self.summary.risk.reasons))

    def test_missing_estimate_is_sent_as_null(self):
        self.project.estimated_remaining_hours = None
        self.project.save()
        [(_, summary)] = summarize_projects([self.project])
        context = build_context(self.project, summary)
        self.assertIsNone(context["estimated_remaining_hours"])
        self.assertIsNone(context["projected_final_cost"])
        self.assertEqual(context["deterministic_status"], "insufficient_data")

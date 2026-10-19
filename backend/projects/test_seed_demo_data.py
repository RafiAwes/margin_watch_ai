from datetime import timedelta
from decimal import Decimal as D
from io import StringIO

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase
from django.utils import timezone

from clients.models import Client
from expenses.models import Expense, ExpenseStatus
from profitability.selectors import summarize_projects
from projects.management.commands.seed_demo_data import DEMO_DOMAIN, DEMO_TAG
from projects.models import Project, ProjectAssignment
from time_tracking.models import TimeEntry
from users.models import User, UserRole


class SeedDemoDataTests(TestCase):
    """Runs the generator at 'tiny' scale and checks the data is valid, realistic and removable."""

    def seed(self, *args):
        out = StringIO()
        call_command("seed_demo_data", "--scale", "tiny", *args, stdout=out)
        return out.getvalue()

    def setUp(self):
        # Pre-existing real data that must survive --delete
        self.real_manager = User.objects.create_user(
            email="manager@agency.com", password="ManagerPass123!", role=UserRole.MANAGER,
        )
        self.real_client = Client.objects.create(name="Real Customer Ltd", created_by=self.real_manager)
        self.real_project = Project.objects.create(
            client=self.real_client, name="Real project", contract_revenue=D("1000"),
            planned_cost_budget=D("800"), planned_hourly_cost=D("50"), created_by=self.real_manager,
        )

    def test_generates_valid_tagged_data(self):
        output = self.seed()
        self.assertIn("Demo agency data created", output)

        users = User.objects.filter(email__endswith=DEMO_DOMAIN)
        self.assertEqual(users.filter(role=UserRole.MANAGER).count(), 1)
        self.assertEqual(users.filter(role=UserRole.TEAM_MEMBER).count(), 6)
        self.assertTrue(users.filter(is_active=False).exists())  # former employees
        self.assertTrue(users.first().check_password("DemoPass123!"))

        projects = Project.objects.filter(client__notes__startswith=DEMO_TAG)
        self.assertEqual(projects.count(), 8)
        entries = TimeEntry.objects.filter(project__in=projects)
        self.assertGreater(entries.count(), 50)

        today = timezone.now().date()
        for entry in entries:
            entry.full_clean()  # hours 0.01–24, date not in the future, snapshot ≥ 0
            self.assertLessEqual(entry.work_date, today)
        for expense in Expense.objects.filter(project__in=projects):
            expense.full_clean()
            if expense.status == ExpenseStatus.REJECTED:
                self.assertTrue(expense.review_note)
            if expense.status != ExpenseStatus.PENDING:
                self.assertIsNotNone(expense.reviewed_by)
                self.assertGreaterEqual(expense.reviewed_at.date(), expense.expense_date)
        for project in projects:
            project.full_clean()
            # every time entry is logged by someone assigned to the project
            assigned = set(ProjectAssignment.objects.filter(project=project).values_list("user_id", flat=True))
            self.assertTrue(set(entries.filter(project=project).values_list("user_id", flat=True)) <= assigned)

        # No one logs more than 9 hours on a single day across projects
        per_day = {}
        for user_id, day, hours in entries.values_list("user_id", "work_date", "recorded_hours"):
            per_day[(user_id, day)] = per_day.get((user_id, day), D("0")) + hours
        self.assertLessEqual(max(per_day.values()), D("9"))

        # Former employees log nothing after leaving; nothing of theirs is in the future
        self.assertFalse(entries.filter(work_date__gt=today + timedelta(days=1)).exists())

    def test_engine_reconciles_and_snapshots_vary(self):
        self.seed()
        projects = Project.objects.filter(client__notes__startswith=DEMO_TAG)
        for project, summary in summarize_projects(projects):
            ledger = sum((e.computed_cost for e in project.time_entries.all()), D("0.00"))
            self.assertEqual(summary.actual_labor_cost, ledger)
        # At least one person has two different rate snapshots (a raise during the history)
        snapshots = TimeEntry.objects.filter(project__in=projects).values_list("user_id", "hourly_cost_snapshot").distinct()
        users = [u for u, _ in snapshots]
        self.assertGreater(len(users), len(set(users)))

    def test_deterministic_for_a_seed(self):
        self.seed("--seed", "7")
        first = (TimeEntry.objects.count(), Expense.objects.count(),
                 sorted(Project.objects.filter(client__notes__startswith=DEMO_TAG).values_list("planned_cost_budget", flat=True)))
        self.seed("--seed", "7", "--reset")
        second = (TimeEntry.objects.count(), Expense.objects.count(),
                  sorted(Project.objects.filter(client__notes__startswith=DEMO_TAG).values_list("planned_cost_budget", flat=True)))
        self.assertEqual(first, second)

    def test_refuses_to_duplicate_and_delete_keeps_real_data(self):
        self.seed()
        with self.assertRaises(CommandError):
            self.seed()

        output = self.seed("--delete")
        self.assertIn("Deleted demo data", output)
        self.assertFalse(User.objects.filter(email__endswith=DEMO_DOMAIN).exists())
        self.assertFalse(Client.objects.filter(notes__startswith=DEMO_TAG).exists())
        self.assertEqual(TimeEntry.objects.count(), 0)
        # Real data untouched
        self.assertTrue(User.objects.filter(pk=self.real_manager.pk).exists())
        self.assertTrue(Project.objects.filter(pk=self.real_project.pk).exists())
        self.assertTrue(Client.objects.filter(pk=self.real_client.pk).exists())

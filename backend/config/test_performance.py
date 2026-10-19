"""
Query-count and aggregate tests for DEC-008 (performance at realistic volume).
"""

from decimal import Decimal as D

from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from clients.models import Client
from expenses.models import Expense, ExpenseCategory, ExpenseStatus
from projects.models import Project, ProjectAssignment
from time_tracking.models import TimeEntry
from users.models import User, UserRole


class PerformanceTestBase(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.manager = User.objects.create_user(
            email="manager@agency.com", password="ManagerPass123!", role=UserRole.MANAGER,
            default_hourly_cost_rate=D("62.5000"),
        )
        self.dev = User.objects.create_user(
            email="dev@agency.com", password="DevPass123!", role=UserRole.TEAM_MEMBER,
            default_hourly_cost_rate=D("50.0000"),
        )
        self.today = timezone.now().date()

    def make_projects(self, n, start=0):
        client = Client.objects.create(name=f"Client {start}-{n}", created_by=self.manager)
        projects = []
        for i in range(start, start + n):
            p = Project.objects.create(
                client=client, name=f"P{i}", contract_revenue=D("1000"), planned_cost_budget=D("800"),
                planned_hourly_cost=D("50"), created_by=self.manager,
            )
            ProjectAssignment.objects.create(project=p, user=self.dev, assigned_by=self.manager)
            ProjectAssignment.objects.create(project=p, user=self.manager, assigned_by=self.manager)
            projects.append(p)
        return projects

    def query_count(self, url):
        with CaptureQueriesContext(connection) as q:
            response = self.api.get(url)
        self.assertEqual(response.status_code, 200)
        return len(q.captured_queries), response.json()


class NPlusOneTests(PerformanceTestBase):
    def test_project_list_queries_do_not_grow_with_rows(self):
        self.api.force_authenticate(self.manager)
        self.make_projects(2)
        small, _ = self.query_count("/api/v1/projects/")
        self.make_projects(8, start=2)
        large, data = self.query_count("/api/v1/projects/")
        self.assertEqual(data["count"], 10)
        self.assertEqual(small, large)
        self.assertLessEqual(large, 3)  # count + page + prefetched assignments
        # Prefetched values are still correct
        self.assertEqual(sorted(data["results"][0]["assigned_member_ids"]), sorted([str(self.dev.id), str(self.manager.id)]))

    def test_team_member_project_list_is_also_constant(self):
        self.api.force_authenticate(self.dev)
        self.make_projects(2)
        small, _ = self.query_count("/api/v1/projects/")
        self.make_projects(6, start=2)
        large, data = self.query_count("/api/v1/projects/")
        self.assertEqual(data["count"], 8)
        self.assertEqual(small, large)

    def test_client_list_queries_do_not_grow_with_rows(self):
        self.api.force_authenticate(self.manager)
        self.make_projects(3)
        small, _ = self.query_count("/api/v1/clients/")
        for i in range(6):
            self.make_projects(i % 3 + 1, start=100 + i * 10)
        large, data = self.query_count("/api/v1/clients/")
        self.assertEqual(small, large)
        self.assertLessEqual(large, 2)  # count + page (annotated counts, joined creator)
        counts = {c["name"]: c["projects_count"] for c in data["results"]}
        self.assertEqual(counts["Client 0-3"], 3)
        self.assertEqual(counts["Client 150-3"], 3)


class SummaryEndpointTests(PerformanceTestBase):
    def setUp(self):
        super().setUp()
        self.alpha, self.beta = self.make_projects(2)
        for project, user, hours in [
            (self.alpha, self.dev, "2.00"), (self.alpha, self.dev, "1.33"),
            (self.alpha, self.manager, "1.33"), (self.beta, self.dev, "4.00"),
        ]:
            TimeEntry.objects.create(project=project, user=user, work_date=self.today,
                                     recorded_hours=D(hours), description="Work")
        for amount, status, note in [("100.00", ExpenseStatus.PENDING, ""),
                                     ("250.00", ExpenseStatus.APPROVED, ""),
                                     ("40.00", ExpenseStatus.REJECTED, "No receipt.")]:
            extra = {} if status == ExpenseStatus.PENDING else {"reviewed_by": self.manager, "reviewed_at": timezone.now()}
            Expense.objects.create(project=self.alpha, user=self.dev, category=ExpenseCategory.OTHER,
                                   amount=D(amount), description="Item", expense_date=self.today,
                                   status=status, review_note=note, **extra)

    def test_time_entry_summary_for_manager(self):
        self.api.force_authenticate(self.manager)
        data = self.api.get("/api/v1/time-entries/summary/").json()
        self.assertEqual(data["count"], 4)
        self.assertEqual(data["total_hours"], "8.66")
        # 2×50 + 1.33×50 + 1.33×62.50 (83.125 → 83.13) + 4×50 = 449.63
        self.assertEqual(data["total_labor_cost"], "449.63")
        by_project = {r["project_id"]: r for r in data["by_project"]}
        self.assertEqual(by_project[str(self.alpha.id)], {"project_id": str(self.alpha.id), "count": 3, "hours": "4.66"})

        data = self.api.get(f"/api/v1/time-entries/summary/?project_id={self.beta.id}").json()
        self.assertEqual((data["count"], data["total_hours"]), (1, "4.00"))

        data = self.api.get(f"/api/v1/time-entries/summary/?user_id={self.manager.id}").json()
        self.assertEqual((data["count"], data["total_hours"]), (1, "1.33"))

    def test_time_entry_summary_for_team_member_is_scoped_and_masked(self):
        self.api.force_authenticate(self.dev)
        data = self.api.get("/api/v1/time-entries/summary/").json()
        self.assertEqual(data["count"], 3)
        self.assertEqual(data["total_hours"], "7.33")
        self.assertNotIn("total_labor_cost", data)

    def test_expense_summary(self):
        self.api.force_authenticate(self.manager)
        data = self.api.get("/api/v1/expenses/summary/").json()
        self.assertEqual(data["count"], 3)
        self.assertEqual(data["by_status"]["PENDING"], {"count": 1, "amount": "100.00"})
        self.assertEqual(data["by_status"]["APPROVED"], {"count": 1, "amount": "250.00"})
        self.assertEqual(data["by_status"]["REJECTED"], {"count": 1, "amount": "40.00"})

        data = self.api.get(f"/api/v1/expenses/summary/?project_id={self.beta.id}").json()
        self.assertEqual(data["count"], 0)
        self.assertEqual(data["by_status"]["PENDING"], {"count": 0, "amount": "0.00"})

    def test_summaries_require_authentication(self):
        self.assertEqual(self.api.get("/api/v1/time-entries/summary/").status_code, 401)
        self.assertEqual(self.api.get("/api/v1/expenses/summary/").status_code, 401)


class StablePagingTests(PerformanceTestBase):
    """Paging through rows that tie on the sort key must return every row exactly once."""

    def test_time_entries_with_identical_dates_page_without_duplicates(self):
        [project] = self.make_projects(1)
        TimeEntry.objects.bulk_create([  # bulk insert → identical work_date and created_at
            TimeEntry(project=project, user=self.dev, work_date=self.today, recorded_hours=D("1.00"),
                      hourly_cost_snapshot=D("50.0000"), description=f"Task {i}")
            for i in range(30)
        ])
        self.api.force_authenticate(self.manager)
        seen, page = [], 1
        while True:
            data = self.api.get(f"/api/v1/time-entries/?ordering=-work_date&page_size=7&page={page}").json()
            seen += [row["id"] for row in data["results"]]
            if not data["next"]:
                break
            page += 1
        self.assertEqual(len(seen), 30)
        self.assertEqual(len(set(seen)), 30)

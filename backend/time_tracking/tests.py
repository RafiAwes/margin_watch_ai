from datetime import timedelta
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from django.db.models.deletion import ProtectedError
from django.core.exceptions import ValidationError
from rest_framework.test import APIClient
from rest_framework import status

from users.models import User, UserRole
from clients.models import Client
from projects.models import Project, ProjectAssignment, ProjectStatus
from time_tracking.models import TimeEntry


class TimeEntryModelTests(TestCase):
    def setUp(self):
        self.manager = User.objects.create_user(
            email="manager@agency.com",
            password="ManagerPass123!",
            first_name="Sarah",
            last_name="Connor",
            role=UserRole.MANAGER,
            default_hourly_cost_rate=Decimal("125.0000"),
        )
        self.developer = User.objects.create_user(
            email="dev@agency.com",
            password="DevPass123!",
            first_name="Alex",
            last_name="Mercer",
            role=UserRole.TEAM_MEMBER,
            default_hourly_cost_rate=Decimal("65.0000"),
        )
        self.client_obj = Client.objects.create(
            name="Acme Corp",
            created_by=self.manager,
        )
        self.project = Project.objects.create(
            client=self.client_obj,
            name="Cloud Platform",
            contract_revenue=Decimal("50000.00"),
            planned_cost_budget=Decimal("30000.00"),
            planned_hourly_cost=Decimal("100.0000"),
            created_by=self.manager,
        )
        self.today = timezone.now().date()

    def test_time_entry_creation_and_rate_snapshotting(self):
        entry = TimeEntry.objects.create(
            project=self.project,
            user=self.developer,
            work_date=self.today,
            recorded_hours=Decimal("4.50"),
            description="Built API views",
        )
        # Snapshot should automatically match developer rate (65.0000)
        self.assertEqual(entry.hourly_cost_snapshot, Decimal("65.0000"))
        # Computed cost = 4.5 * 65 = 292.50
        self.assertEqual(entry.computed_cost, Decimal("292.50"))

    def test_hourly_cost_snapshot_is_permanently_immutable(self):
        entry = TimeEntry.objects.create(
            project=self.project,
            user=self.developer,
            work_date=self.today,
            recorded_hours=Decimal("4.00"),
            description="Testing immutability",
        )
        self.assertEqual(entry.hourly_cost_snapshot, Decimal("65.0000"))

        # Subsequent change to developer default rate must NOT affect historical snapshot
        self.developer.default_hourly_cost_rate = Decimal("95.0000")
        self.developer.save()

        entry.refresh_from_db()
        self.assertEqual(entry.hourly_cost_snapshot, Decimal("65.0000"))

        # Manual attempt to update snapshot on entry is blocked
        entry.hourly_cost_snapshot = Decimal("150.0000")
        entry.description = "Updated description"
        entry.save()

        entry.refresh_from_db()
        self.assertEqual(entry.hourly_cost_snapshot, Decimal("65.0000"))
        self.assertEqual(entry.description, "Updated description")

    def test_recorded_hours_boundary_validations(self):
        # 0.00 hours must fail
        with self.assertRaises(ValidationError):
            TimeEntry.objects.create(
                project=self.project,
                user=self.developer,
                work_date=self.today,
                recorded_hours=Decimal("0.00"),
                description="Zero hours",
            )

        # > 24.00 hours must fail
        with self.assertRaises(ValidationError):
            TimeEntry.objects.create(
                project=self.project,
                user=self.developer,
                work_date=self.today,
                recorded_hours=Decimal("24.50"),
                description="Too many hours",
            )

    def test_future_work_date_validation(self):
        # 2 days in the future must fail
        future_date = self.today + timedelta(days=2)
        with self.assertRaises(ValidationError):
            TimeEntry.objects.create(
                project=self.project,
                user=self.developer,
                work_date=future_date,
                recorded_hours=Decimal("4.00"),
                description="Far future date",
            )

    def test_cascade_deletion_protection(self):
        TimeEntry.objects.create(
            project=self.project,
            user=self.developer,
            work_date=self.today,
            recorded_hours=Decimal("2.00"),
            description="Deletion check",
        )
        # Attempting to delete Project must raise ProtectedError
        with self.assertRaises(ProtectedError):
            self.project.delete()

        # Attempting to delete User must raise ProtectedError
        with self.assertRaises(ProtectedError):
            self.developer.delete()


class TimeEntryAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.manager = User.objects.create_user(
            email="manager@agency.com",
            password="ManagerPass123!",
            first_name="Sarah",
            last_name="Connor",
            role=UserRole.MANAGER,
            default_hourly_cost_rate=Decimal("125.0000"),
        )
        self.assigned_dev = User.objects.create_user(
            email="dev1@agency.com",
            password="DevPass123!",
            first_name="Alex",
            last_name="Mercer",
            role=UserRole.TEAM_MEMBER,
            default_hourly_cost_rate=Decimal("65.0000"),
        )
        self.unassigned_dev = User.objects.create_user(
            email="dev2@agency.com",
            password="DevPass123!",
            first_name="Elena",
            last_name="Rostova",
            role=UserRole.TEAM_MEMBER,
            default_hourly_cost_rate=Decimal("70.0000"),
        )
        self.client_obj = Client.objects.create(
            name="Acme Corp",
            created_by=self.manager,
        )
        self.project = Project.objects.create(
            client=self.client_obj,
            name="Cloud Platform",
            contract_revenue=Decimal("50000.00"),
            planned_cost_budget=Decimal("30000.00"),
            planned_hourly_cost=Decimal("100.0000"),
            created_by=self.manager,
        )
        # Assign dev1
        ProjectAssignment.objects.create(
            project=self.project,
            user=self.assigned_dev,
            assigned_by=self.manager,
            is_active=True,
        )
        self.today = timezone.now().date()

    def test_assigned_team_member_can_log_time(self):
        self.client.force_authenticate(user=self.assigned_dev)
        response = self.client.post(
            "/api/v1/time-entries/",
            {
                "project_id": str(self.project.id),
                "work_date": str(self.today),
                "recorded_hours": "3.50",
                "description": "Implemented unit tests",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["recorded_hours"], "3.50")
        self.assertEqual(response.data["project_name"], "Cloud Platform")
        # Masking verification: TEAM_MEMBER must NOT see hourly_cost_snapshot or computed_cost
        self.assertNotIn("hourly_cost_snapshot", response.data)
        self.assertNotIn("computed_cost", response.data)

        # Database verification: backend correctly snapshotted rate
        entry = TimeEntry.objects.get(id=response.data["id"])
        self.assertEqual(entry.hourly_cost_snapshot, Decimal("65.0000"))

    def test_unassigned_team_member_cannot_log_time(self):
        self.client.force_authenticate(user=self.unassigned_dev)
        response = self.client.post(
            "/api/v1/time-entries/",
            {
                "project_id": str(self.project.id),
                "work_date": str(self.today),
                "recorded_hours": "2.00",
                "description": "Unauthorized attempt",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("project_id", [d["field"] for d in response.data["error"]["details"]])

    def test_manager_sees_all_entries_with_rates_and_can_filter(self):
        # Create an entry by assigned_dev
        TimeEntry.objects.create(
            project=self.project,
            user=self.assigned_dev,
            work_date=self.today,
            recorded_hours=Decimal("5.00"),
            description="Feature work",
        )

        self.client.force_authenticate(user=self.manager)
        response = self.client.get("/api/v1/time-entries/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data if isinstance(response.data, list) else response.data.get("results", [])
        self.assertEqual(len(results), 1)
        # Manager MUST see hourly_cost_snapshot and computed_cost
        self.assertIn("hourly_cost_snapshot", results[0])
        self.assertIn("computed_cost", results[0])
        self.assertEqual(results[0]["hourly_cost_snapshot"], "65.0000")
        self.assertEqual(results[0]["computed_cost"], "325.00")

    def test_team_member_is_scoped_to_own_entries_only(self):
        # Entry by dev1
        e1 = TimeEntry.objects.create(
            project=self.project,
            user=self.assigned_dev,
            work_date=self.today,
            recorded_hours=Decimal("3.00"),
            description="Dev1 work",
        )
        # Entry by manager
        e2 = TimeEntry.objects.create(
            project=self.project,
            user=self.manager,
            work_date=self.today,
            recorded_hours=Decimal("2.00"),
            description="Manager architecture",
        )

        self.client.force_authenticate(user=self.assigned_dev)
        response = self.client.get("/api/v1/time-entries/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data if isinstance(response.data, list) else response.data.get("results", [])
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["id"], str(e1.id))

    def test_team_member_cannot_edit_another_members_entry(self):
        other_entry = TimeEntry.objects.create(
            project=self.project,
            user=self.manager,
            work_date=self.today,
            recorded_hours=Decimal("4.00"),
            description="Manager work",
        )
        self.client.force_authenticate(user=self.assigned_dev)
        response = self.client.patch(
            f"/api/v1/time-entries/{other_entry.id}/",
            {"description": "Malicious edit"},
        )
        # Scoped queryset returns 404, or permission returns 403
        self.assertIn(response.status_code, [status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN])

from decimal import Decimal
import datetime
from django.test import TestCase
from django.db import IntegrityError
from django.core.exceptions import ValidationError
from rest_framework.test import APITestCase
from rest_framework import status

from users.models import User, UserRole
from clients.models import Client
from projects.models import Project, ProjectAssignment, ProjectStatus


class ProjectModelTests(TestCase):
    def setUp(self):
        self.manager = User.objects.create_user(
            email="manager@agency.com",
            password="ManagerPass123!",
            first_name="Alice",
            last_name="Manager",
            role=UserRole.MANAGER,
        )
        self.dev = User.objects.create_user(
            email="dev@agency.com",
            password="DevPass123!",
            first_name="Bob",
            last_name="Developer",
            role=UserRole.TEAM_MEMBER,
        )
        self.client = Client.objects.create(name="Acme Corp")

    def test_project_creation_and_clean_validation(self):
        project = Project(
            client=self.client,
            name="Website Redesign",
            contract_revenue=Decimal("45000.00"),
            planned_cost_budget=Decimal("28000.00"),
            planned_hourly_cost=Decimal("75.0000"),
            start_date=datetime.date(2026, 11, 1),
            deadline=datetime.date(2026, 10, 1),  # earlier than start_date
        )
        with self.assertRaises(ValidationError):
            project.clean()

    def test_estimated_remaining_hours_null_preserved(self):
        project = Project.objects.create(
            client=self.client,
            name="Unestimated Project",
            contract_revenue=Decimal("20000.00"),
            planned_cost_budget=Decimal("12000.00"),
            planned_hourly_cost=Decimal("60.0000"),
            estimated_remaining_hours=None,  # true NULL
        )
        project.refresh_from_db()
        self.assertIsNone(project.estimated_remaining_hours)

    def test_project_assignment_unique_constraint(self):
        project = Project.objects.create(
            client=self.client,
            name="Portal App",
            contract_revenue=Decimal("30000.00"),
            planned_cost_budget=Decimal("18000.00"),
            planned_hourly_cost=Decimal("70.0000"),
        )
        ProjectAssignment.objects.create(
            project=project,
            user=self.dev,
            assigned_by=self.manager,
        )
        with self.assertRaises(IntegrityError):
            ProjectAssignment.objects.create(
                project=project,
                user=self.dev,
                assigned_by=self.manager,
            )

    def test_project_deletion_cascades_assignments(self):
        project = Project.objects.create(
            client=self.client,
            name="Temporary Project",
            contract_revenue=Decimal("15000.00"),
            planned_cost_budget=Decimal("10000.00"),
            planned_hourly_cost=Decimal("50.0000"),
        )
        ProjectAssignment.objects.create(project=project, user=self.dev)
        self.assertEqual(ProjectAssignment.objects.count(), 1)
        project.delete()
        self.assertEqual(ProjectAssignment.objects.count(), 0)


class ProjectAPITests(APITestCase):
    def setUp(self):
        self.manager = User.objects.create_user(
            email="manager@agency.com",
            password="ManagerPass123!",
            first_name="Alice",
            last_name="Manager",
            role=UserRole.MANAGER,
        )
        self.dev_assigned = User.objects.create_user(
            email="dev1@agency.com",
            password="DevPass123!",
            first_name="Bob",
            last_name="Developer",
            role=UserRole.TEAM_MEMBER,
        )
        self.dev_unassigned = User.objects.create_user(
            email="dev2@agency.com",
            password="DevPass123!",
            first_name="Charlie",
            last_name="Developer",
            role=UserRole.TEAM_MEMBER,
        )
        self.client_record = Client.objects.create(name="Starlight Corp")
        self.project1 = Project.objects.create(
            client=self.client_record,
            name="Assigned Project Alpha",
            contract_revenue=Decimal("60000.00"),
            planned_cost_budget=Decimal("35000.00"),
            planned_hourly_cost=Decimal("80.0000"),
            created_by=self.manager,
        )
        self.project2 = Project.objects.create(
            client=self.client_record,
            name="Confidential Project Beta",
            contract_revenue=Decimal("100000.00"),
            planned_cost_budget=Decimal("60000.00"),
            planned_hourly_cost=Decimal("95.0000"),
            created_by=self.manager,
        )
        # Assign dev1 to project1 only
        self.assignment = ProjectAssignment.objects.create(
            project=self.project1,
            user=self.dev_assigned,
            assigned_by=self.manager,
        )

    def test_manager_sees_all_projects_with_financial_baselines(self):
        self.client.force_authenticate(user=self.manager)
        response = self.client.get("/api/v1/projects/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = (
            response.data["results"]
            if isinstance(response.data, dict) and "results" in response.data
            else response.data
        )
        self.assertEqual(len(results), 2)
        project_data = next(p for p in results if p["id"] == str(self.project1.id))
        self.assertEqual(project_data["contract_revenue"], "60000.00")
        self.assertEqual(project_data["planned_cost_budget"], "35000.00")
        self.assertEqual(project_data["planned_hourly_cost"], "80.0000")

    def test_team_member_sees_only_assigned_projects(self):
        self.client.force_authenticate(user=self.dev_assigned)
        response = self.client.get("/api/v1/projects/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = (
            response.data["results"]
            if isinstance(response.data, dict) and "results" in response.data
            else response.data
        )
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["id"], str(self.project1.id))

    def test_team_member_has_financial_baselines_strictly_masked(self):
        self.client.force_authenticate(user=self.dev_assigned)
        response = self.client.get(f"/api/v1/projects/{self.project1.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn("contract_revenue", response.data)
        self.assertNotIn("planned_cost_budget", response.data)
        self.assertNotIn("planned_hourly_cost", response.data)
        self.assertNotIn("expected_remaining_expenses", response.data)

    def test_unassigned_team_member_forbidden_from_project_detail(self):
        self.client.force_authenticate(user=self.dev_unassigned)
        response = self.client.get(f"/api/v1/projects/{self.project1.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_manager_can_create_project_with_initial_members(self):
        self.client.force_authenticate(user=self.manager)
        payload = {
            "client_id": self.client_record.id,
            "name": "Cloud Native Migration",
            "contract_revenue": "85000.00",
            "planned_cost_budget": "50000.00",
            "planned_hourly_cost": "85.0000",
            "currency": "USD",
            "estimated_remaining_hours": "300.00",
            "initial_member_ids": [str(self.dev_assigned.id)],
        }
        response = self.client.post("/api/v1/projects/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "Cloud Native Migration")
        self.assertIn(self.dev_assigned.id, response.data["assigned_member_ids"])

    def test_manager_can_assign_and_revoke_team_members(self):
        self.client.force_authenticate(user=self.manager)
        # Assign dev2 to project1
        assign_url = f"/api/v1/projects/{self.project1.id}/assignments/"
        response = self.client.post(
            assign_url,
            {"user_id": str(self.dev_unassigned.id)},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        assignment_id = response.data["id"]

        # Revoke assignment
        revoke_url = f"/api/v1/projects/{self.project1.id}/assignments/{assignment_id}/"
        del_res = self.client.delete(revoke_url)
        self.assertEqual(del_res.status_code, status.HTTP_200_OK)

        # Check that assignment is now inactive
        assignment = ProjectAssignment.objects.get(id=assignment_id)
        self.assertFalse(assignment.is_active)

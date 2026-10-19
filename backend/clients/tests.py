from decimal import Decimal
from django.test import TestCase
from django.db import IntegrityError
from django.db.models import ProtectedError
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status

from users.models import User, UserRole
from clients.models import Client
from projects.models import Project, ProjectStatus


class ClientModelTests(TestCase):
    def setUp(self):
        self.manager = User.objects.create_user(
            email="manager@agency.com",
            password="ManagerPass123!",
            first_name="Alice",
            last_name="Manager",
            role=UserRole.MANAGER,
        )

    def test_client_creation_and_str(self):
        client = Client.objects.create(
            name="Acme Corporation",
            contact_name="Jane Doe",
            contact_email="jane@acme.com",
            contact_phone="+1-555-0100",
            notes="Enterprise partner",
            created_by=self.manager,
        )
        self.assertEqual(str(client), "Acme Corporation")
        self.assertFalse(client.is_archived)
        self.assertIsNotNone(client.id)
        self.assertEqual(client.created_by, self.manager)

    def test_client_unique_name_constraint(self):
        Client.objects.create(name="Starlight Labs")
        with self.assertRaises(IntegrityError):
            Client.objects.create(name="Starlight Labs")

    def test_client_deletion_protected_by_linked_projects(self):
        client = Client.objects.create(name="Apex Retail")
        Project.objects.create(
            client=client,
            name="Retail Analytics Platform",
            contract_revenue=Decimal("50000.00"),
            planned_cost_budget=Decimal("30000.00"),
            planned_hourly_cost=Decimal("75.0000"),
            created_by=self.manager,
        )
        with self.assertRaises(ProtectedError):
            client.delete()


class ClientAPITests(APITestCase):
    def setUp(self):
        self.manager = User.objects.create_user(
            email="manager@agency.com",
            password="ManagerPass123!",
            first_name="Alice",
            last_name="Manager",
            role=UserRole.MANAGER,
        )
        self.team_member = User.objects.create_user(
            email="dev@agency.com",
            password="DevPass123!",
            first_name="Bob",
            last_name="Developer",
            role=UserRole.TEAM_MEMBER,
        )
        self.client_record = Client.objects.create(
            name="Acme Corp",
            contact_name="Jane Doe",
            contact_email="jane@acme.com",
            created_by=self.manager,
        )
        self.list_url = "/api/v1/clients/"
        self.detail_url = f"/api/v1/clients/{self.client_record.id}/"

    def test_unauthenticated_request_rejected(self):
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_team_member_forbidden_from_clients_directory(self):
        self.client.force_authenticate(user=self.team_member)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        post_res = self.client.post(self.list_url, {"name": "Unauthorized Client"})
        self.assertEqual(post_res.status_code, status.HTTP_403_FORBIDDEN)

    def test_manager_can_list_and_filter_clients(self):
        self.client.force_authenticate(user=self.manager)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = (
            response.data["results"]
            if isinstance(response.data, dict) and "results" in response.data
            else response.data
        )
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["name"], "Acme Corp")
        self.assertEqual(results[0]["projects_count"], 0)

    def test_manager_can_create_client(self):
        self.client.force_authenticate(user=self.manager)
        payload = {
            "name": "Starlight Ventures",
            "contact_name": "Dr. Sarah Stone",
            "contact_email": "sarah@starlight.io",
            "notes": "BioTech AI platform contracts",
        }
        response = self.client.post(self.list_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "Starlight Ventures")
        self.assertEqual(response.data["created_by"], self.manager.id)

    def test_manager_can_soft_archive_client(self):
        self.client.force_authenticate(user=self.manager)
        response = self.client.delete(self.detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.client_record.refresh_from_db()
        self.assertTrue(self.client_record.is_archived)

    def test_hard_delete_blocked_when_projects_exist(self):
        Project.objects.create(
            client=self.client_record,
            name="Active Delivery",
            contract_revenue=Decimal("10000.00"),
            planned_cost_budget=Decimal("5000.00"),
            planned_hourly_cost=Decimal("50.0000"),
            created_by=self.manager,
        )
        self.client.force_authenticate(user=self.manager)
        response = self.client.delete(f"{self.detail_url}?hard_delete=true")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"]["code"], "VALIDATION_ERROR")

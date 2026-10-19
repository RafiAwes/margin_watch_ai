from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from django.db.models.deletion import ProtectedError
from django.core.exceptions import ValidationError
from rest_framework.test import APIClient
from rest_framework import status

from users.models import User, UserRole
from clients.models import Client
from projects.models import Project, ProjectAssignment
from expenses.models import Expense, ExpenseCategory, ExpenseStatus


class ExpenseModelTests(TestCase):
    def setUp(self):
        self.manager = User.objects.create_user(
            email="manager@agency.com",
            password="ManagerPass123!",
            first_name="Sarah",
            last_name="Connor",
            role=UserRole.MANAGER,
        )
        self.developer = User.objects.create_user(
            email="dev@agency.com",
            password="DevPass123!",
            first_name="Alex",
            last_name="Mercer",
            role=UserRole.TEAM_MEMBER,
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

    def test_expense_creation_defaults_to_pending(self):
        expense = Expense.objects.create(
            project=self.project,
            user=self.developer,
            category=ExpenseCategory.SOFTWARE_LICENSE,
            amount=Decimal("199.99"),
            description="Database hosting subscription",
            expense_date=self.today,
        )
        self.assertEqual(expense.status, ExpenseStatus.PENDING)
        self.assertIsNone(expense.reviewed_by)
        self.assertIsNone(expense.reviewed_at)

    def test_amount_must_be_strictly_positive(self):
        with self.assertRaises(ValidationError):
            Expense.objects.create(
                project=self.project,
                user=self.developer,
                category=ExpenseCategory.OTHER,
                amount=Decimal("0.00"),
                description="Zero cost",
                expense_date=self.today,
            )

    def test_rejection_requires_mandatory_review_note(self):
        expense = Expense.objects.create(
            project=self.project,
            user=self.developer,
            category=ExpenseCategory.TRAVEL,
            amount=Decimal("350.00"),
            description="Client flight",
            expense_date=self.today,
        )
        expense.status = ExpenseStatus.REJECTED
        expense.review_note = ""
        with self.assertRaises(ValidationError):
            expense.save()

        # Providing a valid note succeeds
        expense.review_note = "Travel not authorized in client agreement."
        expense.save()
        self.assertEqual(expense.status, ExpenseStatus.REJECTED)

    def test_financial_immutability_on_reviewed_expense(self):
        expense = Expense.objects.create(
            project=self.project,
            user=self.developer,
            category=ExpenseCategory.SUBCONTRACTOR,
            amount=Decimal("1200.00"),
            description="Frontend contractor",
            expense_date=self.today,
            status=ExpenseStatus.APPROVED,
            reviewed_by=self.manager,
            reviewed_at=timezone.now(),
        )
        # Attempting to change amount on approved expense must fail
        expense.amount = Decimal("1500.00")
        with self.assertRaises(ValidationError):
            expense.save()

    def test_cascade_deletion_protection(self):
        Expense.objects.create(
            project=self.project,
            user=self.developer,
            category=ExpenseCategory.HARDWARE,
            amount=Decimal("45.00"),
            description="Cables",
            expense_date=self.today,
        )
        with self.assertRaises(ProtectedError):
            self.project.delete()

        with self.assertRaises(ProtectedError):
            self.developer.delete()


class ExpenseAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.manager = User.objects.create_user(
            email="manager@agency.com",
            password="ManagerPass123!",
            first_name="Sarah",
            last_name="Connor",
            role=UserRole.MANAGER,
        )
        self.assigned_dev = User.objects.create_user(
            email="dev1@agency.com",
            password="DevPass123!",
            first_name="Alex",
            last_name="Mercer",
            role=UserRole.TEAM_MEMBER,
        )
        self.unassigned_dev = User.objects.create_user(
            email="dev2@agency.com",
            password="DevPass123!",
            first_name="Elena",
            last_name="Rostova",
            role=UserRole.TEAM_MEMBER,
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
        ProjectAssignment.objects.create(
            project=self.project,
            user=self.assigned_dev,
            assigned_by=self.manager,
            is_active=True,
        )
        self.today = timezone.now().date()

    def test_assigned_team_member_submits_expense(self):
        self.client.force_authenticate(user=self.assigned_dev)
        response = self.client.post(
            "/api/v1/expenses/",
            {
                "project_id": str(self.project.id),
                "category": "SOFTWARE_LICENSE",
                "amount": "89.00",
                "description": "Figma team license",
                "expense_date": str(self.today),
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "PENDING")
        self.assertEqual(response.data["amount"], "89.00")
        self.assertEqual(response.data["user_email"], "dev1@agency.com")

    def test_unassigned_team_member_cannot_submit_expense(self):
        self.client.force_authenticate(user=self.unassigned_dev)
        response = self.client.post(
            "/api/v1/expenses/",
            {
                "project_id": str(self.project.id),
                "category": "HARDWARE",
                "amount": "150.00",
                "description": "Unauthorized hardware purchase",
                "expense_date": str(self.today),
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("project_id", [d["field"] for d in response.data["error"]["details"]])

    def test_manager_reviews_expense_approval(self):
        expense = Expense.objects.create(
            project=self.project,
            user=self.assigned_dev,
            category=ExpenseCategory.SOFTWARE_LICENSE,
            amount=Decimal("120.00"),
            description="SSL Certificate",
            expense_date=self.today,
        )
        self.client.force_authenticate(user=self.manager)
        response = self.client.post(
            f"/api/v1/expenses/{expense.id}/review/",
            {
                "action": "APPROVE",
                "review_note": "Approved for production domain.",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "APPROVED")
        self.assertEqual(response.data["reviewed_by_email"], "manager@agency.com")

        expense.refresh_from_db()
        self.assertEqual(expense.status, ExpenseStatus.APPROVED)
        self.assertEqual(expense.reviewed_by, self.manager)

    def test_manager_rejection_without_note_is_rejected(self):
        expense = Expense.objects.create(
            project=self.project,
            user=self.assigned_dev,
            category=ExpenseCategory.TRAVEL,
            amount=Decimal("500.00"),
            description="Taxi and meal",
            expense_date=self.today,
        )
        self.client.force_authenticate(user=self.manager)
        response = self.client.post(
            f"/api/v1/expenses/{expense.id}/review/",
            {
                "action": "REJECT",
                "review_note": "",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("review_note", [d["field"] for d in response.data["error"]["details"]])

    def test_re_reviewing_already_reviewed_expense_returns_422(self):
        expense = Expense.objects.create(
            project=self.project,
            user=self.assigned_dev,
            category=ExpenseCategory.OTHER,
            amount=Decimal("75.00"),
            description="Books",
            expense_date=self.today,
            status=ExpenseStatus.APPROVED,
            reviewed_by=self.manager,
            reviewed_at=timezone.now(),
        )
        self.client.force_authenticate(user=self.manager)
        response = self.client.post(
            f"/api/v1/expenses/{expense.id}/review/",
            {
                "action": "REJECT",
                "review_note": "Attempt to re-reject",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_422_UNPROCESSABLE_ENTITY)

    def test_team_member_cannot_review_expense(self):
        expense = Expense.objects.create(
            project=self.project,
            user=self.assigned_dev,
            category=ExpenseCategory.OTHER,
            amount=Decimal("60.00"),
            description="Domain renewal",
            expense_date=self.today,
        )
        self.client.force_authenticate(user=self.assigned_dev)
        response = self.client.post(
            f"/api/v1/expenses/{expense.id}/review/",
            {
                "action": "APPROVE",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_can_delete_pending_expense(self):
        expense = Expense.objects.create(
            project=self.project,
            user=self.assigned_dev,
            category=ExpenseCategory.OTHER,
            amount=Decimal("30.00"),
            description="Duplicate submission",
            expense_date=self.today,
        )
        self.client.force_authenticate(user=self.assigned_dev)
        response = self.client.delete(f"/api/v1/expenses/{expense.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Expense.objects.filter(pk=expense.pk).exists())

    def test_team_member_cannot_delete_another_users_expense(self):
        expense = Expense.objects.create(
            project=self.project,
            user=self.assigned_dev,
            category=ExpenseCategory.OTHER,
            amount=Decimal("30.00"),
            description="Team lunch",
            expense_date=self.today,
        )
        self.client.force_authenticate(user=self.unassigned_dev)
        response = self.client.delete(f"/api/v1/expenses/{expense.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(Expense.objects.filter(pk=expense.pk).exists())

    def test_reviewed_expense_cannot_be_deleted_by_owner(self):
        expense = Expense.objects.create(
            project=self.project,
            user=self.assigned_dev,
            category=ExpenseCategory.SUBCONTRACTOR,
            amount=Decimal("900.00"),
            description="QA contractor",
            expense_date=self.today,
            status=ExpenseStatus.APPROVED,
            reviewed_by=self.manager,
            reviewed_at=timezone.now(),
        )
        self.client.force_authenticate(user=self.assigned_dev)
        response = self.client.delete(f"/api/v1/expenses/{expense.id}/")
        self.assertEqual(response.status_code, status.HTTP_422_UNPROCESSABLE_ENTITY)
        self.assertTrue(Expense.objects.filter(pk=expense.pk).exists())

    def test_reviewed_expense_cannot_be_deleted_by_manager(self):
        approved = Expense.objects.create(
            project=self.project,
            user=self.assigned_dev,
            category=ExpenseCategory.HARDWARE,
            amount=Decimal("250.00"),
            description="Test devices",
            expense_date=self.today,
            status=ExpenseStatus.APPROVED,
            reviewed_by=self.manager,
            reviewed_at=timezone.now(),
        )
        rejected = Expense.objects.create(
            project=self.project,
            user=self.assigned_dev,
            category=ExpenseCategory.TRAVEL,
            amount=Decimal("400.00"),
            description="Conference travel",
            expense_date=self.today,
            status=ExpenseStatus.REJECTED,
            reviewed_by=self.manager,
            reviewed_at=timezone.now(),
            review_note="Outside contracted scope.",
        )
        self.client.force_authenticate(user=self.manager)
        for expense in (approved, rejected):
            response = self.client.delete(f"/api/v1/expenses/{expense.id}/")
            self.assertEqual(response.status_code, status.HTTP_422_UNPROCESSABLE_ENTITY)
            self.assertTrue(Expense.objects.filter(pk=expense.pk).exists())

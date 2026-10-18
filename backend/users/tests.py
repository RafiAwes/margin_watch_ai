from decimal import Decimal
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from users.models import User, UserRole


class JWTAuthenticationTests(APITestCase):
    def setUp(self):
        # Create a Manager
        self.manager_password = "SecureManagerPass123!"
        self.manager = User.objects.create_user(
            email="manager@agency.com",
            password=self.manager_password,
            first_name="Sarah",
            last_name="Connor",
            role=UserRole.MANAGER,
            default_hourly_cost_rate=Decimal("125.0000"),
            is_staff=True,
        )

        # Create a Team Member
        self.developer_password = "SecureDevPass123!"
        self.developer = User.objects.create_user(
            email="dev@agency.com",
            password=self.developer_password,
            first_name="Alex",
            last_name="Mercer",
            role=UserRole.TEAM_MEMBER,
            default_hourly_cost_rate=Decimal("65.0000"),
        )

        # Create an Inactive User
        self.inactive_user = User.objects.create_user(
            email="inactive@agency.com",
            password="InactivePass123!",
            first_name="Ghost",
            last_name="User",
            role=UserRole.TEAM_MEMBER,
            is_active=False,
        )

        self.login_url = reverse("users:auth-login")
        self.refresh_url = reverse("users:auth-refresh")
        self.me_url = reverse("users:auth-me")

    def test_tc_auth_01_successful_login(self):
        """Valid credentials return HTTP 200, JWT tokens, and user profile."""
        payload = {
            "email": "manager@agency.com",
            "password": self.manager_password,
        }
        response = self.client.post(self.login_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access_token", response.data)
        self.assertIn("refresh_token", response.data)
        self.assertIn("user", response.data)

        user_data = response.data["user"]
        self.assertEqual(user_data["id"], str(self.manager.id))
        self.assertEqual(user_data["email"], "manager@agency.com")
        self.assertEqual(user_data["first_name"], "Sarah")
        self.assertEqual(user_data["last_name"], "Connor")
        self.assertEqual(user_data["role"], UserRole.MANAGER)

    def test_tc_auth_02_invalid_password(self):
        """Invalid password returns HTTP 401 Unauthorized."""
        payload = {
            "email": "manager@agency.com",
            "password": "WrongPassword!",
        }
        response = self.client.post(self.login_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_tc_auth_03_inactive_account_rejected(self):
        """Deactivated account cannot obtain JWT tokens."""
        payload = {
            "email": "inactive@agency.com",
            "password": "InactivePass123!",
        }
        response = self.client.post(self.login_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_tc_auth_04_token_refresh(self):
        """Valid refresh token yields a renewed access token."""
        login_response = self.client.post(
            self.login_url,
            {"email": "dev@agency.com", "password": self.developer_password},
            format="json",
        )
        refresh_token = login_response.data["refresh_token"]

        # Test with 'refresh' field
        response = self.client.post(self.refresh_url, {"refresh": refresh_token}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access_token", response.data)

        # Test with 'refresh_token' field alias
        refresh_token_2 = response.data.get("refresh_token") or refresh_token
        response_alias = self.client.post(self.refresh_url, {"refresh_token": refresh_token_2}, format="json")
        self.assertEqual(response_alias.status_code, status.HTTP_200_OK)
        self.assertIn("access_token", response_alias.data)

    def test_tc_auth_05_me_requires_authentication(self):
        """Unauthenticated request to /api/v1/auth/me/ is rejected with 401."""
        response = self.client.get(self.me_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_tc_auth_06_manager_profile_includes_cost_rate(self):
        """Manager calling /api/v1/auth/me/ can see their default_hourly_cost_rate."""
        login_response = self.client.post(
            self.login_url,
            {"email": "manager@agency.com", "password": self.manager_password},
            format="json",
        )
        token = login_response.data["access_token"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        response = self.client.get(self.me_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], "manager@agency.com")
        self.assertEqual(response.data["role"], UserRole.MANAGER)
        self.assertIn("default_hourly_cost_rate", response.data)
        self.assertEqual(Decimal(response.data["default_hourly_cost_rate"]), Decimal("125.0000"))

    def test_tc_auth_07_team_member_profile_masks_cost_rate(self):
        """Team Member calling /api/v1/auth/me/ CANNOT see default_hourly_cost_rate (security masking)."""
        login_response = self.client.post(
            self.login_url,
            {"email": "dev@agency.com", "password": self.developer_password},
            format="json",
        )
        token = login_response.data["access_token"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        response = self.client.get(self.me_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], "dev@agency.com")
        self.assertEqual(response.data["role"], UserRole.TEAM_MEMBER)
        self.assertNotIn("default_hourly_cost_rate", response.data)

    def test_tc_auth_08_case_insensitive_email_login(self):
        """Login with differently-cased email succeeds."""
        payload = {
            "email": "MANAGER@AGENCY.COM",
            "password": self.manager_password,
        }
        response = self.client.post(self.login_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["user"]["email"], "manager@agency.com")

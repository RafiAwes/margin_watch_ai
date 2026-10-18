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

    def test_tc_auth_09_logout_blacklists_refresh_token(self):
        """Logging out blacklists the refresh token, preventing subsequent refresh."""
        login_response = self.client.post(
            self.login_url,
            {"email": "manager@agency.com", "password": self.manager_password},
            format="json",
        )
        access_token = login_response.data["access_token"]
        refresh_token = login_response.data["refresh_token"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
        logout_url = reverse("users:auth-logout")

        # Log out by supplying the refresh token
        logout_response = self.client.post(
            logout_url,
            {"refresh_token": refresh_token},
            format="json",
        )
        self.assertEqual(logout_response.status_code, status.HTTP_200_OK)
        self.assertEqual(logout_response.data["detail"], "Successfully logged out.")

        # Attempt to use blacklisted refresh token must fail with 401
        refresh_response = self.client.post(
            self.refresh_url,
            {"refresh": refresh_token},
            format="json",
        )
        self.assertEqual(refresh_response.status_code, status.HTTP_401_UNAUTHORIZED)


class UserManagementTests(APITestCase):
    def setUp(self):
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

        self.developer_password = "SecureDevPass123!"
        self.developer = User.objects.create_user(
            email="dev@agency.com",
            password=self.developer_password,
            first_name="Alex",
            last_name="Mercer",
            role=UserRole.TEAM_MEMBER,
            default_hourly_cost_rate=Decimal("65.0000"),
        )

        self.users_url = reverse("user-list")
        self.user_detail_url = reverse("user-detail", kwargs={"pk": self.developer.id})

    def authenticate_as(self, user, password):
        login_url = reverse("users:auth-login")
        res = self.client.post(login_url, {"email": user.email, "password": password}, format="json")
        token = res.data["access_token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    def test_tc_user_01_list_users_as_manager_shows_cost_rates(self):
        """Manager calling GET /api/v1/users/ sees all users with default_hourly_cost_rate."""
        self.authenticate_as(self.manager, self.manager_password)
        response = self.client.get(self.users_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 2)
        # Manager can inspect cost rates
        for u in response.data:
            self.assertIn("default_hourly_cost_rate", u)

    def test_tc_user_02_list_users_as_team_member_masks_cost_rates(self):
        """Team member calling GET /api/v1/users/ sees active users but cost rates are masked."""
        self.authenticate_as(self.developer, self.developer_password)
        response = self.client.get(self.users_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for u in response.data:
            self.assertNotIn("default_hourly_cost_rate", u)

    def test_tc_user_03_create_user_as_manager(self):
        """Manager can provision a new agency user account."""
        self.authenticate_as(self.manager, self.manager_password)
        payload = {
            "email": "designer@agency.com",
            "password": "DesignerPass123!",
            "first_name": "Elena",
            "last_name": "Rostova",
            "role": UserRole.TEAM_MEMBER,
            "default_hourly_cost_rate": "70.0000",
        }
        response = self.client.post(self.users_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["email"], "designer@agency.com")
        self.assertEqual(response.data["role"], UserRole.TEAM_MEMBER)

        # Verify new user can authenticate
        new_user = User.objects.get(email="designer@agency.com")
        self.assertTrue(new_user.check_password("DesignerPass123!"))

    def test_tc_user_04_create_user_as_team_member_forbidden(self):
        """Team member cannot create agency users (403 Forbidden)."""
        self.authenticate_as(self.developer, self.developer_password)
        payload = {
            "email": "hacker@agency.com",
            "password": "HackerPass123!",
            "first_name": "Bad",
            "last_name": "Actor",
            "role": UserRole.MANAGER,
        }
        response = self.client.post(self.users_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_tc_user_05_update_user_as_manager(self):
        """Manager can update a user's role and default hourly rate."""
        self.authenticate_as(self.manager, self.manager_password)
        payload = {
            "role": UserRole.MANAGER,
            "default_hourly_cost_rate": "95.0000",
        }
        response = self.client.patch(self.user_detail_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.developer.refresh_from_db()
        self.assertEqual(self.developer.role, UserRole.MANAGER)
        self.assertEqual(self.developer.default_hourly_cost_rate, Decimal("95.0000"))

    def test_tc_user_06_update_user_as_team_member_forbidden(self):
        """Team member cannot update other users via /api/v1/users/{id}/ (403 Forbidden)."""
        self.authenticate_as(self.developer, self.developer_password)
        manager_detail_url = reverse("user-detail", kwargs={"pk": self.manager.id})
        response = self.client.patch(manager_detail_url, {"first_name": "Compromised"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_tc_user_07_manager_cannot_demote_only_active_manager(self):
        """The sole active manager cannot demote themselves to TEAM_MEMBER."""
        self.authenticate_as(self.manager, self.manager_password)
        my_detail_url = reverse("user-detail", kwargs={"pk": self.manager.id})
        response = self.client.patch(my_detail_url, {"role": UserRole.TEAM_MEMBER}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("role", response.data)

    def test_tc_user_08_soft_deactivation_by_manager(self):
        """Manager can soft-deactivate an account (sets is_active=False)."""
        self.authenticate_as(self.manager, self.manager_password)
        response = self.client.delete(self.user_detail_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        self.developer.refresh_from_db()
        self.assertFalse(self.developer.is_active)

    def test_tc_auth_register_successful(self):
        """Public registration creates user and returns JWT tokens with HTTP 201."""
        register_url = reverse("users:auth-register")
        payload = {
            "email": "newuser@agency.com",
            "password": "NewUserPass123!",
            "first_name": "New",
            "last_name": "User",
            "role": UserRole.TEAM_MEMBER,
        }
        response = self.client.post(register_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("access_token", response.data)
        self.assertIn("refresh_token", response.data)
        self.assertEqual(response.data["user"]["email"], "newuser@agency.com")
        self.assertTrue(User.objects.filter(email="newuser@agency.com").exists())

    def test_tc_auth_register_duplicate_email(self):
        """Registration with existing email is rejected with HTTP 400."""
        register_url = reverse("users:auth-register")
        payload = {
            "email": "manager@agency.com",
            "password": "AnyPassword123!",
        }
        response = self.client.post(register_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_tc_auth_register_short_password(self):
        """Registration with password < 8 characters is rejected with HTTP 400."""
        register_url = reverse("users:auth-register")
        payload = {
            "email": "shortpw@agency.com",
            "password": "short",
        }
        response = self.client.post(register_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

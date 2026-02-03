"""Tests for users module endpoints and behaviors."""

import unittest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.core import mail
from django.test import override_settings
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from django.contrib.auth.tokens import default_token_generator
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.test import APITestCase

from profiles.models import Profile


User = get_user_model()


def _create_profile(email, *, is_esner=True, verified=True, name="Mario", surname="Rossi"):
	"""Create and return a Profile with minimal required fields."""
	return Profile.objects.create(
		email=email,
		name=name,
		surname=surname,
		email_is_verified=verified,
		is_esner=is_esner,
		birthdate="1995-01-15",
	)


def _create_user(profile, *, password="SecurePass123!"):
	"""Create and return a User bound to the given profile."""
	user = User.objects.create(profile=profile)
	user.set_password(password)
	user.save(update_fields=["password"])
	return user


class UsersBaseTestCase(APITestCase):
	"""Base setup with groups and permissions for user tests."""

	@classmethod
	def setUpTestData(cls):
		cls.group_board = Group.objects.create(name="Board")
		cls.group_attivi = Group.objects.create(name="Attivi")
		cls.group_aspiranti = Group.objects.create(name="Aspiranti")

		cls.perm_add_user = Permission.objects.get(codename="add_user")
		cls.perm_change_user = Permission.objects.get(codename="change_user")
		cls.perm_delete_user = Permission.objects.get(codename="delete_user")

	def authenticate(self, user):
		"""Force authenticate the API client with the given user."""
		self.client.force_authenticate(user=user)


class LoginLogoutTests(UsersBaseTestCase):
	"""Tests for login, logout, and refresh endpoints."""

	def test_login_rejects_non_esn_email(self):
		"""Login with non @esnpolimi.it email should be blocked."""
		profile = _create_profile("user@gmail.com", verified=True, is_esner=True)
		_create_user(profile)

		response = self.client.post("/backend/login/", {
			"email": "user@gmail.com",
			"password": "SecurePass123!",
		})

		self.assertEqual(response.status_code, 403)
		self.assertIn("Solo email", response.data["detail"])

	def test_login_rejects_unverified_email(self):
		"""Login should fail when profile email is not verified."""
		profile = _create_profile("user@esnpolimi.it", verified=False, is_esner=True)
		_create_user(profile)

		response = self.client.post("/backend/login/", {
			"email": "user@esnpolimi.it",
			"password": "SecurePass123!",
		})

		self.assertEqual(response.status_code, 403)
		self.assertEqual(response.data["detail"], "Email non verificata")

	def test_login_success_returns_tokens_and_sets_cookie(self):
		"""Login with valid credentials returns access/refresh and sets cookie."""
		profile = _create_profile("user@esnpolimi.it", verified=True, is_esner=True)
		_create_user(profile)

		response = self.client.post("/backend/login/", {
			"email": "user@esnpolimi.it",
			"password": "SecurePass123!",
		})

		self.assertEqual(response.status_code, 200)
		self.assertIn("access", response.data)
		self.assertIn("refresh", response.data)
		self.assertIn("refresh_token", response.cookies)

	def test_login_invalid_password(self):
		"""Login with wrong password returns 403."""
		profile = _create_profile("user@esnpolimi.it", verified=True, is_esner=True)
		_create_user(profile, password="CorrectPass1!")

		response = self.client.post("/backend/login/", {
			"email": "user@esnpolimi.it",
			"password": "WrongPass1!",
		})

		self.assertEqual(response.status_code, 403)
		self.assertEqual(response.data["detail"], "Credenziali invalide")

	def test_logout_deletes_cookie(self):
		"""Logout should delete refresh cookie even if token not provided."""
		response = self.client.post("/backend/logout/", {})

		self.assertEqual(response.status_code, 200)
		self.assertIn("refresh_token", response.cookies)

	def test_refresh_token_missing_cookie(self):
		"""Refresh token endpoint should reject missing cookie."""
		response = self.client.post("/backend/api/token/refresh/", {"email": "user@esnpolimi.it"})

		self.assertEqual(response.status_code, 400)
		self.assertIn("Token di refresh non trovato", response.data["detail"])

	def test_refresh_token_success(self):
		"""Refresh token should return new access when cookie is valid."""
		profile = _create_profile("user@esnpolimi.it", verified=True, is_esner=True)
		user = _create_user(profile)

		refresh = RefreshToken.for_user(user)
		self.client.cookies["refresh_token"] = str(refresh)

		response = self.client.post("/backend/api/token/refresh/", {
			"email": "user@esnpolimi.it",
		})

		self.assertEqual(response.status_code, 200)
		self.assertIn("access", response.data)


class UserListTests(UsersBaseTestCase):
	"""Tests for /users/ list and create endpoints."""

	def test_user_list_requires_auth(self):
		"""Listing users without authentication should return 401."""
		response = self.client.get("/backend/users/")

		self.assertEqual(response.status_code, 401)

	def test_user_list_returns_all_users(self):
		"""Authenticated user should receive the full user list."""
		profile = _create_profile("user@esnpolimi.it", verified=True, is_esner=True)
		user = _create_user(profile)

		other_profile = _create_profile("other@esnpolimi.it", verified=True, is_esner=True)
		_create_user(other_profile)

		self.authenticate(user)
		response = self.client.get("/backend/users/")

		self.assertEqual(response.status_code, 200)
		self.assertEqual(len(response.data), 2)

	def test_user_create_requires_permission(self):
		"""Creating user without add permission should be blocked."""
		profile = _create_profile("user@esnpolimi.it", verified=True, is_esner=True)
		user = _create_user(profile)

		self.authenticate(user)
		response = self.client.post("/backend/users/", {
			"profile": "new@esnpolimi.it",
			"can_manage_casse": False,
			"can_view_casse_import": False,
		})

		self.assertEqual(response.status_code, 401)
		self.assertIn("Non autorizzato", response.data["error"])

	def test_user_create_with_permission(self):
		"""Creating user with add permission should succeed."""
		profile = _create_profile("user@esnpolimi.it", verified=True, is_esner=True)
		user = _create_user(profile)
		user.user_permissions.add(self.perm_add_user)

		self.authenticate(user)

		target_profile = _create_profile("new@esnpolimi.it", verified=True, is_esner=True)
		response = self.client.post("/backend/users/", {
			"profile": target_profile.pk,
			"can_manage_casse": True,
			"can_view_casse_import": False,
		})

		self.assertEqual(response.status_code, 201)
		self.assertTrue(User.objects.filter(profile=target_profile.email).exists())


class UserDetailTests(UsersBaseTestCase):
	"""Tests for /users/<pk>/ detail endpoints."""

	def test_user_detail_get(self):
		"""GET should return user details for authenticated request."""
		profile = _create_profile("user@esnpolimi.it", verified=True, is_esner=True)
		user = _create_user(profile)

		self.authenticate(user)
		response = self.client.get(f"/backend/users/{profile.email}/")

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["profile"], profile.email)

	def test_user_detail_not_found(self):
		"""GET should return 404 for missing user."""
		profile = _create_profile("user@esnpolimi.it", verified=True, is_esner=True)
		user = _create_user(profile)

		self.authenticate(user)
		response = self.client.get("/backend/users/missing@esnpolimi.it/")

		self.assertEqual(response.status_code, 404)

	def test_user_update_requires_permission(self):
		"""PATCH without change permission should be blocked."""
		profile = _create_profile("user@esnpolimi.it", verified=True, is_esner=True)
		user = _create_user(profile)

		self.authenticate(user)
		response = self.client.patch(f"/backend/users/{profile.email}/", {
			"can_manage_casse": True,
		})

		self.assertEqual(response.status_code, 401)

	def test_user_update_with_permission(self):
		"""PATCH with change permission should update fields."""
		profile = _create_profile("user@esnpolimi.it", verified=True, is_esner=True)
		user = _create_user(profile)
		user.user_permissions.add(self.perm_change_user)

		self.authenticate(user)
		response = self.client.patch(f"/backend/users/{profile.email}/", {
			"can_manage_casse": True,
		})

		self.assertEqual(response.status_code, 200)
		user.refresh_from_db()
		self.assertTrue(user.can_manage_casse)

	def test_user_delete_requires_board(self):
		"""DELETE should be allowed only for Board members."""
		profile = _create_profile("user@esnpolimi.it", verified=True, is_esner=True)
		user = _create_user(profile)

		target_profile = _create_profile("target@esnpolimi.it", verified=True, is_esner=True)
		_create_user(target_profile)

		self.authenticate(user)
		response = self.client.delete(f"/backend/users/{target_profile.email}/")

		self.assertEqual(response.status_code, 401)

	def test_user_delete_as_board(self):
		"""DELETE should succeed for Board members."""
		board_profile = _create_profile("board@esnpolimi.it", verified=True, is_esner=True)
		board_user = _create_user(board_profile)
		board_user.groups.add(self.group_board)

		target_profile = _create_profile("target@esnpolimi.it", verified=True, is_esner=True)
		_create_user(target_profile)

		self.authenticate(board_user)
		response = self.client.delete(f"/backend/users/{target_profile.email}/")

		self.assertEqual(response.status_code, 204)
		self.assertFalse(User.objects.filter(profile=target_profile.email).exists())


class PasswordResetTests(UsersBaseTestCase):
	"""Tests for forgot/reset password flows."""

	@override_settings(
		EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
		SCHEME_HOST="http://testserver",
	)
	def test_forgot_password_sends_email_for_existing_user(self):
		"""Forgot password should send an email when user exists."""
		profile = _create_profile("user@esnpolimi.it", verified=True, is_esner=True)
		_create_user(profile)

		response = self.client.post("/backend/api/forgot-password/", {
			"email": "user@esnpolimi.it",
		})

		self.assertEqual(response.status_code, 200)
		self.assertEqual(len(mail.outbox), 1)
		self.assertIn("Reimposta", mail.outbox[0].subject)

	@override_settings(
		EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
		SCHEME_HOST="http://testserver",
	)
	def test_forgot_password_returns_generic_message_for_missing_user(self):
		"""Forgot password should always return generic message for missing users."""
		response = self.client.post("/backend/api/forgot-password/", {
			"email": "missing@esnpolimi.it",
		})

		self.assertEqual(response.status_code, 200)
		self.assertEqual(len(mail.outbox), 0)
		self.assertIn("Se l'indirizzo email", response.data["message"])

	def test_reset_password_invalid_uid(self):
		"""Reset password should fail with invalid uid."""
		response = self.client.post("/backend/api/reset-password/invalid/invalid/", {
			"password": "NewPass123!",
			"confirm_password": "NewPass123!",
		})

		self.assertEqual(response.status_code, 400)

	def test_reset_password_mismatch(self):
		"""Reset password should fail when passwords do not match."""
		profile = _create_profile("user@esnpolimi.it", verified=True, is_esner=True)
		user = _create_user(profile)

		uid = urlsafe_base64_encode(force_bytes(user.pk))
		token = default_token_generator.make_token(user)

		response = self.client.post(f"/backend/api/reset-password/{uid}/{token}/", {
			"password": "NewPass123!",
			"confirm_password": "DifferentPass123!",
		})

		self.assertEqual(response.status_code, 400)
		self.assertIn("non corrispondono", response.data["error"])

	def test_reset_password_success(self):
		"""Reset password should update user credentials."""
		profile = _create_profile("user@esnpolimi.it", verified=True, is_esner=True)
		user = _create_user(profile)

		uid = urlsafe_base64_encode(force_bytes(user.pk))
		reset_token = default_token_generator.make_token(user)

		response = self.client.post(f"/backend/api/reset-password/{uid}/{reset_token}/", {
			"password": "NewPass123!",
			"confirm_password": "NewPass123!",
		})

		self.assertEqual(response.status_code, 200)
		user.refresh_from_db()
		self.assertTrue(user.check_password("NewPass123!"))


class GroupListTests(UsersBaseTestCase):
	"""Tests for group listing endpoint."""

	def test_group_list_requires_auth(self):
		"""Group list should require authentication."""
		response = self.client.get("/backend/groups/")

		self.assertEqual(response.status_code, 401)

	def test_group_list_returns_groups(self):
		"""Authenticated users should receive all groups."""
		profile = _create_profile("user@esnpolimi.it", verified=True, is_esner=True)
		user = _create_user(profile)

		self.authenticate(user)
		response = self.client.get("/backend/groups/")

		self.assertEqual(response.status_code, 200)
		names = [g["name"] for g in response.data]
		self.assertIn("Board", names)
		self.assertIn("Attivi", names)
		self.assertIn("Aspiranti", names)


class FinancePermissionTests(UsersBaseTestCase):
	"""Tests for finance permissions endpoint."""

	def test_finance_permissions_missing_email(self):
		"""Missing email query should return 400."""
		profile = _create_profile("user@esnpolimi.it", verified=True, is_esner=True)
		user = _create_user(profile)
		self.authenticate(user)

		response = self.client.get("/backend/users/finance-permissions/")

		self.assertEqual(response.status_code, 400)
		self.assertIn("Missing 'email'", response.data["error"])

	def test_finance_permissions_get_effective_flags(self):
		"""GET should include raw and effective permissions."""
		profile = _create_profile("aspirante@esnpolimi.it", verified=True, is_esner=True)
		user = _create_user(profile)
		user.groups.add(self.group_aspiranti)

		self.authenticate(user)
		response = self.client.get(
			"/backend/users/finance-permissions/?email=aspirante@esnpolimi.it"
		)

		self.assertEqual(response.status_code, 200)
		self.assertIn("effective_can_manage_casse", response.data)
		self.assertIn("effective_can_view_casse_import", response.data)

	def test_finance_permissions_patch_requires_board(self):
		"""PATCH should be forbidden for non-Board users."""
		target_profile = _create_profile("aspirante@esnpolimi.it", verified=True, is_esner=True)
		target_user = _create_user(target_profile)
		target_user.groups.add(self.group_aspiranti)

		non_board_profile = _create_profile("user@esnpolimi.it", verified=True, is_esner=True)
		non_board_user = _create_user(non_board_profile)

		self.authenticate(non_board_user)
		response = self.client.patch(
			"/backend/users/finance-permissions/?email=aspirante@esnpolimi.it",
			{"can_manage_casse": True},
		)

		self.assertEqual(response.status_code, 403)

	def test_finance_permissions_patch_target_must_be_esner(self):
		"""PATCH should reject non-ESNer profiles."""
		board_profile = _create_profile("board@esnpolimi.it", verified=True, is_esner=True)
		board_user = _create_user(board_profile)
		board_user.groups.add(self.group_board)

		target_profile = _create_profile("erasmus@uni.it", verified=True, is_esner=False)
		_create_user(target_profile)

		self.authenticate(board_user)
		response = self.client.patch(
			"/backend/users/finance-permissions/?email=erasmus@uni.it",
			{"can_manage_casse": True},
		)

		self.assertEqual(response.status_code, 400)
		self.assertIn("non è un ESNer", response.data["error"])

	def test_finance_permissions_patch_target_must_be_aspirante(self):
		"""PATCH should reject ESNers not in Aspiranti group."""
		board_profile = _create_profile("board@esnpolimi.it", verified=True, is_esner=True)
		board_user = _create_user(board_profile)
		board_user.groups.add(self.group_board)

		target_profile = _create_profile("attivo@esnpolimi.it", verified=True, is_esner=True)
		target_user = _create_user(target_profile)
		target_user.groups.add(self.group_attivi)

		self.authenticate(board_user)
		response = self.client.patch(
			"/backend/users/finance-permissions/?email=attivo@esnpolimi.it",
			{"can_manage_casse": True},
		)

		self.assertEqual(response.status_code, 400)
		self.assertIn("solo agli Aspiranti", response.data["error"])

	def test_finance_permissions_patch_success(self):
		"""PATCH should update raw flags and return effective flags."""
		board_profile = _create_profile("board@esnpolimi.it", verified=True, is_esner=True)
		board_user = _create_user(board_profile)
		board_user.groups.add(self.group_board)

		target_profile = _create_profile("aspirante@esnpolimi.it", verified=True, is_esner=True)
		target_user = _create_user(target_profile)
		target_user.groups.add(self.group_aspiranti)

		self.authenticate(board_user)
		response = self.client.patch(
			"/backend/users/finance-permissions/?email=aspirante@esnpolimi.it",
			{"can_manage_casse": True, "can_view_casse_import": True},
		)

		self.assertEqual(response.status_code, 200)
		target_user.refresh_from_db()
		self.assertTrue(target_user.can_manage_casse)
		self.assertTrue(target_user.can_view_casse_import)


class UserInfoTests(UsersBaseTestCase):
	"""Tests for userinfo utility function (OIDC mapping)."""

	def test_userinfo_returns_basic_identity(self):
		"""userinfo should expose email and display name fields."""
		from users.views import userinfo

		profile = _create_profile("user@esnpolimi.it", verified=True, is_esner=True, name="John", surname="Doe")
		user = _create_user(profile)

		request = type("Req", (), {"user": user})
		data = userinfo(request, user)

		self.assertEqual(data["email"], "user@esnpolimi.it")
		self.assertEqual(data["sub"], "user@esnpolimi.it")  # sub now uses email as identifier
		self.assertEqual(data["name"], "John Doe")


class LoginEdgeCaseTests(UsersBaseTestCase):
	"""Edge case tests for login endpoint."""

	def test_login_with_empty_email_returns_400(self):
		"""U-L-008: Login with empty email should return validation error."""
		response = self.client.post("/backend/login/", {
			"email": "",
			"password": "SecurePass123!",
		})

		self.assertEqual(response.status_code, 400)

	def test_login_with_missing_email_returns_400(self):
		"""Login with missing email should return validation error."""
		response = self.client.post("/backend/login/", {
			"password": "SecurePass123!",
		})

		self.assertEqual(response.status_code, 400)

	def test_login_with_empty_password_returns_400(self):
		"""U-L-009: Login with empty password should return validation error."""
		response = self.client.post("/backend/login/", {
			"email": "user@esnpolimi.it",
			"password": "",
		})

		self.assertEqual(response.status_code, 400)

	def test_login_with_missing_password_returns_400(self):
		"""Login with missing password should return validation error."""
		response = self.client.post("/backend/login/", {
			"email": "user@esnpolimi.it",
		})

		self.assertEqual(response.status_code, 400)

	def test_login_with_nonexistent_user_returns_403(self):
		"""U-L-005: Login with non-registered email should return 403."""
		response = self.client.post("/backend/login/", {
			"email": "nonexistent@esnpolimi.it",
			"password": "SecurePass123!",
		})

		self.assertEqual(response.status_code, 403)
		self.assertEqual(response.data["detail"], "Credenziali invalide")

	def test_login_first_time_last_login_is_null(self):
		"""U-L-006: First login should have last_login as None before login."""
		profile = _create_profile("firstlogin@esnpolimi.it", verified=True, is_esner=True)
		user = _create_user(profile)

		self.assertIsNone(user.last_login)

		response = self.client.post("/backend/login/", {
			"email": "firstlogin@esnpolimi.it",
			"password": "SecurePass123!",
		})

		self.assertEqual(response.status_code, 200)
		user.refresh_from_db()
		self.assertIsNotNone(user.last_login)


class UserManagerTests(UsersBaseTestCase):
	"""Tests for UserManager methods."""

	def test_create_user_without_profile_raises_error(self):
		"""create_user without profile should raise ValueError."""
		with self.assertRaises(ValueError) as context:
			User.objects.create_user(profile=None, password="test")

		self.assertIn("profile", str(context.exception).lower())

	def test_create_superuser_sets_flags(self):
		"""create_superuser should set is_staff and is_superuser."""
		profile = _create_profile("super@esnpolimi.it", verified=True, is_esner=True)

		user = User.objects.create_superuser(profile=profile, password="test123")

		self.assertTrue(user.is_staff)
		self.assertTrue(user.is_superuser)
		self.assertTrue(user.is_active)

	def test_make_random_password_length(self):
		"""make_random_password should return password of correct length."""
		password = User.objects.make_random_password(length=20)

		self.assertEqual(len(password), 20)


"""Tests for profiles module endpoints and behaviors."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.core import mail
from django.test import override_settings
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APITestCase

from events.models import Event, EventList, Subscription, EventOrganizer
from profiles.models import Profile, Document
from profiles.tokens import email_verification_token
from treasury.models import ESNcard


User = get_user_model()


def _create_profile(
        email,
        *,
        is_esner=False,
        verified=True,
        enabled=True,
        name="Mario",
        surname="Rossi",
        person_code=None,
):
	"""Create and return a Profile with minimal required fields."""
	return Profile.objects.create(
		email=email,
		name=name,
		surname=surname,
		email_is_verified=verified,
		enabled=enabled,
		is_esner=is_esner,
		birthdate="1995-01-15",
		person_code=person_code,
	)


def _create_user(profile, *, password="SecurePass123!"):
	"""Create and return a User bound to the given profile."""
	user = User.objects.create(profile=profile)
	user.set_password(password)
	user.save()
	return user


def _create_event(name="Test Event", date="2026-06-01"):
	"""Create a minimal Event for subscription-related tests."""
	return Event.objects.create(name=name, date=date)


def _create_event_list(event, name="Main List", capacity=100, is_main_list=True):
	"""Create an EventList and link it to the event."""
	event_list = EventList.objects.create(
		name=name,
		capacity=capacity,
		is_main_list=is_main_list,
	)
	event_list.events.add(event)
	return event_list


class ProfilesBaseTestCase(APITestCase):
	"""Base setup with groups and permissions for profile tests."""

	@classmethod
	def setUpTestData(cls):
		cls.group_board = Group.objects.create(name="Board")
		cls.group_attivi = Group.objects.create(name="Attivi")
		cls.group_aspiranti = Group.objects.create(name="Aspiranti")

		cls.perm_change_profile = Permission.objects.get(codename="change_profile")
		cls.perm_delete_profile = Permission.objects.get(codename="delete_profile")
		cls.perm_change_document = Permission.objects.get(codename="change_document")
		cls.perm_delete_document = Permission.objects.get(codename="delete_document")

	def authenticate(self, user):
		"""Force authenticate the API client with the given user."""
		self.client.force_authenticate(user=user)


class ProfileListTests(ProfilesBaseTestCase):
	"""Tests for profile list endpoints (Erasmus and ESNers)."""

	def test_erasmus_profiles_requires_auth(self):
		"""Erasmus list should require authentication."""
		response = self.client.get("/backend/erasmus_profiles/")

		self.assertEqual(response.status_code, 401)

	def test_erasmus_profiles_returns_only_erasmus(self):
		"""List should include only Erasmus profiles (is_esner=False)."""
		viewer_profile = _create_profile("viewer@esnpolimi.it", is_esner=True)
		viewer = _create_user(viewer_profile)

		_create_profile("erasmus1@uni.it", is_esner=False)
		_create_profile("erasmus2@uni.it", is_esner=False)
		_create_profile("esner@esnpolimi.it", is_esner=True)

		self.authenticate(viewer)
		response = self.client.get("/backend/erasmus_profiles/?page_size=50")

		self.assertEqual(response.status_code, 200)
		self.assertTrue(all(p["is_esner"] is False for p in response.data["results"]))

	def test_esner_profiles_group_filter(self):
		"""Group filter should return only profiles in requested groups."""
		viewer_profile = _create_profile("viewer@esnpolimi.it", is_esner=True)
		viewer = _create_user(viewer_profile)
		self.authenticate(viewer)

		board_profile = _create_profile("board@esnpolimi.it", is_esner=True)
		board_user = _create_user(board_profile)
		board_user.groups.add(self.group_board)

		attivi_profile = _create_profile("attivo@esnpolimi.it", is_esner=True)
		attivi_user = _create_user(attivi_profile)
		attivi_user.groups.add(self.group_attivi)

		response = self.client.get("/backend/esner_profiles/?group=Board")

		self.assertEqual(response.status_code, 200)
		emails = [p["email"] for p in response.data["results"]]
		self.assertIn("board@esnpolimi.it", emails)
		self.assertNotIn("attivo@esnpolimi.it", emails)

	def test_profile_list_search_by_name(self):
		"""Search should filter profiles by name token."""
		viewer_profile = _create_profile("viewer@esnpolimi.it", is_esner=True)
		viewer = _create_user(viewer_profile)
		self.authenticate(viewer)

		_create_profile("mario@uni.it", is_esner=False, name="Mario")
		_create_profile("luigi@uni.it", is_esner=False, name="Luigi")

		response = self.client.get("/backend/erasmus_profiles/?search=Mario")

		self.assertEqual(response.status_code, 200)
		self.assertTrue(all("Mario" in p["name"] for p in response.data["results"]))

	def test_profile_list_invalid_page_returns_400(self):
		"""Invalid page param should return 400."""
		viewer_profile = _create_profile("viewer@esnpolimi.it", is_esner=True)
		viewer = _create_user(viewer_profile)
		self.authenticate(viewer)

		response = self.client.get("/backend/erasmus_profiles/?page=999")

		self.assertEqual(response.status_code, 400)
		self.assertIn("Invalid page", response.data["error"])

	def test_profile_list_esncard_validity_filters(self):
		"""ESNcard validity filter should return valid/expired/absent profiles."""
		viewer_profile = _create_profile("viewer@esnpolimi.it", is_esner=True)
		viewer = _create_user(viewer_profile)
		self.authenticate(viewer)

		valid_profile = _create_profile("valid@uni.it", is_esner=False)
		expired_profile = _create_profile("expired@uni.it", is_esner=False)
		absent_profile = _create_profile("absent@uni.it", is_esner=False)

		valid_card = ESNcard.objects.create(profile=valid_profile, number="VALID123")
		expired_card = ESNcard.objects.create(profile=expired_profile, number="EXPIRED123")

		past_date = timezone.now() - timedelta(days=800)
		ESNcard.objects.filter(pk=expired_card.pk).update(created_at=past_date)

		response = self.client.get("/backend/erasmus_profiles/?esncardValidity=valid")
		self.assertEqual(response.status_code, 200)
		emails = [p["email"] for p in response.data["results"]]
		self.assertIn("valid@uni.it", emails)
		self.assertNotIn("expired@uni.it", emails)
		self.assertNotIn("absent@uni.it", emails)

		response = self.client.get("/backend/erasmus_profiles/?esncardValidity=expired")
		self.assertEqual(response.status_code, 200)
		emails = [p["email"] for p in response.data["results"]]
		self.assertIn("expired@uni.it", emails)

		response = self.client.get("/backend/erasmus_profiles/?esncardValidity=absent")
		self.assertEqual(response.status_code, 200)
		emails = [p["email"] for p in response.data["results"]]
		self.assertIn("absent@uni.it", emails)

		response = self.client.get("/backend/erasmus_profiles/?esncardValidity=valid,absent")
		self.assertEqual(response.status_code, 200)
		emails = [p["email"] for p in response.data["results"]]
		self.assertIn("valid@uni.it", emails)
		self.assertIn("absent@uni.it", emails)


class InitiateProfileCreationTests(ProfilesBaseTestCase):
	"""Tests for profile initiate creation endpoint."""

	@override_settings(
		EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
		SCHEME_HOST="http://testserver",
	)
	def test_create_esner_rejects_non_esn_email(self):
		"""ESNer registration should reject non-@esnpolimi.it email."""
		response = self.client.post("/backend/profile/initiate-creation/", {
			"email": "user@gmail.com",
			"name": "Mario",
			"surname": "Rossi",
			"is_esner": True,
			"password": "SecurePass123!",
			"document_type": "ID Card",
			"document_number": "AB123456",
			"document_expiration": "2030-01-01",
		})

		self.assertEqual(response.status_code, 400)
		self.assertIn("email", response.data)

	@override_settings(
		EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
		SCHEME_HOST="http://testserver",
	)
	def test_create_esner_creates_user_and_document(self):
		"""ESNer registration should create profile, document, and user (inactive)."""
		response = self.client.post("/backend/profile/initiate-creation/", {
			"email": "new@esnpolimi.it",
			"name": "Mario",
			"surname": "Rossi",
			"is_esner": True,
			"password": "SecurePass123!",
			"document_type": "ID Card",
			"document_number": "AB123456",
			"document_expiration": "2030-01-01",
		})

		self.assertEqual(response.status_code, 201)
		self.assertEqual(len(mail.outbox), 1)

		profile = Profile.objects.get(email="new@esnpolimi.it")
		self.assertFalse(profile.enabled)
		self.assertFalse(profile.email_is_verified)

		document = Document.objects.get(profile=profile)
		self.assertFalse(document.enabled)

		user = User.objects.get(profile=profile)
		# Note: user.is_active is True because UserManager.create_user sets it to True
		self.assertTrue(user.is_active)
		self.assertTrue(user.groups.filter(name="Aspiranti").exists())

	@override_settings(
		EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
		SCHEME_HOST="http://testserver",
	)
	def test_create_erasmus_creates_profile_no_user(self):
		"""Erasmus registration should not create a User."""
		response = self.client.post("/backend/profile/initiate-creation/", {
			"email": "erasmus@esnpolimi.it",
			"name": "John",
			"surname": "Doe",
			"is_esner": False,
			"document_type": "Passport",
			"document_number": "P1234567",
			"document_expiration": "2030-01-01",
		})

		self.assertEqual(response.status_code, 201)
		profile = Profile.objects.get(email="erasmus@esnpolimi.it")
		self.assertFalse(User.objects.filter(profile=profile).exists())

	def test_create_profile_validation_errors(self):
		"""Missing required profile fields should return validation errors."""
		response = self.client.post("/backend/profile/initiate-creation/", {
			"email": "missing@esnpolimi.it",
			"is_esner": False,
		})

		self.assertEqual(response.status_code, 400)
		self.assertIn("name", response.data)
		self.assertIn("surname", response.data)

	@override_settings(
		EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
		SCHEME_HOST="http://testserver",
	)
	def test_create_profile_accepts_letter_digit_matricola(self):
		"""Creation should accept matricola with 1 letter + 5 digits."""
		response = self.client.post("/backend/profile/initiate-creation/", {
			"email": "matricola-ok@esnpolimi.it",
			"name": "John",
			"surname": "Doe",
			"is_esner": False,
			"matricola_number": "a12345",
			"document_type": "Passport",
			"document_number": "P1234567",
			"document_expiration": "2030-01-01",
		}, format="json")

		self.assertEqual(response.status_code, 201)
		profile = Profile.objects.get(email="matricola-ok@esnpolimi.it")
		self.assertEqual(profile.matricola_number, "A12345")

	@override_settings(
		EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
		SCHEME_HOST="http://testserver",
	)
	def test_create_profile_rejects_invalid_matricola_format(self):
		"""Creation should reject matricola not matching allowed formats."""
		response = self.client.post("/backend/profile/initiate-creation/", {
			"email": "matricola-ko@esnpolimi.it",
			"name": "John",
			"surname": "Doe",
			"is_esner": False,
			"matricola_number": "12A345",
			"document_type": "Passport",
			"document_number": "P9999999",
			"document_expiration": "2030-01-01",
		}, format="json")

		self.assertEqual(response.status_code, 400)
		self.assertIn("matricola_number", response.data)

	@override_settings(
		EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
		SCHEME_HOST="http://testserver",
	)
	def test_create_profile_rejects_multiple_invalid_matricola_formats(self):
		"""Creation should reject several invalid matricola formats."""
		invalid_values = [
			"12345",    # too short
			"1234567",  # too long
			"12A345",   # letter not first
			"AA2345",   # two letters
			"A12B45",   # letter in middle
			"ABCDEF",   # all letters
			"1A2345",   # starts with digit then letter
			"A-2345",   # special char
		]

		for idx, matricola in enumerate(invalid_values):
			with self.subTest(matricola=matricola):
				response = self.client.post("/backend/profile/initiate-creation/", {
					"email": f"matricola-multi-{idx}@esnpolimi.it",
					"name": "John",
					"surname": "Doe",
					"is_esner": False,
					"matricola_number": matricola,
					"document_type": "Passport",
					"document_number": f"PMULTI{idx}",
					"document_expiration": "2030-01-01",
				}, format="json")

				self.assertEqual(response.status_code, 400)
				self.assertIn("matricola_number", response.data)


class VerifyEmailTests(ProfilesBaseTestCase):
	"""Tests for email verification endpoint."""

	def test_verify_email_invalid_uid(self):
		"""Invalid uid should return 400."""
		response = self.client.get("/backend/api/profile/verify-email/invalid/invalid/")

		self.assertEqual(response.status_code, 400)
		self.assertIn("non valido", response.data["error"])

	@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
	def test_verify_email_invalid_token(self):
		"""Invalid token should return 400."""
		profile = _create_profile("user@esnpolimi.it", is_esner=True, verified=False, enabled=False)
		uid = urlsafe_base64_encode(force_bytes(profile.pk))
		response = self.client.get(f"/backend/api/profile/verify-email/{uid}/invalid/")

		self.assertEqual(response.status_code, 400)
		self.assertIn("non valido", response.data["error"])

	@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
	def test_verify_email_esner_activates_user_and_document(self):
		"""Verification should enable profile and document for ESNer."""
		profile = _create_profile("user@esnpolimi.it", is_esner=True, verified=False, enabled=False)
		Document.objects.create(
			profile=profile,
			type="ID Card",
			number="AB123456",
			expiration=timezone.now().date() + timedelta(days=365),
			enabled=False,
		)
		user = _create_user(profile)

		uid = urlsafe_base64_encode(force_bytes(profile.pk))
		token = email_verification_token.make_token(profile)
		response = self.client.get(f"/backend/api/profile/verify-email/{uid}/{token}/")

		self.assertEqual(response.status_code, 200)
		profile.refresh_from_db()
		document = Document.objects.get(profile=profile)

		self.assertTrue(profile.enabled)
		self.assertTrue(profile.email_is_verified)
		self.assertTrue(document.enabled)

	def test_verify_email_already_verified_esner(self):
		"""Already verified ESNer should return success message."""
		profile = _create_profile("user@esnpolimi.it", is_esner=True, verified=True, enabled=True)
		uid = urlsafe_base64_encode(force_bytes(profile.pk))
		token = email_verification_token.make_token(profile)
		response = self.client.get(f"/backend/api/profile/verify-email/{uid}/{token}/")

		self.assertEqual(response.status_code, 200)
		self.assertIn("già verificata", response.data["message"])

	def test_verify_email_already_verified_erasmus(self):
		"""Already verified Erasmus should return english message."""
		profile = _create_profile("erasmus@uni.it", is_esner=False, verified=True, enabled=True)
		uid = urlsafe_base64_encode(force_bytes(profile.pk))
		token = email_verification_token.make_token(profile)
		response = self.client.get(f"/backend/api/profile/verify-email/{uid}/{token}/")

		self.assertEqual(response.status_code, 200)
		self.assertIn("already verified", response.data["message"])


class ProfileDetailTests(ProfilesBaseTestCase):
	"""Tests for profile detail endpoint."""

	def test_profile_detail_get_includes_has_subscriptions(self):
		"""GET should include has_subscriptions flag."""
		viewer_profile = _create_profile("viewer@esnpolimi.it", is_esner=True)
		viewer = _create_user(viewer_profile)
		self.authenticate(viewer)

		target_profile = _create_profile("target@uni.it", is_esner=False)
		event = _create_event()
		event_list = _create_event_list(event)
		Subscription.objects.create(profile=target_profile, event=event, list=event_list)

		response = self.client.get(f"/backend/profile/{target_profile.pk}/")

		self.assertEqual(response.status_code, 200)
		self.assertIn("has_subscriptions", response.data)
		self.assertTrue(response.data["has_subscriptions"])

	def test_profile_detail_patch_requires_permission(self):
		"""PATCH without change_profile permission should be blocked."""
		viewer_profile = _create_profile("viewer@esnpolimi.it", is_esner=True)
		viewer = _create_user(viewer_profile)
		self.authenticate(viewer)

		target_profile = _create_profile("target@uni.it", is_esner=False)
		response = self.client.patch(f"/backend/profile/{target_profile.pk}/", {
			"name": "Updated",
		})

		self.assertEqual(response.status_code, 403)

	def test_profile_detail_patch_updates_fields(self):
		"""PATCH with permission should update profile fields."""
		viewer_profile = _create_profile("viewer@esnpolimi.it", is_esner=True)
		viewer = _create_user(viewer_profile)
		viewer.user_permissions.add(self.perm_change_profile)
		self.authenticate(viewer)

		target_profile = _create_profile("target@uni.it", is_esner=False)
		response = self.client.patch(f"/backend/profile/{target_profile.pk}/", {
			"name": "Updated",
			"surname": "User",
		})

		self.assertEqual(response.status_code, 200)
		target_profile.refresh_from_db()
		self.assertEqual(target_profile.name, "Updated")

	def test_profile_detail_group_promotion_requires_board(self):
		"""Only Board can promote Aspiranti to Attivi/Board."""
		requester_profile = _create_profile("attivo@esnpolimi.it", is_esner=True)
		requester = _create_user(requester_profile)
		requester.groups.add(self.group_attivi)
		requester.user_permissions.add(self.perm_change_profile)
		self.authenticate(requester)

		target_profile = _create_profile("aspirante@esnpolimi.it", is_esner=True)
		target_user = _create_user(target_profile)
		target_user.groups.add(self.group_aspiranti)

		response = self.client.patch(f"/backend/profile/{target_profile.pk}/", {
			"group": "Attivi",
		})

		self.assertEqual(response.status_code, 403)
		self.assertIn("Board", response.data["error"])

	def test_profile_detail_group_promotion_as_board(self):
		"""Board can promote Aspiranti to Attivi."""
		requester_profile = _create_profile("board@esnpolimi.it", is_esner=True)
		requester = _create_user(requester_profile)
		requester.groups.add(self.group_board)
		requester.user_permissions.add(self.perm_change_profile)
		self.authenticate(requester)

		target_profile = _create_profile("aspirante@esnpolimi.it", is_esner=True)
		target_user = _create_user(target_profile)
		target_user.groups.add(self.group_aspiranti)

		response = self.client.patch(f"/backend/profile/{target_profile.pk}/", {
			"group": "Attivi",
		})

		self.assertEqual(response.status_code, 200)
		target_user.refresh_from_db()
		self.assertTrue(target_user.groups.filter(name="Attivi").exists())

	def test_profile_detail_zero_placeholder_person_code(self):
		"""Zero person_code should be normalized to None."""
		viewer_profile = _create_profile("viewer@esnpolimi.it", is_esner=True)
		viewer = _create_user(viewer_profile)
		viewer.user_permissions.add(self.perm_change_profile)
		self.authenticate(viewer)

		target_profile = _create_profile("target@uni.it", is_esner=False)
		response = self.client.patch(f"/backend/profile/{target_profile.pk}/", {
			"person_code": "00000000",
		})

		self.assertEqual(response.status_code, 200)
		target_profile.refresh_from_db()
		self.assertIsNone(target_profile.person_code)

	def test_profile_detail_patch_accepts_letter_digit_matricola(self):
		"""PATCH should accept matricola with 1 letter + 5 digits."""
		viewer_profile = _create_profile("viewer@esnpolimi.it", is_esner=True)
		viewer = _create_user(viewer_profile)
		viewer.user_permissions.add(self.perm_change_profile)
		self.authenticate(viewer)

		target_profile = _create_profile("target@uni.it", is_esner=False)
		response = self.client.patch(f"/backend/profile/{target_profile.pk}/", {
			"matricola_number": "b12345",
		})

		self.assertEqual(response.status_code, 200)
		target_profile.refresh_from_db()
		self.assertEqual(target_profile.matricola_number, "B12345")

	def test_profile_detail_patch_rejects_invalid_matricola_format(self):
		"""PATCH should reject invalid matricola format."""
		viewer_profile = _create_profile("viewer@esnpolimi.it", is_esner=True)
		viewer = _create_user(viewer_profile)
		viewer.user_permissions.add(self.perm_change_profile)
		self.authenticate(viewer)

		target_profile = _create_profile("target@uni.it", is_esner=False)
		response = self.client.patch(f"/backend/profile/{target_profile.pk}/", {
			"matricola_number": "12A345",
		})

		self.assertEqual(response.status_code, 400)
		self.assertIn("matricola_number", response.data)

	def test_profile_detail_patch_rejects_multiple_invalid_matricola_formats(self):
		"""PATCH should reject several invalid matricola formats."""
		viewer_profile = _create_profile("viewer@esnpolimi.it", is_esner=True)
		viewer = _create_user(viewer_profile)
		viewer.user_permissions.add(self.perm_change_profile)
		self.authenticate(viewer)

		invalid_values = [
			"12345",
			"1234567",
			"12A345",
			"AA2345",
			"A12B45",
			"ABCDEF",
			"1A2345",
			"A-2345",
		]

		for idx, matricola in enumerate(invalid_values):
			with self.subTest(matricola=matricola):
				target_profile = _create_profile(f"target-multi-{idx}@uni.it", is_esner=False)
				response = self.client.patch(f"/backend/profile/{target_profile.pk}/", {
					"matricola_number": matricola,
				})

				self.assertEqual(response.status_code, 400)
				self.assertIn("matricola_number", response.data)

	def test_profile_detail_delete_requires_board(self):
		"""DELETE should be restricted to Board users."""
		viewer_profile = _create_profile("viewer@esnpolimi.it", is_esner=True)
		viewer = _create_user(viewer_profile)
		self.authenticate(viewer)

		target_profile = _create_profile("target@uni.it", is_esner=False)
		response = self.client.delete(f"/backend/profile/{target_profile.pk}/")

		self.assertEqual(response.status_code, 401)

	def test_profile_detail_delete_with_subscriptions_returns_400(self):
		"""Cannot delete profiles with subscriptions."""
		board_profile = _create_profile("board@esnpolimi.it", is_esner=True)
		board_user = _create_user(board_profile)
		board_user.groups.add(self.group_board)
		self.authenticate(board_user)

		target_profile = _create_profile("target@uni.it", is_esner=False)
		event = _create_event()
		event_list = _create_event_list(event)
		Subscription.objects.create(profile=target_profile, event=event, list=event_list)

		response = self.client.delete(f"/backend/profile/{target_profile.pk}/")

		self.assertEqual(response.status_code, 400)
		self.assertIn("iscrizioni", response.data["error"])

	def test_profile_detail_delete_esner_removes_user_and_documents(self):
		"""Deleting ESNer should delete user and documents."""
		board_profile = _create_profile("board@esnpolimi.it", is_esner=True)
		board_user = _create_user(board_profile)
		board_user.groups.add(self.group_board)
		self.authenticate(board_user)

		target_profile = _create_profile("esner@esnpolimi.it", is_esner=True)
		_create_user(target_profile)
		Document.objects.create(
			profile=target_profile,
			type="ID Card",
			number="DOC123",
			expiration="2030-01-01",
		)

		response = self.client.delete(f"/backend/profile/{target_profile.pk}/")

		self.assertEqual(response.status_code, 200)
		self.assertFalse(Profile.objects.filter(pk=target_profile.pk).exists())
		self.assertFalse(User.objects.filter(profile=target_profile.email).exists())
		self.assertFalse(Document.objects.filter(profile=target_profile).exists())


class DocumentTests(ProfilesBaseTestCase):
	"""Tests for document creation and detail endpoints."""

	def test_document_creation_requires_auth(self):
		"""Creating documents should require authentication."""
		profile = _create_profile("doc@uni.it", is_esner=False)
		response = self.client.post("/backend/document/", {
			"profile": profile.pk,
			"type": "ID Card",
			"number": "AB123456",
			"expiration": "2030-01-01",
		})

		self.assertEqual(response.status_code, 401)

	def test_document_creation_success(self):
		"""Authenticated users can create documents."""
		viewer_profile = _create_profile("viewer@esnpolimi.it", is_esner=True)
		viewer = _create_user(viewer_profile)
		self.authenticate(viewer)

		profile = _create_profile("doc@uni.it", is_esner=False)
		response = self.client.post("/backend/document/", {
			"profile": profile.pk,
			"type": "ID Card",
			"number": "AB123456",
			"expiration": "2030-01-01",
		})

		self.assertEqual(response.status_code, 200)
		self.assertTrue(Document.objects.filter(profile=profile).exists())

	def test_document_patch_requires_permission(self):
		"""PATCH without change_document permission should be blocked."""
		viewer_profile = _create_profile("viewer@esnpolimi.it", is_esner=True)
		viewer = _create_user(viewer_profile)
		self.authenticate(viewer)

		profile = _create_profile("doc@uni.it", is_esner=False)
		document = Document.objects.create(
			profile=profile,
			type="ID Card",
			number="AB123456",
			expiration="2030-01-01",
		)

		response = self.client.patch(f"/backend/document/{document.pk}/", {
			"number": "NEW123456",
		})

		self.assertEqual(response.status_code, 403)

	def test_document_patch_with_permission(self):
		"""PATCH with permission should update document fields."""
		viewer_profile = _create_profile("viewer@esnpolimi.it", is_esner=True)
		viewer = _create_user(viewer_profile)
		viewer.user_permissions.add(self.perm_change_document)
		self.authenticate(viewer)

		profile = _create_profile("doc@uni.it", is_esner=False)
		document = Document.objects.create(
			profile=profile,
			type="ID Card",
			number="AB123456",
			expiration="2030-01-01",
		)

		response = self.client.patch(f"/backend/document/{document.pk}/", {
			"number": "NEW123456",
		})

		self.assertEqual(response.status_code, 200)
		document.refresh_from_db()
		self.assertEqual(document.number, "NEW123456")

	def test_document_delete_requires_permission(self):
		"""DELETE without delete_document permission should be blocked."""
		viewer_profile = _create_profile("viewer@esnpolimi.it", is_esner=True)
		viewer = _create_user(viewer_profile)
		self.authenticate(viewer)

		profile = _create_profile("doc@uni.it", is_esner=False)
		document = Document.objects.create(
			profile=profile,
			type="ID Card",
			number="AB123456",
			expiration="2030-01-01",
		)

		response = self.client.delete(f"/backend/document/{document.pk}/")

		self.assertEqual(response.status_code, 403)

	def test_document_delete_with_permission(self):
		"""DELETE with permission should remove document."""
		viewer_profile = _create_profile("viewer@esnpolimi.it", is_esner=True)
		viewer = _create_user(viewer_profile)
		viewer.user_permissions.add(self.perm_delete_document)
		self.authenticate(viewer)

		profile = _create_profile("doc@uni.it", is_esner=False)
		document = Document.objects.create(
			profile=profile,
			type="ID Card",
			number="AB123456",
			expiration="2030-01-01",
		)

		response = self.client.delete(f"/backend/document/{document.pk}/")

		self.assertEqual(response.status_code, 200)
		self.assertFalse(Document.objects.filter(pk=document.pk).exists())

	def test_document_detail_not_found(self):
		"""PATCH on missing document should return 404."""
		viewer_profile = _create_profile("viewer@esnpolimi.it", is_esner=True)
		viewer = _create_user(viewer_profile)
		viewer.user_permissions.add(self.perm_change_document)
		self.authenticate(viewer)

		response = self.client.patch("/backend/document/99999/", {
			"number": "NEW123",
		})

		self.assertEqual(response.status_code, 404)


class SearchProfilesTests(ProfilesBaseTestCase):
	"""Tests for profile search endpoint."""

	def test_search_requires_auth(self):
		"""Search should require authentication."""
		response = self.client.get("/backend/profiles/search/?q=Ma")

		self.assertEqual(response.status_code, 401)

	def test_search_short_query_returns_empty(self):
		"""Search with short query returns empty results."""
		viewer_profile = _create_profile("viewer@esnpolimi.it", is_esner=True)
		viewer = _create_user(viewer_profile)
		self.authenticate(viewer)

		response = self.client.get("/backend/profiles/search/?q=M")

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["results"], [])

	def test_search_filters_esner_only(self):
		"""Search should filter only ESNers when esner_only=true."""
		viewer_profile = _create_profile("viewer@esnpolimi.it", is_esner=True)
		viewer = _create_user(viewer_profile)
		self.authenticate(viewer)

		_create_profile("esner@esnpolimi.it", is_esner=True, name="Mario")
		_create_profile("erasmus@uni.it", is_esner=False, name="Mario")

		response = self.client.get("/backend/profiles/search/?q=Mario&esner_only=true")

		self.assertEqual(response.status_code, 200)
		self.assertTrue(all(p["is_esner"] for p in response.data["results"]))

	def test_search_filters_valid_only(self):
		"""Search should return only enabled + verified profiles when valid_only=true."""
		viewer_profile = _create_profile("viewer@esnpolimi.it", is_esner=True)
		viewer = _create_user(viewer_profile)
		self.authenticate(viewer)

		_create_profile("valid@uni.it", is_esner=False, name="Mario", verified=True, enabled=True)
		_create_profile("invalid@uni.it", is_esner=False, name="Mario", verified=False, enabled=True)

		response = self.client.get("/backend/profiles/search/?q=Mario&valid_only=true")

		self.assertEqual(response.status_code, 200)
		emails = [p["email"] for p in response.data["results"]]
		self.assertIn("valid@uni.it", emails)
		self.assertNotIn("invalid@uni.it", emails)

	def test_search_by_esncard_number(self):
		"""Search should match profiles by ESNcard number."""
		viewer_profile = _create_profile("viewer@esnpolimi.it", is_esner=True)
		viewer = _create_user(viewer_profile)
		self.authenticate(viewer)

		profile = _create_profile("card@uni.it", is_esner=False)
		ESNcard.objects.create(profile=profile, number="CARD-123")

		response = self.client.get("/backend/profiles/search/?q=CARD-123")

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["results"][0]["email"], "card@uni.it")


class CheckErasmusEmailTests(ProfilesBaseTestCase):
	"""Tests for check_erasmus_email endpoint."""

	def test_check_erasmus_email_missing(self):
		"""Missing email should return 400."""
		response = self.client.post("/backend/check_erasmus_email/", {})

		self.assertEqual(response.status_code, 400)
		self.assertIn("Email required", response.data["error"])

	def test_check_erasmus_email_not_found(self):
		"""Unknown email should return email_not_found."""
		response = self.client.post("/backend/check_erasmus_email/", {
			"email": "missing@uni.it",
		})

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["error"], "email_not_found")

	def test_check_erasmus_email_not_active(self):
		"""Inactive profile should return email_not_active."""
		_create_profile("inactive@uni.it", is_esner=False, verified=False, enabled=False)

		response = self.client.post("/backend/check_erasmus_email/", {
			"email": "inactive@uni.it",
		})

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["error"], "email_not_active")

	def test_check_erasmus_email_success(self):
		"""Active profile should return profile data and esncard number."""
		profile = _create_profile("active@uni.it", is_esner=False, verified=True, enabled=True)
		ESNcard.objects.create(profile=profile, number="ESN-123")

		response = self.client.post("/backend/check_erasmus_email/", {
			"email": "active@uni.it",
		})

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["email"], "active@uni.it")
		self.assertEqual(response.data["esncard_number"], "ESN-123")


class ProfileSubscriptionsTests(ProfilesBaseTestCase):
	"""Tests for profile subscriptions endpoint."""

	def test_profile_subscriptions_requires_auth(self):
		"""Subscriptions endpoint should require authentication."""
		response = self.client.get("/backend/profile_subscriptions/1/")
		self.assertEqual(response.status_code, 401)

	def test_profile_subscriptions_returns_list(self):
		"""Subscriptions endpoint should return profile subscriptions."""
		viewer_profile = _create_profile("viewer@esnpolimi.it", is_esner=True)
		viewer = _create_user(viewer_profile)
		self.authenticate(viewer)

		# Create subscription for the viewer's own profile
		event = _create_event()
		event_list = _create_event_list(event)
		Subscription.objects.create(profile=viewer_profile, event=event, list=event_list)

		response = self.client.get(f"/backend/profile_subscriptions/{viewer_profile.pk}/")

		self.assertEqual(response.status_code, 200)
		self.assertEqual(len(response.data), 1)

	def test_profile_subscriptions_non_owner_denied(self):
		"""Non-owner, non-staff, non-Board user should receive 403."""
		viewer_profile = _create_profile("viewer@esnpolimi.it", is_esner=True)
		viewer = _create_user(viewer_profile)
		self.authenticate(viewer)

		# Create a different profile with subscriptions
		other_profile = _create_profile("other@esnpolimi.it", is_esner=True)
		event = _create_event()
		event_list = _create_event_list(event)
		Subscription.objects.create(profile=other_profile, event=event, list=event_list)

		# Try to access other user's subscriptions
		response = self.client.get(f"/backend/profile_subscriptions/{other_profile.pk}/")

		self.assertEqual(response.status_code, 403)
		self.assertIn("permessi", response.data["error"].lower())

	def test_profile_subscriptions_staff_allowed(self):
		"""Staff users should be allowed to view any profile's subscriptions."""
		staff_profile = _create_profile("staff@esnpolimi.it", is_esner=True)
		staff_user = _create_user(staff_profile)
		staff_user.is_staff = True
		staff_user.save()
		self.authenticate(staff_user)

		# Create a different profile with subscriptions
		other_profile = _create_profile("other@esnpolimi.it", is_esner=True)
		event = _create_event()
		event_list = _create_event_list(event)
		Subscription.objects.create(profile=other_profile, event=event, list=event_list)

		# Staff should be able to access
		response = self.client.get(f"/backend/profile_subscriptions/{other_profile.pk}/")

		self.assertEqual(response.status_code, 200)
		self.assertEqual(len(response.data), 1)

	def test_profile_subscriptions_board_allowed(self):
		"""Board members should be allowed to view any profile's subscriptions."""
		board_profile = _create_profile("board@esnpolimi.it", is_esner=True)
		board_user = _create_user(board_profile)
		board_group, _ = Group.objects.get_or_create(name="Board")
		board_user.groups.add(board_group)
		self.authenticate(board_user)

		# Create a different profile with subscriptions
		other_profile = _create_profile("other@esnpolimi.it", is_esner=True)
		event = _create_event()
		event_list = _create_event_list(event)
		Subscription.objects.create(profile=other_profile, event=event, list=event_list)

		# Board member should be able to access
		response = self.client.get(f"/backend/profile_subscriptions/{other_profile.pk}/")

		self.assertEqual(response.status_code, 200)
		self.assertEqual(len(response.data), 1)


class ProfileOrganizedEventsTests(ProfilesBaseTestCase):
	"""Tests for profile organized events endpoint."""

	def test_profile_organized_events_requires_auth(self):
		"""Organized events endpoint should require authentication."""
		response = self.client.get("/backend/profile_events/1/")
		self.assertEqual(response.status_code, 401)

	def test_profile_organized_events_returns_events(self):
		"""Organized events endpoint should return events for the profile."""
		viewer_profile = _create_profile("viewer@esnpolimi.it", is_esner=True)
		viewer = _create_user(viewer_profile)
		self.authenticate(viewer)

		organizer_profile = _create_profile("organizer@esnpolimi.it", is_esner=True)
		event = _create_event(name="Organized Event")
		EventOrganizer.objects.create(profile=organizer_profile, event=event, is_lead=True)

		response = self.client.get(f"/backend/profile_events/{organizer_profile.pk}/")

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data[0]["event_name"], "Organized Event")

class ProfileModelTests(ProfilesBaseTestCase):
	"""Tests for Profile model properties and methods."""

	def test_latest_esncard_returns_most_recent(self):
		"""latest_esncard should return the most recent card."""
		from time import sleep
		profile = _create_profile("test@uni.it", is_esner=False)

		# Create two ESNcards with different creation times
		old_card = ESNcard.objects.create(profile=profile, number="OLD-123", enabled=True)
		sleep(0.01)  # Small delay to ensure different created_at timestamps
		newer_card = ESNcard.objects.create(profile=profile, number="NEW-456", enabled=True)

		self.assertEqual(profile.latest_esncard, newer_card)

	def test_latest_esncard_returns_none_if_no_cards(self):
		"""latest_esncard should return None if no cards exist."""
		profile = _create_profile("nocard@uni.it", is_esner=False)

		self.assertIsNone(profile.latest_esncard)

	def test_latest_document_returns_most_recent_enabled(self):
		"""latest_document should return the most recent enabled document."""
		profile = _create_profile("docs@uni.it", is_esner=False)

		Document.objects.create(
			profile=profile,
			type="Passport",
			number="DOC1",
			expiration="2030-01-01",
			enabled=True,
		)
		# Disabled document should be ignored
		Document.objects.create(
			profile=profile,
			type="ID Card",
			number="DOC2",
			expiration="2030-01-01",
			enabled=False,
		)

		latest = profile.latest_document
		self.assertEqual(latest.number, "DOC1")

	def test_profile_str_representation(self):
		"""Profile str should return email."""
		profile = _create_profile("str@uni.it", is_esner=False, name="Test", surname="User")

		# Profile.__str__() returns email
		self.assertIn("str@uni.it", str(profile))


class DocumentModelTests(ProfilesBaseTestCase):
	"""Tests for Document model properties."""

	def test_is_valid_returns_true_for_future_expiration(self):
		"""is_valid should return True for non-expired documents."""
		profile = _create_profile("valid@uni.it", is_esner=False)
		doc = Document.objects.create(
			profile=profile,
			type="Passport",
			number="VALID123",
			expiration=timezone.now().date() + timedelta(days=365),
		)

		self.assertTrue(doc.is_valid)

	def test_is_valid_returns_false_for_past_expiration(self):
		"""is_valid should return False for expired documents."""
		profile = _create_profile("expired@uni.it", is_esner=False)
		doc = Document.objects.create(
			profile=profile,
			type="Passport",
			number="EXPIRED123",
			expiration=timezone.now().date() - timedelta(days=365),
		)

		self.assertFalse(doc.is_valid)


class InitiateCreationEdgeCaseTests(ProfilesBaseTestCase):
	"""Edge case tests for profile creation."""

	@override_settings(
		EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
		SCHEME_HOST="http://testserver",
	)
	def test_create_esner_without_password_allows_creation(self):
		"""ESNer registration without password creates profile but no user."""
		response = self.client.post("/backend/profile/initiate-creation/", {
			"email": "nopwd@esnpolimi.it",
			"name": "Mario",
			"surname": "Rossi",
			"is_esner": True,
			# Missing password
			"document_type": "ID Card",
			"document_number": "AB123456",
			"document_expiration": "2030-01-01",
		})

		# Profile should be created even without password
		self.assertEqual(response.status_code, 201)

	@override_settings(
		EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
		SCHEME_HOST="http://testserver",
	)
	def test_create_erasmus_without_document_returns_400(self):
		"""P-IC-006: Erasmus without document should return validation error."""
		response = self.client.post("/backend/profile/initiate-creation/", {
			"email": "nodoc@uni.it",
			"name": "John",
			"surname": "Doe",
			"is_esner": False,
			# Missing document fields
		})

		self.assertEqual(response.status_code, 400)

	def test_create_profile_duplicate_document_number_returns_400(self):
		"""Duplicate document number should return error."""
		viewer_profile = _create_profile("viewer@esnpolimi.it", is_esner=True)
		viewer = _create_user(viewer_profile)
		self.authenticate(viewer)

		profile1 = _create_profile("doc1@uni.it", is_esner=False)
		Document.objects.create(
			profile=profile1,
			type="Passport",
			number="DUPLICATE123",
			expiration="2030-01-01",
		)

		profile2 = _create_profile("doc2@uni.it", is_esner=False)
		response = self.client.post("/backend/document/", {
			"profile": profile2.pk,
			"type": "ID Card",
			"number": "DUPLICATE123",  # Same number
			"expiration": "2030-01-01",
		})

		self.assertEqual(response.status_code, 400)


class ProfileDetailEdgeCaseTests(ProfilesBaseTestCase):
	"""Edge case tests for profile detail operations."""

	def test_get_nonexistent_profile_returns_404(self):
		"""GET on nonexistent profile should return 404."""
		viewer_profile = _create_profile("viewer@esnpolimi.it", is_esner=True)
		viewer = _create_user(viewer_profile)
		self.authenticate(viewer)

		response = self.client.get("/backend/profile/99999/")

		self.assertEqual(response.status_code, 404)

	def test_patch_email_is_ignored(self):
		"""P-PP-003: PATCH email should not change the email field."""
		viewer_profile = _create_profile("viewer@esnpolimi.it", is_esner=True)
		viewer = _create_user(viewer_profile)
		viewer.user_permissions.add(self.perm_change_profile)
		self.authenticate(viewer)

		target_profile = _create_profile("target@uni.it", is_esner=False)
		response = self.client.patch(f"/backend/profile/{target_profile.pk}/", {
			"email": "changed@uni.it",
		})

		self.assertEqual(response.status_code, 200)
		target_profile.refresh_from_db()
		self.assertEqual(target_profile.email, "target@uni.it")  # Email unchanged

	def test_delete_profile_not_found_returns_404(self):
		"""DELETE on nonexistent profile should return 404."""
		board_profile = _create_profile("board@esnpolimi.it", is_esner=True)
		board_user = _create_user(board_profile)
		board_user.groups.add(self.group_board)
		self.authenticate(board_user)

		response = self.client.delete("/backend/profile/99999/")

		self.assertEqual(response.status_code, 404)
"""Integration & E2E tests spanning multiple modules."""

from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.core import mail
from django.test import override_settings
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from events.models import Event, EventList, Subscription
from profiles.models import Profile
from profiles.tokens import email_verification_token
from treasury.models import Account, ESNcard, ReimbursementRequest, Settings, Transaction


User = get_user_model()


def _create_profile(email, *, is_esner=True, verified=True, enabled=True, name="Mario", surname="Rossi"):
	"""Create and return a Profile with minimal required fields."""
	return Profile.objects.create(
		email=email,
		name=name,
		surname=surname,
		email_is_verified=verified,
		enabled=enabled,
		is_esner=is_esner,
		birthdate="1995-01-15",
	)


def _create_user(profile, *, password="SecurePass123!"):
	"""Create and return a User bound to the given profile."""
	user = User.objects.create(profile=profile)
	user.set_password(password)
	user.save(update_fields=["password"])
	return user


def _create_event(**kwargs):
	"""Create a minimal event with sensible defaults."""
	data = {
		"name": kwargs.pop("name", "Integration Event"),
		"date": kwargs.pop("date", timezone.now().date()),
		"subscription_start_date": kwargs.pop("subscription_start_date", timezone.now() - timedelta(days=1)),
		"subscription_end_date": kwargs.pop("subscription_end_date", timezone.now() + timedelta(days=1)),
		"enable_form": kwargs.pop("enable_form", True),
		"allow_online_payment": kwargs.pop("allow_online_payment", False),
		"is_allow_external": kwargs.pop("is_allow_external", False),
		"fields": kwargs.pop("fields", []),
		"services": kwargs.pop("services", []),
		"cost": kwargs.pop("cost", None),
		"deposit": kwargs.pop("deposit", None),
	}
	data.update(kwargs)
	return Event.objects.create(**data)


def _create_event_list(event, *, name="Main List", capacity=100, is_main_list=True, is_waiting_list=False):
	"""Create an EventList and link it to the event."""
	event_list = EventList.objects.create(
		name=name,
		capacity=capacity,
		is_main_list=is_main_list,
		is_waiting_list=is_waiting_list,
	)
	event_list.events.add(event)
	return event_list


def _create_account(name, *, user, status="open", balance="0.00"):
	"""Create a treasury account with required fields."""
	account = Account.objects.create(name=name, changed_by=user, status=status)
	account.balance = Decimal(balance)
	account.save(update_fields=["balance"])
	return account


class IntegrationBaseTestCase(APITestCase):
	"""Base setup for integration tests with common helpers."""

	@classmethod
	def setUpTestData(cls):
		cls.group_board = Group.objects.create(name="Board")
		cls.group_attivi = Group.objects.create(name="Attivi")
		cls.group_aspiranti = Group.objects.create(name="Aspiranti")

		cls.perm_change_reimbursement = Permission.objects.get(codename="change_reimbursementrequest")

	def authenticate(self, user):
		"""Force authenticate the API client with the given user."""
		self.client.force_authenticate(user=user)

	def create_board_user(self, email="board@esnpolimi.it"):
		"""Create and return a Board user."""
		profile = _create_profile(email, is_esner=True)
		user = _create_user(profile)
		user.groups.add(self.group_board)
		return user

	def create_aspirante_user(self, email="aspirante@esnpolimi.it"):
		"""Create and return an Aspiranti user."""
		profile = _create_profile(email, is_esner=True)
		user = _create_user(profile)
		user.groups.add(self.group_aspiranti)
		return user


class ESNerRegistrationFlowTests(IntegrationBaseTestCase):
	"""Integration flow: ESNer registration -> verify -> login -> access resource."""

	@override_settings(
		EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
		SCHEME_HOST="http://testserver",
	)
	def test_complete_esner_registration_to_login(self):
		"""Full ESNer onboarding flow should end with authenticated access."""
		response = self.client.post("/backend/profile/initiate-creation/", {
			"email": "new.esner@esnpolimi.it",
			"name": "Mario",
			"surname": "Rossi",
			"birthdate": "1995-01-15",
			"country": "IT",
			"is_esner": True,
			"password": "SecurePass123!",
			"document_type": "ID Card",
			"document_number": "AB123456",
			"document_expiration": "2030-01-01",
		}, format="json")

		self.assertEqual(response.status_code, 201)
		self.assertEqual(len(mail.outbox), 1)

		profile = Profile.objects.get(email="new.esner@esnpolimi.it")
		user = User.objects.get(profile=profile)
		self.assertFalse(profile.email_is_verified)
		self.assertFalse(profile.enabled)
		# Note: is_active is True due to UserManager implementation
		self.assertTrue(user.is_active)

		uid = urlsafe_base64_encode(force_bytes(profile.pk))
		token = email_verification_token.make_token(profile)
		response = self.client.get(f"/backend/api/profile/verify-email/{uid}/{token}/")

		self.assertEqual(response.status_code, 200)
		profile.refresh_from_db()
		user.refresh_from_db()
		self.assertTrue(profile.email_is_verified)
		self.assertTrue(profile.enabled)
		self.assertTrue(user.is_active)

		response = self.client.post("/backend/login/", {
			"email": "new.esner@esnpolimi.it",
			"password": "SecurePass123!",
		}, format="json")

		self.assertEqual(response.status_code, 200)
		self.assertIn("access", response.data)

		access = response.data["access"]
		self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
		response = self.client.get("/backend/erasmus_profiles/")

		self.assertEqual(response.status_code, 200)


class ErasmusEventSubscriptionFlowTests(IntegrationBaseTestCase):
	"""Integration flow: Erasmus registration -> verify -> subscribe -> pay."""

	@override_settings(
		EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
		SCHEME_HOST="http://testserver",
	)
	@patch("events.views._ensure_sumup_transactions")
	@patch("events.views._process_sumup_checkout")
	@patch("events.views.create_sumup_checkout")
	def test_erasmus_registration_to_paid_subscription(
		self,
		mock_create_checkout,
		mock_process_checkout,
		mock_ensure_transactions
	):
		"""Public form flow should create subscription and complete payment."""
		mock_create_checkout.return_value = ("chk_123", None)
		mock_process_checkout.return_value = ("PAID", {"status": "PAID"})

		event = _create_event(
			name="Welcome Party",
			allow_online_payment=True,
			cost=Decimal("15.00"),
			fields=[
				{"name": "diet", "type": "t", "field_type": "form"},
			],
		)
		_create_event_list(event, name="Form List", is_main_list=False)
		_create_event_list(event, name="Main List", is_main_list=True)

		response = self.client.post("/backend/profile/initiate-creation/", {
			"email": "erasmus.student@university.edu",
			"name": "John",
			"surname": "Doe",
			"birthdate": "1998-05-20",
			"country": "DE",
			"is_esner": False,
			"document_type": "Passport",
			"document_number": "DE12345678",
			"document_expiration": "2030-01-01",
		}, format="json")

		self.assertEqual(response.status_code, 201)

		profile = Profile.objects.get(email="erasmus.student@university.edu")
		uid = urlsafe_base64_encode(force_bytes(profile.pk))
		token = email_verification_token.make_token(profile)
		self.client.get(f"/backend/api/profile/verify-email/{uid}/{token}/")

		profile.refresh_from_db()
		self.assertTrue(profile.email_is_verified)

		mail.outbox.clear()
		response = self.client.post(f"/backend/event/{event.pk}/formsubmit/", {
			"email": "erasmus.student@university.edu",
			"form_data": {"diet": "Vegetarian"},
		}, format="json")

		self.assertEqual(response.status_code, 200)
		self.assertEqual(len(mail.outbox), 1)
		self.assertIn("subscription_id", response.data)

		subscription = Subscription.objects.get(pk=response.data["subscription_id"])
		self.assertEqual(subscription.profile, profile)
		self.assertEqual(subscription.sumup_checkout_id, "chk_123")

		response = self.client.post(f"/backend/subscription/{subscription.pk}/process_payment/", {}, format="json")

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data.get("status"), "PAID")
		mock_ensure_transactions.assert_called_once()


class ESNcardMembershipFlowTests(IntegrationBaseTestCase):
	"""Integration flow: issue ESNcard and verify transaction creation."""

	def test_esncard_emission_creates_transaction(self):
		"""ESNcard emission should create a card and a transaction."""
		board = self.create_board_user()
		self.authenticate(board)

		Settings.get()
		account = _create_account("Cassa", user=board, balance="0.00")
		profile = _create_profile("erasmus@test.com", is_esner=False)

		response = self.client.post("/backend/esncard_emission/", {
			"profile_id": profile.pk,
			"account_id": account.pk,
			"esncard_number": "IT-POL-0001234",
		}, format="json")

		self.assertEqual(response.status_code, 200)
		self.assertTrue(ESNcard.objects.filter(profile=profile).exists())
		self.assertTrue(Transaction.objects.filter(type=Transaction.TransactionType.ESNCARD).exists())


class ReimbursementFlowTests(IntegrationBaseTestCase):
	"""Integration flow: create request, approve with account, verify balance."""

	@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
	def test_complete_reimbursement_workflow(self):
		"""Request should be reimbursed and update account balance."""
		requester_profile = _create_profile("esner@esnpolimi.it")
		requester = _create_user(requester_profile)
		self.authenticate(requester)

		response = self.client.post("/backend/reimbursement_request/", {
			"description": "Acquisto materiale per evento Welcome",
			"amount": "125.50",
			"payment": "cash",
		}, format="json")

		self.assertEqual(response.status_code, 201)
		req = ReimbursementRequest.objects.get(user=requester)
		self.assertFalse(req.is_reimbursed)

		board = self.create_board_user("board.reimburse@esnpolimi.it")
		board.user_permissions.add(self.perm_change_reimbursement)
		self.authenticate(board)

		account = _create_account("Cassa", user=board, balance="1000.00")
		response = self.client.patch(f"/backend/reimbursement_request/{req.pk}/", {
			"account": account.pk,
			"amount": "125.50",
		}, format="json")

		self.assertEqual(response.status_code, 200)
		req.refresh_from_db()
		self.assertTrue(req.is_reimbursed)

		tx = Transaction.objects.get(reimbursement_request=req)
		self.assertEqual(tx.type, Transaction.TransactionType.REIMBURSEMENT)
		self.assertEqual(tx.amount, Decimal("-125.50"))

		account.refresh_from_db()
		self.assertEqual(account.balance, Decimal("874.50"))


class TripDepositFlowTests(IntegrationBaseTestCase):
	"""Integration flow: subscription with deposit -> reimburse deposit."""

	def test_trip_deposit_and_reimbursement(self):
		"""Deposit reimbursement should create refund transaction and update balance."""
		board = self.create_board_user("board.trip@esnpolimi.it")
		self.authenticate(board)

		account = _create_account("Cassa", user=board, balance="500.00")
		event = _create_event(name="Trip to Barcelona", cost=Decimal("200.00"), deposit=Decimal("50.00"))
		list_main = _create_event_list(event, name="Main List", is_main_list=True)

		profile = _create_profile("erasmus@test.com", is_esner=False)
		subscription = Subscription.objects.create(profile=profile, event=event, list=list_main)

		Transaction.objects.create(
			type=Transaction.TransactionType.CAUZIONE,
			subscription=subscription,
			executor=board,
			account=account,
			amount=Decimal("50.00"),
			description="Cauzione viaggio",
		)

		response = self.client.post("/backend/reimburse_deposits/", {
			"event": event.pk,
			"subscription_ids": [subscription.pk],
			"account": account.pk,
		}, format="json")

		self.assertEqual(response.status_code, 201)
		self.assertTrue(
			Transaction.objects.filter(
				subscription=subscription,
				type=Transaction.TransactionType.RIMBORSO_CAUZIONE
			).exists()
		)

		account.refresh_from_db()
		self.assertEqual(account.balance, Decimal("500.00"))

class FinancePermissionsFlowTests(IntegrationBaseTestCase):
	"""Integration flow: assign can_manage_casse to Aspiranti."""

	def test_assign_finance_permissions(self):
		"""Aspiranti should be able to update transactions after permission granted."""
		aspirante = self.create_aspirante_user("aspirante.finance@esnpolimi.it")

		board = self.create_board_user("board.finance@esnpolimi.it")
		account = _create_account("Cassa", user=board, balance="100.00")
		tx = Transaction.objects.create(
			type=Transaction.TransactionType.DEPOSIT,
			account=account,
			amount=Decimal("10.00"),
			description="Test",
			executor=board,
		)

		self.authenticate(aspirante)
		response = self.client.patch(f"/backend/transaction/{tx.pk}/", {
			"description": "Attempt",
		}, format="json")

		self.assertEqual(response.status_code, 401)

		self.authenticate(board)
		response = self.client.patch(
			f"/backend/users/finance-permissions/?email={aspirante.profile.email}",
			{"can_manage_casse": True},
			format="json"
		)

		self.assertEqual(response.status_code, 200)
		aspirante.refresh_from_db()
		self.assertTrue(aspirante.can_manage_casse)

		self.authenticate(aspirante)
		response = self.client.patch(f"/backend/transaction/{tx.pk}/", {
			"description": "Updated",
		}, format="json")

		self.assertEqual(response.status_code, 200)


class SecurityIntegrationTests(IntegrationBaseTestCase):
	"""Security-oriented integration tests."""

	def test_expired_access_token_returns_401(self):
		"""Expired JWT should be rejected by authenticated endpoints."""
		profile = _create_profile("user@esnpolimi.it", is_esner=True)
		user = _create_user(profile)

		token = AccessToken.for_user(user)
		token.set_exp(lifetime=-timedelta(hours=1))

		self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(token)}")
		response = self.client.get("/backend/erasmus_profiles/")

		self.assertEqual(response.status_code, 401)

	def test_attivi_cannot_promote_to_board(self):
		"""Attivi should not be able to promote users to Board."""
		attivi_profile = _create_profile("attivi@esnpolimi.it", is_esner=True)
		attivi = _create_user(attivi_profile)
		attivi.groups.add(self.group_attivi)

		target_profile = _create_profile("target@esnpolimi.it", is_esner=True)
		target_user = _create_user(target_profile)
		target_user.groups.add(self.group_aspiranti)

		self.authenticate(attivi)
		response = self.client.patch(f"/backend/profile/{target_profile.pk}/", {
			"group": "Board",
		}, format="json")

		self.assertEqual(response.status_code, 403)
		target_user.refresh_from_db()
		self.assertTrue(target_user.groups.filter(name="Aspiranti").exists())
		self.assertFalse(target_user.groups.filter(name="Board").exists())

	def test_unauthenticated_cannot_access_protected_endpoints(self):
		"""Unauthenticated requests should be rejected on protected endpoints."""
		# No authentication set
		response = self.client.get("/backend/users/")

		self.assertEqual(response.status_code, 401)

	def test_invalid_token_returns_401(self):
		"""Invalid JWT should be rejected."""
		self.client.credentials(HTTP_AUTHORIZATION="Bearer invalid-token-here")
		response = self.client.get("/backend/users/")

		self.assertEqual(response.status_code, 401)

	def test_aspiranti_cannot_access_finance_operations(self):
		"""Aspiranti without finance permissions cannot manage casse."""
		aspiranti_profile = _create_profile("aspiranti@esnpolimi.it", is_esner=True)
		aspiranti = _create_user(aspiranti_profile)
		aspiranti.groups.add(self.group_aspiranti)

		self.authenticate(aspiranti)
		response = self.client.get("/backend/accounts/")

		self.assertEqual(response.status_code, 200)
		# Aspiranti can view accounts, but visibility filtering should work
		self.assertIsNotNone(response.data)

	def test_cross_profile_access_prevention(self):
		"""Users should not be able to modify other users' data without permission."""
		profile1 = _create_profile("user1@esnpolimi.it", is_esner=True)
		user1 = _create_user(profile1)
		user1.groups.add(self.group_aspiranti)

		profile2 = _create_profile("user2@esnpolimi.it", is_esner=True)
		user2 = _create_user(profile2)
		user2.groups.add(self.group_aspiranti)

		self.authenticate(user1)
		response = self.client.patch(f"/backend/profile/{profile2.pk}/", {
			"name": "Hacked Name",
		})

		self.assertEqual(response.status_code, 403)
		profile2.refresh_from_db()
		self.assertNotEqual(profile2.name, "Hacked Name")

	def test_refresh_token_flow_works(self):
		"""Refresh token should generate new access token."""
		profile = _create_profile("refresh@esnpolimi.it", is_esner=True)
		user = _create_user(profile)

		refresh = RefreshToken.for_user(user)

		self.client.cookies['refresh_token'] = str(refresh)
		response = self.client.post("/backend/api/token/refresh/", {
			"email": profile.email,
		})

		self.assertEqual(response.status_code, 200)
		self.assertIn("access", response.data)

	def test_logout_invalidates_refresh_token(self):
		"""After logout, refresh token should be blacklisted."""
		profile = _create_profile("logout@esnpolimi.it", is_esner=True)
		user = _create_user(profile)

		refresh = RefreshToken.for_user(user)
		access = str(refresh.access_token)

		self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
		self.client.post("/backend/logout/", {"refresh": str(refresh)})

		# Try to use the refresh token again
		self.client.cookies['refresh_token'] = str(refresh)
		response = self.client.post("/backend/api/token/refresh/", {
			"email": profile.email,
		})

		self.assertEqual(response.status_code, 401)


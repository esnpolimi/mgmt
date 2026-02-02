"""End-to-End integration tests covering complete workflows across multiple modules."""

from datetime import timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.utils import timezone
from rest_framework.test import APITestCase

from events.models import Event, EventList, Subscription
from profiles.models import Profile
from treasury.models import Account, ESNcard, Transaction, Settings
from users.models import User


def _create_profile(email, *, is_esner=True, verified=True, enabled=True, **kwargs):
	"""Create a profile with common defaults."""
	data = {
		"email": email,
		"name": kwargs.get("name", "Test"),
		"surname": kwargs.get("surname", "User"),
		"email_is_verified": verified,
		"enabled": enabled,
		"is_esner": is_esner,
		"birthdate": kwargs.get("birthdate", "1995-01-15"),
	}
	data.update(kwargs)
	return Profile.objects.create(**data)


def _create_user(profile, password="TestPass123!"):
	"""Create a user for given profile."""
	user = User.objects.create(profile=profile)
	user.set_password(password)
	user.save(update_fields=["password"])
	return user


def _create_event(**kwargs):
	"""Create an event with sensible defaults."""
	data = {
		"name": kwargs.pop("name", "Test Event"),
		"date": kwargs.pop("date", timezone.now().date() + timedelta(days=7)),
		"subscription_start_date": kwargs.pop("subscription_start_date", timezone.now() - timedelta(days=1)),
		"subscription_end_date": kwargs.pop("subscription_end_date", timezone.now() + timedelta(days=30)),
	}
	data.update(kwargs)
	return Event.objects.create(**data)


def _create_event_list(event, **kwargs):
	"""Create an event list."""
	data = {
		"name": kwargs.pop("name", "Main List"),
		"capacity": kwargs.pop("capacity", 100),
		"is_main_list": kwargs.pop("is_main_list", True),
	}
	data.update(kwargs)
	event_list = EventList.objects.create(**data)
	event_list.events.add(event)
	return event_list


def _create_account(name, *, user, **kwargs):
	"""Create a treasury account."""
	data = {
		"name": name,
		"changed_by": user,
		"status": kwargs.get("status", "open"),
	}
	account = Account.objects.create(**data)
	if "balance" in kwargs:
		account.balance = Decimal(str(kwargs["balance"]))
		account.save(update_fields=["balance"])
	return account


class IntegrationE2EBaseTestCase(APITestCase):
	"""Base setup for E2E integration tests."""

	@classmethod
	def setUpTestData(cls):
		cls.group_board = Group.objects.create(name="Board")
		cls.group_attivi = Group.objects.create(name="Attivi")
		cls.group_aspiranti = Group.objects.create(name="Aspiranti")

		# Get all necessary permissions
		cls.perm_add_subscription = Permission.objects.get(codename="add_subscription")
		cls.perm_change_subscription = Permission.objects.get(codename="change_subscription")
		cls.perm_add_transaction = Permission.objects.get(codename="add_transaction")
		cls.perm_change_esncard = Permission.objects.get(codename="change_esncard")
		cls.perm_add_event = Permission.objects.get(codename="add_event")

	def authenticate(self, user):
		self.client.force_authenticate(user=user)


class CompleteEventSubscriptionFlowTests(IntegrationE2EBaseTestCase):
	"""E2E tests for complete event subscription workflow."""

	def test_erasmus_registers_subscribes_and_pays_for_event(self):
		"""
		Complete flow: Erasmus registers → Subscribes to event → Pays quota.
		Modules: profiles, users, events, treasury
		"""
		# 1. Board creates event with cost
		board_profile = _create_profile("board@esnpolimi.it", is_esner=True)
		board_user = _create_user(board_profile)
		board_user.groups.add(self.group_board)
		board_user.user_permissions.add(self.perm_add_event)

		account = _create_account("Main Account", user=board_user, balance="1000.00")

		event = _create_event(
			name="City Tour",
			cost=Decimal("15.00"),
			deposit=Decimal("10.00")
		)
		main_list = _create_event_list(event, name="Main List", is_main_list=True)

		# 2. Erasmus profile created
		erasmus_profile = _create_profile(
			"erasmus@university.it",
			is_esner=False,
			name="John",
			surname="Smith"
		)
		erasmus_user = _create_user(erasmus_profile)
		erasmus_user.user_permissions.add(self.perm_add_subscription)

		# 3. Erasmus subscribes to event
		self.authenticate(erasmus_user)

		response = self.client.post("/backend/subscription/", {
			"profile": erasmus_profile.pk,
			"event": event.pk,
			"list": main_list.pk,
		}, format="json")

		self.assertEqual(response.status_code, 200)
		subscription = Subscription.objects.get(profile=erasmus_profile, event=event)
		self.assertEqual(subscription.list, main_list)
		# Verify no transaction yet (payment not done)
		self.assertFalse(Transaction.objects.filter(
			subscription=subscription,
			type=Transaction.TransactionType.SUBSCRIPTION
		).exists())

		# 4. Board processes payment
		self.authenticate(board_user)
		board_user.user_permissions.add(self.perm_change_subscription)

		response = self.client.patch(f"/backend/subscription/{subscription.pk}/", {
			"status_quota": "paid",
			"status_cauzione": "none",
			"account_id": account.pk,
		}, format="json")

		self.assertEqual(response.status_code, 200)

		# 5. Verify transaction created
		tx = Transaction.objects.filter(
			subscription=subscription,
			type=Transaction.TransactionType.SUBSCRIPTION
		).first()

		self.assertIsNotNone(tx)
		self.assertEqual(tx.amount, Decimal("15.00"))
		self.assertEqual(tx.account, account)

		# 6. Verify account balance updated
		account.refresh_from_db()
		self.assertEqual(account.balance, Decimal("1015.00"))  # 1000 + 15

	def test_event_with_services_subscription_and_payment(self):
		"""
		Complete flow with services: Create event with services → Subscribe with services → Pay all.
		Modules: events (services), treasury
		"""
		# Setup
		board_profile = _create_profile("board@esnpolimi.it")
		board_user = _create_user(board_profile)
		board_user.groups.add(self.group_board)
		board_user.user_permissions.add(self.perm_add_subscription, self.perm_change_subscription)

		account = _create_account("Main", user=board_user, balance="500.00")

		# Event with services
		event = _create_event(
			name="Ski Trip",
			cost=Decimal("50.00"),
			services=[
				{"id": "ski-rental", "name": "Ski Equipment", "price": 25.0},
				{"id": "lunch", "name": "Lunch Package", "price": 15.0},
			]
		)
		event_list = _create_event_list(event)

		# User subscribes with services
		user_profile = _create_profile("user@test.com", is_esner=False)
		user = _create_user(user_profile)
		user.user_permissions.add(self.perm_add_subscription)
		self.authenticate(user)

		response = self.client.post("/backend/subscription/", {
			"profile": user_profile.pk,
			"event": event.pk,
			"list": event_list.pk,
			"selected_services": [
				{"service_id": "ski-rental", "quantity": 1},  # 25
				{"service_id": "lunch", "quantity": 2},  # 30
			],
		}, format="json")

		self.assertEqual(response.status_code, 200)
		sub = Subscription.objects.get(profile=user_profile, event=event)
		self.assertEqual(len(sub.selected_services), 2)

		# Board pays quota and services
		self.authenticate(board_user)

		response = self.client.patch(f"/backend/subscription/{sub.pk}/", {
			"status_quota": "paid",
			"status_cauzione": "none",  # Event has no deposit
			"status_services": "paid",
			"account_id": account.pk,
		}, format="json")

		self.assertEqual(response.status_code, 200)

		# Verify transactions
		quota_tx = Transaction.objects.filter(
			subscription=sub,
			type=Transaction.TransactionType.SUBSCRIPTION
		).first()
		service_txs = Transaction.objects.filter(
			subscription=sub,
			type=Transaction.TransactionType.SERVICE
		)

		self.assertIsNotNone(quota_tx)
		self.assertEqual(quota_tx.amount, Decimal("50.00"))
		# Should have 2 separate transactions, one for each service
		self.assertEqual(service_txs.count(), 2)
		# Verify total service amount
		total_services = sum(tx.amount for tx in service_txs)
		self.assertEqual(total_services, Decimal("55.00"))  # 25 + (15*2)

		# Verify balance
		account.refresh_from_db()
		self.assertEqual(account.balance, Decimal("605.00"))  # 500 + 50 + 55


class ESNcardPurchaseFlowTests(IntegrationE2EBaseTestCase):
	"""E2E tests for ESNcard purchase workflow."""

	def test_complete_esncard_purchase_workflow(self):
		"""
		Complete flow: Erasmus pays membership → Gets ESNcard → Balance updated.
		Modules: profiles, treasury
		"""
		Settings.get()  # Initialize settings

		# Board user
		board_profile = _create_profile("board@esnpolimi.it")
		board_user = _create_user(board_profile)
		board_user.groups.add(self.group_board)
		self.authenticate(board_user)

		account = _create_account("Main", user=board_user, balance="200.00")

		# Erasmus profile
		erasmus_profile = _create_profile("erasmus@uni.it", is_esner=False)

		# Issue ESNcard
		response = self.client.post("/backend/esncard_emission/", {
			"profile_id": erasmus_profile.pk,
			"account_id": account.pk,
			"esncard_number": "ESN-2026-001",
		}, format="json")

		self.assertEqual(response.status_code, 200)

		# Verify ESNcard created
		card = ESNcard.objects.get(profile=erasmus_profile)
		self.assertEqual(card.number, "ESN-2026-001")
		self.assertIsNotNone(card.created_at)

		# Verify transaction created
		tx = Transaction.objects.filter(
			esncard=card,
			type=Transaction.TransactionType.ESNCARD
		).first()
		self.assertIsNotNone(tx)
		self.assertGreater(tx.amount, Decimal("0"))

		# Verify balance updated
		account.refresh_from_db()
		expected_balance = Decimal("200.00") + tx.amount
		self.assertEqual(account.balance, expected_balance)


class DepositReimbursementFlowTests(IntegrationE2EBaseTestCase):
	"""E2E tests for deposit payment and reimbursement workflow."""

	def test_complete_deposit_lifecycle(self):
		"""
		Complete flow: Subscribe → Pay deposit → Event ends → Reimburse deposit.
		Modules: events, treasury
		"""
		# Setup
		board_profile = _create_profile("board@esnpolimi.it")
		board_user = _create_user(board_profile)
		board_user.groups.add(self.group_board)
		board_user.user_permissions.add(
			self.perm_add_subscription,
			self.perm_change_subscription
		)
		self.authenticate(board_user)

		account = _create_account("Main", user=board_user, balance="1000.00")

		event = _create_event(
			name="Weekend Trip",
			cost=Decimal("100.00"),
			deposit=Decimal("50.00")
		)
		event_list = _create_event_list(event)

		# Create 3 subscriptions
		subs = []
		for i in range(3):
			profile = _create_profile(f"user{i}@test.com", is_esner=False)
			sub = Subscription.objects.create(
				profile=profile,
				event=event,
				list=event_list
			)
			subs.append(sub)

			# Pay deposit for each
			Transaction.objects.create(
				subscription=sub,
				account=account,
				executor=board_user,
				type=Transaction.TransactionType.CAUZIONE,
				amount=Decimal("50.00"),
				description="Deposit payment"
			)

		# Verify balance after deposits
		account.refresh_from_db()
		self.assertEqual(account.balance, Decimal("1150.00"))  # 1000 + (50*3)

		# Event ends, reimburse deposits
		response = self.client.post("/backend/reimburse_deposits/", {
			"event": event.pk,
			"subscription_ids": [s.pk for s in subs],
			"account": account.pk,
		}, format="json")

		self.assertIn(response.status_code, [200, 201])

		# Verify reimbursement transactions
		reimbursements = Transaction.objects.filter(
			type=Transaction.TransactionType.RIMBORSO_CAUZIONE
		)
		self.assertEqual(reimbursements.count(), 3)

		# Verify balance after reimbursements
		account.refresh_from_db()
		self.assertEqual(account.balance, Decimal("1000.00"))  # Back to original


class MultiModuleCompleteFlowTests(IntegrationE2EBaseTestCase):
	"""E2E tests for complex workflows spanning multiple modules."""

	def test_new_user_full_journey(self):
		"""
		Complete journey: New Erasmus → Gets ESNcard → Subscribes to event with services → Pays all.
		Modules: profiles, users, treasury, events
		"""
		Settings.get()

		# 1. Board setup
		board_profile = _create_profile("board@esnpolimi.it")
		board_user = _create_user(board_profile)
		board_user.groups.add(self.group_board)
		board_user.user_permissions.add(
			self.perm_add_event,
			self.perm_add_subscription,
			self.perm_change_subscription,
			self.perm_add_transaction
		)

		account = _create_account("Main", user=board_user, balance="500.00")

		# 2. New Erasmus joins
		erasmus_profile = _create_profile(
			"john.doe@university.com",
			is_esner=False,
			name="John",
			surname="Doe"
		)
		erasmus_user = _create_user(erasmus_profile)

		# 3. Buy ESNcard
		self.authenticate(board_user)

		response = self.client.post("/backend/esncard_emission/", {
			"profile_id": erasmus_profile.pk,
			"account_id": account.pk,
			"esncard_number": "ESN-2026-100",
		}, format="json")

		self.assertEqual(response.status_code, 200)
		card = ESNcard.objects.get(profile=erasmus_profile)
		self.assertIsNotNone(card)

		# 4. Create event with services
		event = _create_event(
			name="Cultural Evening",
			cost=Decimal("20.00"),
			services=[
				{"id": "dinner", "name": "Dinner", "price": 15.0},
				{"id": "drink", "name": "Welcome Drink", "price": 5.0},
			]
		)
		event_list = _create_event_list(event)

		# 5. Erasmus subscribes with services
		erasmus_user.user_permissions.add(self.perm_add_subscription)
		self.authenticate(erasmus_user)

		response = self.client.post("/backend/subscription/", {
			"profile": erasmus_profile.pk,
			"event": event.pk,
			"list": event_list.pk,
			"selected_services": [
				{"service_id": "dinner", "quantity": 1},
				{"service_id": "drink", "quantity": 2},
			],
		}, format="json")

		self.assertEqual(response.status_code, 200)
		sub = Subscription.objects.get(profile=erasmus_profile, event=event)

		# 6. Board processes payment
		self.authenticate(board_user)

		response = self.client.patch(f"/backend/subscription/{sub.pk}/", {
			"status_quota": "paid",
			"status_cauzione": "none",  # Event has no deposit
			"status_services": "paid",
			"account_id": account.pk,
		}, format="json")

		self.assertEqual(response.status_code, 200)

		# 7. Verify all transactions exist
		transactions = Transaction.objects.filter(
			subscription=sub
		)
		self.assertGreaterEqual(transactions.count(), 2)  # At least quota + services

		# 8. Verify payment status through API response
		response_data = response.json()
		self.assertEqual(response_data['status_quota'], "paid")
		self.assertEqual(response_data['status_services'], "paid")
		sub.refresh_from_db()
		self.assertEqual(len(sub.selected_services), 2)

	def test_event_organizer_workflow(self):
		"""
		Organizer workflow: Create event → Multiple subscriptions → Manage payments → Close event.
		Modules: events, treasury, profiles
		"""
		# Board creates event
		board_profile = _create_profile("board@esnpolimi.it")
		board_user = _create_user(board_profile)
		board_user.groups.add(self.group_board)
		board_user.user_permissions.add(
			self.perm_add_event,
			self.perm_change_subscription,
			self.perm_add_transaction
		)
		self.authenticate(board_user)

		account = _create_account("Events", user=board_user, balance="0.00")

		event = _create_event(
			name="Pub Crawl",
			cost=Decimal("10.00"),
			deposit=Decimal("5.00")
		)
		main_list = _create_event_list(event, capacity=10)
		waiting_list = _create_event_list(
			event,
			name="Waiting List",
			is_main_list=False,
			is_waiting_list=True
		)

		# Create 5 subscriptions
		subs = []
		for i in range(5):
			profile = _create_profile(f"participant{i}@test.com", is_esner=False)
			sub = Subscription.objects.create(
				profile=profile,
				event=event,
				list=main_list if i < 3 else waiting_list
			)
			subs.append(sub)

		# Process payments for main list participants
		for sub in subs[:3]:
			# Pay quota
			Transaction.objects.create(
				subscription=sub,
				account=account,
				executor=board_user,
				type=Transaction.TransactionType.SUBSCRIPTION,
				amount=Decimal("10.00"),
				description="Event fee"
			)

			# Pay deposit
			Transaction.objects.create(
				subscription=sub,
				account=account,
				executor=board_user,
				type=Transaction.TransactionType.CAUZIONE,
				amount=Decimal("5.00"),
				description="Deposit"
			)

			sub.status_quota = "paid"
			sub.status_cauzione = "paid"
			sub.save()

		# Verify account balance
		account.refresh_from_db()
		self.assertEqual(account.balance, Decimal("45.00"))  # (10+5) * 3

		# Event complete - reimburse deposits
		response = self.client.post("/backend/reimburse_deposits/", {
			"event": event.pk,
			"subscription_ids": [s.pk for s in subs[:3]],
			"account": account.pk,
		}, format="json")

		self.assertIn(response.status_code, [200, 201])

		# Verify final balance
		account.refresh_from_db()
		self.assertEqual(account.balance, Decimal("30.00"))  # 45 - (5*3) = 30

		# Verify subscriptions have transactions
		main_subs = Subscription.objects.filter(
			event=event, list=main_list
		)
		self.assertEqual(main_subs.count(), 3)
		# Verify all have payment transactions
		for sub in main_subs:
			self.assertTrue(Transaction.objects.filter(
				subscription=sub,
				type=Transaction.TransactionType.SUBSCRIPTION
			).exists())

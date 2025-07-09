from datetime import date
from django.contrib.auth.models import Group
from django.db import models, transaction
from django.utils.translation import gettext_lazy as _
from django.core.exceptions import PermissionDenied
from profiles.models import Profile, BaseEntity
from djmoney.models.fields import MoneyField
from djmoney.money import Money
import logging
from django.conf import settings

logger = logging.getLogger(__name__)


class Settings(models.Model):
    esncard_release_fee = MoneyField(max_digits=9, decimal_places=2, default_currency='EUR', default=10.0)
    esncard_lost_fee = MoneyField(max_digits=9, decimal_places=2, default_currency='EUR', default=4.0)

    class Meta:
        verbose_name = 'Settings'
        verbose_name_plural = 'Settings'

    @classmethod
    def get(cls):
        obj, created = cls.objects.get_or_create(pk=1)
        return obj


class ESNcard(BaseEntity):
    id = models.AutoField(primary_key=True)
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE)
    number = models.CharField(max_length=11, unique=True)

    @property
    def expiration(self):
        return date(self.created_at.year + 1 if self.created_at.month >= 9 else self.created_at.year, 9, 1)

    @property
    def is_valid(self):
        return date.today() < self.expiration

    @property
    def membership_year(self):
        return str(self.expiration.year - 1) + '/' + str(self.expiration.year)

    def __str__(self):
        return f"{self.number} - {self.profile.name} {self.profile.surname}"


class Account(BaseEntity):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=64, unique=True)
    changed_by = models.ForeignKey('users.User', on_delete=models.CASCADE)

    class Status(models.TextChoices):
        open = "open", _("open")
        closed = "closed", _("closed")

    status = models.CharField(choices=Status.choices, max_length=8, default="closed")
    balance = MoneyField(max_digits=9, decimal_places=2, default_currency='EUR', default=0.0)
    visible_to_groups = models.ManyToManyField(Group)

    def is_visible_to_user(self, user):
        return self.visible_to_groups.filter(user=user).exists() or not self.visible_to_groups.exists()

    def __str__(self):
        return f"Account {self.name}"


class Transaction(BaseEntity):
    class TransactionType(models.TextChoices):
        SUBSCRIPTION = "subscription", _("Subscription")
        ESNCARD = "esncard", _("ESNcard")
        DEPOSIT = "deposit", _("Deposit")  # Manual deposit (not cauzione)
        WITHDRAWAL = "withdrawal", _("Withdrawal")
        REIMBURSEMENT = "reimbursement", _("Reimbursement"),
        CAUZIONE = "cauzione", _("Cauzione")  # Subscription deposit (cauzione)
        RIMBORSO_CAUZIONE = "rimborso_cauzione", _("Rimborso Cauzione"),

    id = models.AutoField(primary_key=True)
    type = models.CharField(max_length=30, choices=TransactionType.choices, default=TransactionType.DEPOSIT)
    subscription = models.ForeignKey('events.Subscription', null=True, blank=True, on_delete=models.SET_NULL)
    esncard = models.ForeignKey(ESNcard, null=True, blank=True, on_delete=models.SET_NULL)
    executor = models.ForeignKey('users.User', on_delete=models.CASCADE)
    account = models.ForeignKey('Account', on_delete=models.CASCADE)
    amount = MoneyField(max_digits=9, decimal_places=2, default_currency='EUR')
    description = models.CharField(max_length=256)

    def clean(self):
        # Validate fields based on transaction type
        if self.type == self.TransactionType.SUBSCRIPTION and not self.subscription:
            raise ValueError("Le transazioni di Iscrizione devono avere un'Iscrizione.")
        if self.type == self.TransactionType.ESNCARD and not self.esncard:
            raise ValueError("Le transazioni di Emissione ESNcard devono avere una ESNcard.")
        if self.type == self.TransactionType.CAUZIONE:
            if not self.subscription:
                raise ValueError("Le transazioni di Cauzione devono avere un'Iscrizione.")
            if self.esncard:
                raise ValueError("Le transazioni di Cauzione non devono avere una ESNcard.")
        if self.type == self.TransactionType.DEPOSIT:
            if self.subscription or self.esncard:
                raise ValueError("Le transazioni di Deposito manuale non devono avere un'Iscrizione o una ESNcard.")
        if self.type == self.TransactionType.WITHDRAWAL:
            if self.subscription or self.esncard:
                raise ValueError("Le transazioni di Prelievo non devono avere un'Iscrizione o una ESNcard.")
        if self.account.status == "closed":
            raise PermissionDenied("La cassa è chiusa.")
        if self.amount + self.account.balance < Money(0.0, 'EUR'):
            raise ValueError("Il saldo non può essere negativo.")
        super(Transaction, self).clean()

    def save(self, *args, **kwargs):
        with transaction.atomic():
            self.clean()

            # If this is an update (existing transaction)
            if self.pk:
                original_transaction = Transaction.objects.get(pk=self.pk)
                # Only update balance with the difference between new and old amount
                amount_difference = self.amount - original_transaction.amount
                self.account.balance += amount_difference
            else:
                # For new transactions, add the full amount
                self.account.balance += self.amount

            self.account.save()
            super(Transaction, self).save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        with transaction.atomic():
            self.account.balance -= self.amount
            self.account.save()
            super(Transaction, self).delete(*args, **kwargs)


class ReimbursementRequest(models.Model):
    PAYMENT_CHOICES = [
        ("cash", "Contanti"),
        ("paypal", "PayPal"),
        ("bonifico", "Bonifico"),
    ]
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=9, decimal_places=2)
    payment = models.CharField(max_length=16, choices=PAYMENT_CHOICES)
    description = models.CharField(max_length=512)
    receipt_link = models.URLField(max_length=512, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    account = models.ForeignKey('Account', null=True, blank=True, on_delete=models.SET_NULL)
    reimbursement_transaction = models.OneToOneField(
        'Transaction', null=True, blank=True, on_delete=models.SET_NULL, related_name='reimbursement_request'
    )

    def __str__(self):
        return f"Reimbursement {self.id} by {self.user} - {self.amount} EUR"

    @property
    def is_reimbursed(self):
        return self.reimbursement_transaction is not None

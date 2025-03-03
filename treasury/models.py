from datetime import date
from django.db import models, transaction
from events.models import Subscription
from django.utils.translation import gettext_lazy as _
from django.core.exceptions import PermissionDenied
from users.models import User
from profiles.models import Profile, BaseEntity
from djmoney.models.fields import MoneyField
from djmoney.money import Money
from simple_history.models import HistoricalRecords

    
class ESNcard(BaseEntity):
    id = models.AutoField(primary_key=True)
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE)
    number = models.CharField(max_length=11, unique=True)

    @property
    def expiration(self):
        return date(self.created_at.year+1 if self.created_at.month >= 9 else self.created_at.year, 9, 1)
    
    @property
    def is_valid(self):
        return date.today() < self.expiration
    
    @property
    def membership_year(self):
        return str(self.expiration.year-1) + '/' + str(self.expiration.year)


class Account(BaseEntity):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=64,unique=True)
    changed_by = models.ForeignKey(User,on_delete=models.CASCADE)

    class Status(models.TextChoices):
        open = "open", _("open")
        closed = "closed", _("closed")
    
    status = models.CharField(choices=Status.choices,max_length=8,default="closed")
    balance = MoneyField(max_digits=9,decimal_places=2,default_currency='EUR',default=0.0)
    history = HistoricalRecords()

    @property
    def _history_user(self):
        return self.changed_by

    @_history_user.setter
    def _history_user(self, value):
        self.changed_by = value
        
class Transaction(BaseEntity):
    id = models.AutoField(primary_key=True)
    subscription = models.ForeignKey(Subscription,null=True,on_delete=models.SET_NULL)
    executor = models.ForeignKey(User,on_delete=models.CASCADE)
    account = models.ForeignKey(Account,on_delete=models.CASCADE)
    amount = MoneyField(max_digits=9,decimal_places=2,default_currency='EUR')
    description = models.CharField(max_length=256)

    def clean(self):
        if self.account.status == "closed":
            raise PermissionDenied("Account is closed")
        if self.amount + self.account.balance < Money(0.0,'EUR'):
            raise ValueError("Insufficient balance")
        # if not self.user.has_perm(''):
        #     raise PermissionDenied("Permission denied")
        super(Transaction, self).clean()
        

    def save(self,*args,**kwargs):
        with transaction.atomic():
            self.clean()
            self.account.balance += self.amount
            self.account.save()
            super(Transaction, self).save(*args,**kwargs)

    def delete(self, *args, **kwargs):
        with transaction.atomic():
            self.account.balance -= self.Amount
            self.account.save()
            super(Transaction, self).delete(*args, **kwargs) 

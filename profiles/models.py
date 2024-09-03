from datetime import date
from django.db import models
from django.utils.translation import gettext_lazy as _
from django_countries.fields import CountryField
from phonenumber_field.modelfields import PhoneNumberField
from simple_history.models import HistoricalRecords

class BaseEntity(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    enabled = models.BooleanField(default=True)

    class Meta:
        abstract=True

class Profile(BaseEntity):

    class Gender(models.TextChoices):
        M = "M", _("Male")
        F = "F", _("Female")
        O = "O", _("Other")

    class Status(models.TextChoices):
        aspirante = "Aspirante","Aspirante"
        associato = "Associato","Associato"
        erasmus = "Erasmus","Erasmus"

    class Course(models.TextChoices):
        ingegneria = "Engineering",_("Engineering")
        architettura = "Architecture",_("Architecture")
        design = "Design",_("Design")
        
    id = models.AutoField(primary_key=True)
    email = models.EmailField(max_length=256, unique=True)
    email_is_verified = models.BooleanField(default=False)
    name = models.CharField(max_length=128)
    surname = models.CharField(max_length=128)
    gender = models.CharField(max_length=1,choices=Gender.choices)
    birthdate = models.DateField(null=True)
    country = CountryField(null=True)
    #status = models.CharField(max_length=32, choices=Status.choices,null=True)
    course = models.CharField(max_length=32, choices=Course.choices,null=True)
    phone = PhoneNumberField(null=True)
    whatsapp = PhoneNumberField(blank=True)
    person_code = models.PositiveIntegerField(unique=True,null=True)
    domicile = models.CharField(max_length=256,null=True)
    residency = models.CharField(max_length=256,null=True)
    history = HistoricalRecords()

    def __str__(self):
        return "{} {} {}".format(self.name, self.surname, self.email)
    
    @property
    def latest_esncard(self):
        return self.esncard_set.latest('created_at') if self.esncard_set.exists() else None
    
    @property
    def latest_document(self):
        return self.document_set.latest('created_at') if self.document_set.exists() else None
    
    @property
    def latest_matricola(self):
        return self.matricola_set.latest('created_at') if self.matricola_set.exists() else None
    
class Document(BaseEntity):
    id = models.AutoField(primary_key=True)
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE)

    class Type(models.TextChoices):
        passport = "Passport",_("Passport")
        identity_card = "Identity Card",_("Identity Card")

    type = models.CharField(max_length=32,choices=Type.choices)
    number = models.CharField(unique=True,max_length=32)
    expiration = models.DateField()

    @property
    def is_valid(self):
        return date.today() < self.expiration

class Matricola(BaseEntity):
    id = models.AutoField(primary_key=True)
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE)
    number = models.IntegerField(unique=True)
    exchange_end = models.DateField()
    








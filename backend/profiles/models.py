from cgitb import enable
from datetime import date
from django.db import models
from django.utils.translation import gettext_lazy as _
from django_countries.fields import CountryField
from phonenumber_field.modelfields import PhoneNumberField
from simple_history.models import HistoricalRecords


# Base class that will be extended by all models in the database. In this way
# each object has by default the fields created_at, updated_at, enabled.
# Enabled serves as a way of marking objects as deleted without actually deleting them
# from the database.

class BaseEntity(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    enabled = models.BooleanField(default=True)

    # Inner class that holds metadata for BaseEntity.
    # Tells django that the BaseEntity cannot be instantiated.
    class Meta:
        # This class cannot be directly instantiated, can only be extended
        abstract = True


# Class that describes a Profile
class Profile(BaseEntity):
    # Inner class describing the Profile.Gender type (it's like an enum inner class)
    class Gender(models.TextChoices):
        M = "M", _("Male")
        F = "F", _("Female")
        O = "O", _("Other")

    # Same goes for Profile.Course
    class Course(models.TextChoices):
        ingegneria = "Engineering", _("Engineering")
        architettura = "Architecture", _("Architecture")
        design = "Design", _("Design")

    id = models.AutoField(primary_key=True)  # primary key
    email = models.EmailField(max_length=256, unique=True)

    # this field is set to true if the email is verified, i.e. the user has
    # received the automatic email sent by us (TODO) and clicked on the link
    email_is_verified = models.BooleanField(default=False)

    name = models.CharField(max_length=128)
    surname = models.CharField(max_length=128)
    gender = models.CharField(max_length=1, choices=Gender.choices)
    birthdate = models.DateField(null=True)
    country = CountryField(null=True)
    course = models.CharField(max_length=32, choices=Course.choices, null=True)
    phone = PhoneNumberField(null=True)
    whatsapp = PhoneNumberField(blank=True)
    person_code = models.PositiveIntegerField(unique=True, null=True)
    domicile = models.CharField(max_length=256, null=True)
    residency = models.CharField(max_length=256, null=True)
    is_esner = models.BooleanField(default=False)
    # Special fields that records all modifications made to the object.
    # Useful for rolling back to previous versions of the object. 
    history = HistoricalRecords()

    # Matricola fields: expiration tightly coupled with the number, and with the exchange end date
    matricola_number = models.IntegerField(unique=True, null=True)
    matricola_expiration = models.DateField(null=True)

    # Return a string format of the profile object, contains only name, surname and email
    def __str__(self):
        return self.email

    # @property decorator serves for turning functions into field. For example,
    # instead of calling profile.latest_esncard() I can do profile.latest_esncard

    # Returns latest esncard released to the profile
    @property
    def latest_esncard(self):
        enabled_esncards = self.esncard_set.filter(enabled=True)
        return enabled_esncards.latest('created_at') if enabled_esncards.exists() else None

    # Returns latest document of the profile
    @property
    def latest_document(self):
        enabled_documents = self.document_set.filter(enabled=True)
        return enabled_documents.latest('created_at') if enabled_documents.exists() else None


# Class that describes document object
class Document(BaseEntity):
    id = models.AutoField(primary_key=True)  # primary key

    # Foreign key to Profile, because each document is linked to a profile,
    # but a profile may have multiple documents
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE)

    class Type(models.TextChoices):
        passport = "Passport", _("Passport")
        identity_card = "Identity Card", _("Identity Card")

    type = models.CharField(max_length=32, choices=Type.choices)
    number = models.CharField(unique=True, max_length=32)
    expiration = models.DateField()

    # return true if document has not expired
    @property
    def is_valid(self):
        return date.today() < self.expiration

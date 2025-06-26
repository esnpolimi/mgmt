from datetime import date

from django.db import models
from django.utils.translation import gettext_lazy as _


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
    # Inner class describing the Profile.Course type (it's like an enum inner class)
    class Course(models.TextChoices):
        ENGINEERING = "Engineering", _("Engineering")
        ARCHITECTURE = "Architecture", _("Architecture")
        DESIGN = "Design", _("Design")

    id = models.AutoField(primary_key=True)  # primary key
    email = models.EmailField(max_length=256, unique=True)

    # This field is set to true if the email is verified, i.e. the user has received the automatic email sent by us
    email_is_verified = models.BooleanField(default=False)

    name = models.CharField(max_length=128)
    surname = models.CharField(max_length=128)
    birthdate = models.DateField(null=True)
    country = models.CharField(max_length=2, null=True)  # Store country code (e.g., 'IT')
    course = models.CharField(max_length=32, choices=Course.choices, null=True)
    phone_prefix = models.CharField(max_length=10, null=True)
    phone_number = models.CharField(max_length=20, null=True)
    whatsapp_prefix = models.CharField(max_length=10, null=True)
    whatsapp_number = models.CharField(max_length=20, null=True)
    person_code = models.CharField(max_length=10, unique=True, null=True)
    domicile = models.CharField(max_length=256, null=True)
    is_esner = models.BooleanField(default=False)

    # Matricola fields: expiration tightly coupled with the number, and with the exchange end date
    matricola_number = models.CharField(max_length=10, unique=True, null=True)
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
        PASSPORT = "Passport", _("Passport")
        NATIONAL_ID = "ID Card", _("ID Card")
        DRIVING_LICENSE = "Driving License", _("Driving License")
        RESIDENCY_PERMIT = "Residency Permit", _("Residency Permit")
        OTHER = "Other", _("Other")

    type = models.CharField(max_length=32, choices=Type.choices)
    number = models.CharField(unique=True, max_length=32)
    expiration = models.DateField()

    # return true if document has not expired
    @property
    def is_valid(self):
        return date.today() < self.expiration

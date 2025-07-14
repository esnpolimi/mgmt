import random
from django.contrib.auth.models import BaseUserManager
from django.utils.translation import gettext_lazy as _


class UserManager(BaseUserManager):

    def create_user(self, profile, password, **extra_fields):
        """
        Create and save a user with the given email and password.
        """

        if not profile:
            raise ValueError(_("The profile must be set"))

        extra_fields.pop('is_active', None)
        user = self.model(profile=profile, **extra_fields)
        user.set_password(password)
        user.is_active = True
        return user

    def create_superuser(self, profile, password, **extra_fields):
        """
        Create and save a SuperUser with the given email and password.
        """

        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)

        if not extra_fields.get("is_staff"):
            raise ValueError(_("Superuser must have is_staff=True."))
        if not extra_fields.get("is_superuser"):
            raise ValueError(_("Superuser must have is_superuser=True."))

        return self.create_user(profile, password, **extra_fields)

    def make_random_password(self, length=10,
                             allowed_chars='abcdefghjkmnpqrstuvwxyz'
                                           'ABCDEFGHJKLMNPQRSTUVWXYZ'
                                           '23456789'):
        return ''.join(random.choice(allowed_chars) for _ in range(length))

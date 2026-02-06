from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from profiles.models import Profile
from users.managers import UserManager


# Inheriting from AbstractBaseUser these additional fields:
# password, last_login, is_active
# ... and from PermissionsMixin:
# is_superuser, groups, user_permissions
class User(AbstractBaseUser, PermissionsMixin):
    profile = models.OneToOneField(Profile, to_field='email', primary_key=True, on_delete=models.CASCADE)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)
    last_login = models.DateTimeField(null=True, blank=True)  # Override last_login, to be NULL initially
    can_manage_casse = models.BooleanField(default=False)  # Board-granted for Aspiranti
    can_view_casse_import = models.BooleanField(default=False)  # Board-granted for Aspiranti

    USERNAME_FIELD = 'profile'
    REQUIRED_FIELDS = []

    # Primary manager
    objects = UserManager()

    def __str__(self):
        return self.profile.email

    @property
    def email(self):
        return self.profile.email

    @property
    def id(self):
        # return the primary key (profile email) to keep parity with default expectations
        return getattr(self, "pk", getattr(getattr(self, "profile", None), "email", None))

    # DokuWiki related methods
    def get_full_name(self):
        """Return the user's full name (fallback to email)."""
        name = getattr(self.profile, 'name', '')
        surname = getattr(self.profile, 'surname', '')
        full_name = f"{name} {surname}".strip()
        return full_name or self.profile.email

    def get_short_name(self):
        """Return a short identifier for the user."""
        name = getattr(self.profile, 'name', None)
        if name:
            return name
        return self.profile.email.split('@')[0]

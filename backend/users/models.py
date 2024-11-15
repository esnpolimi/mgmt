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

    USERNAME_FIELD = 'profile'
    REQUIRED_FIELDS = []

    # Primary manager
    objects = UserManager()

    def __str__(self):
        return self.profile.email

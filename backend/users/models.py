from django.contrib.auth.models import AbstractBaseUser,PermissionsMixin
from django.db import models
from profiles.models import Profile
from users.managers import UserManager

class User(AbstractBaseUser, PermissionsMixin):

    profile = models.OneToOneField(Profile,to_field='email',primary_key=True, on_delete=models.CASCADE)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    date_joined = models.DateTimeField(auto_now_add=True)
    last_login = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'profile'
    REQUIRED_FIELDS = []

    objects = UserManager()

    def __str__(self):
        return self.profile.email
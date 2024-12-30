from .base import *

SECRET_KEY = env("SECRET_KEY")
DEBUG = False
ALLOWED_HOSTS = ["mgmt.esnpolimi.it"]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("DB_NAME"),
        "USER": env("DB_USER"),
        "PASSWORD": env("DB_PASSWORD"),
        "HOST": env("DB_HOST"),
        "PORT": env("DB_PORT"),
    }
}

HOSTNAME = 'mgmt.esnpolimi.it'
SECURE_COOKIES = True

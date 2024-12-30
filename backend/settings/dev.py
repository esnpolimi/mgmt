from .base import *

SECRET_KEY = env("SECRET_KEY")
DEBUG = True
ALLOWED_HOSTS = ["localhost", "127.0.0.1"]

# Database
# https://docs.djangoproject.com/en/4.2/ref/settings/#databases

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

HOSTNAME = 'localhost'
SECURE_COOKIES = False

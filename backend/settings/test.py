"""Settings for CI/CD test environment"""
from .base import *
import sys

SECRET_KEY = 'django-insecure-test-key-for-ci-only'

DEBUG = True
ALLOWED_HOSTS = ['*']

# Database - SQLite in memory per test veloci
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

# Disable password validation for faster test execution
AUTH_PASSWORD_VALIDATORS = []

SCHEME_HOST = 'http://localhost:3000'
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False

# Speed up password hashing in tests
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.MD5PasswordHasher',
]

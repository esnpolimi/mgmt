import os

from django.core.wsgi import get_wsgi_application

DJANGO_ENV = os.getenv("DJANGO_ENV", "prod")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", f"backend.settings.{DJANGO_ENV}")

application = get_wsgi_application()

import os

from django.core.asgi import get_asgi_application

DJANGO_ENV = os.getenv("DJANGO_ENV", "prod")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", f"backend.settings.{DJANGO_ENV}")

application = get_asgi_application()

"""
WSGI config for backend project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/4.2/howto/deployment/wsgi/
"""

import os
from django.core.wsgi import get_wsgi_application

# Add your project root to the Python path
#sys.path.insert(0, os.path.dirname(__file__))

DJANGO_ENV = os.getenv("DJANGO_ENV", "prod")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", f"backend.settings.{DJANGO_ENV}")

application = get_wsgi_application()


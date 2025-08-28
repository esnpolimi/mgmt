#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys


# Set a default DJANGO_ENV to "dev" if not already set
DJANGO_ENV = os.getenv("DJANGO_ENV", "dev")
os.environ.setdefault("DJANGO_ENV", DJANGO_ENV)
# Dynamically load the appropriate settings file
os.environ.setdefault("DJANGO_SETTINGS_MODULE", f"backend.settings.{DJANGO_ENV}")


def main():
    """Run administrative tasks."""
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()

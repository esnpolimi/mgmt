import logging

from django.core.management.base import BaseCommand, CommandError
from google.auth.exceptions import GoogleAuthError
from googleapiclient.errors import HttpError

from utils.google_drive import get_drive_service
from utils.log_archive import archive_logs_to_drive

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Archive all application log files in Google Drive"

    def handle(self, *args, **options):
        try:
            uploaded = archive_logs_to_drive(get_drive_service())
        except (GoogleAuthError, HttpError, OSError) as exc:
            logger.exception("Log archive failed")
            raise CommandError("Log archive failed") from exc

        self.stdout.write(
            self.style.SUCCESS(f"Archived {len(uploaded)} log file(s) to Google Drive.")
        )

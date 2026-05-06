import logging

from django.core.management.base import BaseCommand, CommandError
from googleapiclient.errors import HttpError

from treasury.reports import generate_daily_reports, ReportDateError

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Generate daily treasury reports and upload them to Google Drive"

    def add_arguments(self, parser):
        parser.add_argument(
            "--date",
            type=str,
            help="Report date in YYYY-MM-DD. Defaults to today in Europe/Rome.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Generate workbooks without uploading to Drive.",
        )

    def handle(self, *args, **options):
        report_date = options.get("date")
        dry_run = options.get("dry_run")

        try:
            results = generate_daily_reports(report_date=report_date, dry_run=dry_run)
        except ReportDateError as exc:
            raise CommandError(str(exc)) from exc
        except HttpError as exc:
            logger.exception("Drive upload failed")
            raise CommandError("Drive upload failed") from exc

        if dry_run:
            self.stdout.write(self.style.WARNING("Dry run: skipping Drive upload."))
            return

        accounts = results.get("accounts", {})
        transactions = results.get("transactions", {})
        self.stdout.write(
            self.style.SUCCESS(
                "Accounts report {0} (fileId={1}), transactions report {2} (fileId={3})".format(
                    accounts.get("action"),
                    accounts.get("file_id"),
                    transactions.get("action"),
                    transactions.get("file_id"),
                )
            )
        )

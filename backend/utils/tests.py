from datetime import datetime
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.core import mail
from django.test import SimpleTestCase, override_settings

from utils.email_backend import DevelopmentEmailBackend
from utils.log_archive import archive_logs_to_drive


class DevelopmentEmailBackendTests(SimpleTestCase):
    @override_settings(DEV_EMAIL_RECIPIENT="developer@example.com")
    @patch("django.core.mail.backends.smtp.EmailBackend.send_messages", return_value=1)
    def test_redirects_all_recipients_to_developer(self, send_messages):
        message = mail.EmailMessage(
            subject="Payment confirmation",
            body="Sensitive content",
            from_email="info@example.com",
            to=["real-user@example.com"],
            cc=["board@example.com"],
            bcc=["audit@example.com"],
        )

        DevelopmentEmailBackend().send_messages([message])

        self.assertEqual(message.to, ["developer@example.com"])
        self.assertEqual(message.cc, [])
        self.assertEqual(message.bcc, [])
        self.assertEqual(message.subject, "[DEV] Payment confirmation")
        self.assertEqual(
            message.extra_headers["X-Original-Recipients"],
            "real-user@example.com, board@example.com, audit@example.com",
        )
        send_messages.assert_called_once_with([message])

    @override_settings(DEV_EMAIL_RECIPIENT="")
    def test_requires_a_development_recipient(self):
        message = mail.EmailMessage(
            subject="Test",
            body="Body",
            from_email="info@example.com",
            to=["real-user@example.com"],
        )

        with self.assertRaisesMessage(
            Exception,
            "DEV_EMAIL_RECIPIENT must be configured before sending development emails.",
        ):
            DevelopmentEmailBackend().send_messages([message])


class LogArchiveTests(SimpleTestCase):
    @patch("utils.log_archive.MediaFileUpload")
    @patch("utils.log_archive.find_or_create_folder", side_effect=["logs", "2026", "10"])
    def test_uploads_logs_to_year_and_month_folder(
        self, find_or_create_folder, media_file_upload
    ):
        with TemporaryDirectory() as temp_dir:
            log_path = Path(temp_dir) / "archive-test.log"
            log_path.write_text("entry", encoding="utf-8")
            with self.settings(BASE_DIR=Path(temp_dir)):
                service = type(
                    "Service",
                    (),
                    {
                        "files": lambda self: type(
                            "Files",
                            (),
                            {
                                "create": lambda self, **kwargs: type(
                                    "Request",
                                    (),
                                    {
                                        "execute": lambda self: {
                                            "id": "1",
                                            "name": "archive-test",
                                        }
                                    },
                                )()
                            },
                        )()
                    },
                )()
                uploaded = archive_logs_to_drive(
                    service, archive_date=datetime(2026, 10, 24)
                )

        self.assertEqual(uploaded, [{"id": "1", "name": "archive-test"}])
        self.assertEqual(find_or_create_folder.call_count, 3)
        media_file_upload.assert_called_once()

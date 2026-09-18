from unittest.mock import patch

from django.core import mail
from django.test import SimpleTestCase, override_settings

from utils.email_backend import DevelopmentEmailBackend


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
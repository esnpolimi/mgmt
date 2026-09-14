from django.conf import settings
from django.core.mail.backends.smtp import EmailBackend as SMTPEmailBackend
from django.core.exceptions import ImproperlyConfigured


class DevelopmentEmailBackend(SMTPEmailBackend):
    """Redirect every development email to the configured safe recipient."""

    def send_messages(self, email_messages):
        recipient = getattr(settings, "DEV_EMAIL_RECIPIENT", "").strip()
        if not recipient:
            raise ImproperlyConfigured(
                "DEV_EMAIL_RECIPIENT must be configured before sending development emails."
            )

        for message in email_messages:
            original_recipients = message.recipients()
            message.to = [recipient]
            message.cc = []
            message.bcc = []
            message.subject = f"[DEV] {message.subject}"
            message.extra_headers["X-Original-Recipients"] = ", ".join(original_recipients)

        return super().send_messages(email_messages)
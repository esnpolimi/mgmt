from django.contrib.auth.tokens import PasswordResetTokenGenerator
from six import text_type

from profiles.models import Profile


class TokenGenerator(PasswordResetTokenGenerator):
    # To make verification links last 7 days, look at PASSWORD_RESET_TIMEOUT in base.py
    def _make_hash_value(self, user: "Profile", timestamp):
        return (
                text_type(user.pk) + text_type(timestamp) +
                text_type(user.email_is_verified)
        )


email_verification_token = TokenGenerator()

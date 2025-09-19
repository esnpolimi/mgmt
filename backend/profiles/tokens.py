from django.contrib.auth.tokens import PasswordResetTokenGenerator
from six import text_type

from profiles.models import Profile


class TokenGenerator(PasswordResetTokenGenerator):
    # Make verification links last 7 days
    timeout = 60 * 60 * 24 * 7

    def _make_hash_value(self, user: "Profile", timestamp):
        return (
                text_type(user.pk) + text_type(timestamp) +
                text_type(user.email_is_verified)
        )


email_verification_token = TokenGenerator()

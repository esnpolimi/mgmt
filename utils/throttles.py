from django.conf import settings
from rest_framework.throttling import SimpleRateThrottle


class AuthAttemptThrottle(SimpleRateThrottle):
    """Per-IP limit for public endpoints that guess passwords or send emails.

    shortcut: keyed on the client IP (X-Forwarded-For when present), so a spoofed header can evade it;
    set REST_FRAMEWORK NUM_PROXIES and move to django-axes if that matters.
    """
    scope = 'auth_attempt'

    def get_cache_key(self, request, view):
        return self.cache_format % {
            'scope': self.scope,
            'ident': self.get_ident(request),
        }

    def get_rate(self):
        return getattr(settings, 'AUTH_THROTTLE_RATE', '10/min')

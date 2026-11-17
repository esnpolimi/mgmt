import json
import logging
import uuid

import sentry_sdk
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

logger = logging.getLogger(__name__)

MAX_JSON_BODY_BYTES = 64 * 1024
# 4xx worth a Sentry event so support can find them by user email. 401/404/429 are skipped (bots, token expiry).
CAPTURED_CLIENT_ERRORS = {400, 403, 409, 422}
SKIPPED_PATH_PREFIXES = ('/backend/login', '/backend/api/token', '/admin')


def _user_from_bearer(request):
    """Identify the user from the JWT access token (user_id claim is the profile email): no DB hit."""
    header = request.headers.get('Authorization', '')
    if not header.startswith('Bearer '):
        return None
    try:
        token = AccessToken(header[7:])
    except TokenError:
        return None
    email = token.get('user_id')
    if not email:
        return None
    profile = (token.get('user') or {}).get('profile') or {}
    return {'id': str(email), 'email': str(email), 'group': profile.get('group')}


def _email_from_json_body(request):
    """Public flows (erasmus form, profile creation, form login) are anonymous: use the email they submit."""
    try:
        if not (request.content_type or '').startswith('application/json'):
            return None
        if int(request.META.get('CONTENT_LENGTH') or 0) > MAX_JSON_BODY_BYTES:
            return None
        email = (json.loads(request.body) or {}).get('email')
    except (ValueError, TypeError, AttributeError):
        return None
    if isinstance(email, str) and '@' in email and len(email) <= 254:
        return {'id': email, 'email': email, 'group': None}
    return None


class SentryRequestContextMiddleware:
    """
    Enriches Sentry scope with request metadata and the acting user, so any issue can be found
    by searching `user.email:<email>` in Sentry.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request_id = request.headers.get('X-Request-ID') or str(uuid.uuid4())
        request.sentry_request_id = request_id
        user = None

        try:
            user = _user_from_bearer(request) or _email_from_json_body(request)
            sentry_sdk.set_tag('request_id', request_id)
            sentry_sdk.set_tag('http_method', request.method)
            sentry_sdk.set_tag('request_path', request.path)
            if user:
                sentry_sdk.set_user({'id': user['id'], 'email': user['email']})
                if user['group']:
                    sentry_sdk.set_tag('user_group', user['group'])
            sentry_sdk.set_context('request_context', {
                'path': request.path,
                'method': request.method,
                'query': dict(request.GET.lists()),
            })
            sentry_sdk.add_breadcrumb(
                category='http.request',
                level='info',
                message=f"{request.method} {request.path}",
                data={'request_id': request_id, 'query': dict(request.GET.lists())},
            )
        except Exception:
            logger.exception("Failed to enrich Sentry scope")

        response = self.get_response(request)
        response['X-Request-ID'] = request_id
        self._report_response(request, response, user)
        return response

    def process_view(self, request, view_func, view_args, view_kwargs):
        """Tag the Sentry scope with the app module and URL ids (event_id, pk, ...) being acted on."""
        try:
            sentry_sdk.set_tag('view_module', view_func.__module__)
            if view_kwargs:
                sentry_sdk.set_context('url_params', {k: str(v) for k, v in view_kwargs.items()})
        except Exception:
            logger.exception("Failed to tag Sentry scope with view info")

    @staticmethod
    def _report_response(request, response, user):
        """Handled 4xx never raise, so without this a user's failed action leaves no trace in Sentry."""
        try:
            status = response.status_code
            if status in CAPTURED_CLIENT_ERRORS and user and not request.path.startswith(SKIPPED_PATH_PREFIXES):
                detail = getattr(response, 'data', None)
                route = getattr(getattr(request, 'resolver_match', None), 'route', request.path)
                with sentry_sdk.new_scope() as scope:
                    scope.set_context('response', {'status': status, 'detail': str(detail)[:1000]})
                    scope.set_fingerprint([request.method, str(route), str(status)])
                    sentry_sdk.capture_message(f"HTTP {status} {request.method} {route}", level='warning')
        except Exception:
            logger.exception("Failed to report client error to Sentry")

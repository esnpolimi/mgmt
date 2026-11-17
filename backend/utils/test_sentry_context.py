import json
from unittest.mock import patch

from django.http import HttpResponse
from django.test import RequestFactory, SimpleTestCase
from rest_framework_simplejwt.tokens import AccessToken

from backend.middleware.sentry_context import SentryRequestContextMiddleware


class SentryUserContextTests(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def _run(self, request, status=200):
        middleware = SentryRequestContextMiddleware(lambda r: HttpResponse(status=status))
        with patch('backend.middleware.sentry_context.sentry_sdk') as sdk:
            middleware(request)
        return sdk

    @staticmethod
    def _bearer(email='marco@esnpolimi.it'):
        token = AccessToken()
        token['user_id'] = email
        token['user'] = {'profile': {'group': 'Board'}}
        return f'Bearer {token}'

    def test_bearer_token_sets_user_email(self):
        request = self.factory.get('/backend/events/', HTTP_AUTHORIZATION=self._bearer())
        sdk = self._run(request)
        sdk.set_user.assert_called_once_with({'id': 'marco@esnpolimi.it', 'email': 'marco@esnpolimi.it'})
        sdk.set_tag.assert_any_call('user_group', 'Board')

    def test_anonymous_json_body_email_sets_user(self):
        request = self.factory.post('/backend/profile/initiate-creation/',
                                    data=json.dumps({'email': 'student@example.com'}),
                                    content_type='application/json')
        sdk = self._run(request)
        sdk.set_user.assert_called_once_with({'id': 'student@example.com', 'email': 'student@example.com'})

    def test_invalid_token_and_no_body_sets_no_user(self):
        request = self.factory.get('/backend/events/', HTTP_AUTHORIZATION='Bearer garbage')
        self.assertFalse(self._run(request).set_user.called)

    def test_client_error_is_captured_only_with_user(self):
        with_user = self.factory.post('/backend/transactions/', HTTP_AUTHORIZATION=self._bearer())
        self.assertTrue(self._run(with_user, status=400).capture_message.called)
        self.assertFalse(self._run(self.factory.post('/backend/transactions/'), status=400).capture_message.called)

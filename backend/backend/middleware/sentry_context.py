import uuid
import logging
import sentry_sdk

logger = logging.getLogger(__name__)

class SentryRequestContextMiddleware:
    """
    Enriches Sentry scope with request metadata to improve incident traceability.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request_id = request.headers.get('X-Request-ID') or str(uuid.uuid4())
        request.sentry_request_id = request_id

        try:
            with sentry_sdk.configure_scope() as scope:
                scope.set_tag('request_id', request_id)
                scope.set_tag('http_method', request.method)
                scope.set_tag('request_path', request.path)

                scope.set_context('request_context', {
                    'path': request.path,
                    'method': request.method,
                    'query': dict(request.GET.lists()),
                })

            sentry_sdk.add_breadcrumb(
                category='http.request',
                level='info',
                message=f"{request.method} {request.path}",
                data={
                    'request_id': request_id,
                    'query': dict(request.GET.lists()),
                },
            )
        except Exception:
            logger.exception("Failed to enrich Sentry scope")

        response = self.get_response(request)
        response['X-Request-ID'] = request_id
        return response
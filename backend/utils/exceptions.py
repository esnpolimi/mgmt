import logging

import sentry_sdk
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger(__name__)


def api_exception_handler(exc, context):
    """
    Custom DRF exception handler.
    Lets DRF process known APIExceptions (400/401/403/404 etc.) as usual.
    Logs + captures unknown exceptions and returns a generic 500.
    """
    response = drf_exception_handler(exc, context)
    if response is not None:
        return response
    logger.error(str(exc), exc_info=True)
    sentry_sdk.capture_exception(exc)
    return Response({"error": "Errore interno del server."}, status=500)

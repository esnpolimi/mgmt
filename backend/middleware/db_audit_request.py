from threading import local

from rest_framework_simplejwt.tokens import AccessToken


_state = local()


def get_audit_actor_context() -> dict:
    actor = getattr(
        _state,
        "actor",
        {
            "user_id": None,
            "method": None,
            "path": None,
            "ip": None,
        },
    )

    request = getattr(_state, "request", None)
    if request is None:
        return actor

    user = getattr(request, "user", None)
    if user and user.is_authenticated:
        actor["user_id"] = user.pk
        return actor

    auth_header = request.META.get("HTTP_AUTHORIZATION", "")
    if not auth_header.startswith("Bearer "):
        return actor

    raw_token = auth_header.split(" ", 1)[1].strip()
    if not raw_token:
        return actor

    try:
        token = AccessToken(raw_token)
        actor["user_id"] = token.get("user_id")
    except Exception:
        pass

    return actor


class DBAuditContextMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        ip = forwarded_for.split(",")[0].strip() if forwarded_for else request.META.get("REMOTE_ADDR")

        _state.request = request
        _state.actor = {
            "user_id": None,
            "method": request.method,
            "path": request.path,
            "ip": ip,
        }

        try:
            return self.get_response(request)
        finally:
            _state.request = None
            _state.actor = {
                "user_id": None,
                "method": None,
                "path": None,
                "ip": None,
            }

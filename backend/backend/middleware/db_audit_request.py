from threading import local


_state = local()


def get_audit_actor_context() -> dict:
    return getattr(
        _state,
        "actor",
        {
            "user_id": None,
            "method": None,
            "path": None,
            "ip": None,
        },
    )


class DBAuditContextMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, "user", None)
        user_id = user.pk if user and user.is_authenticated else None

        forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        ip = forwarded_for.split(",")[0].strip() if forwarded_for else request.META.get("REMOTE_ADDR")

        _state.actor = {
            "user_id": user_id,
            "method": request.method,
            "path": request.path,
            "ip": ip,
        }

        try:
            return self.get_response(request)
        finally:
            _state.actor = {
                "user_id": None,
                "method": None,
                "path": None,
                "ip": None,
            }

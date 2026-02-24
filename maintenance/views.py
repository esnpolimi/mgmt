import json
import os
import time
import uuid

from django.contrib.admin.views.decorators import staff_member_required
from django.http import StreamingHttpResponse
from django.shortcuts import render
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

# Path to the JSON file that stores the current notification state.
# It lives next to manage.py in the backend root.
NOTIFICATION_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    'maintenance_notification.json'
)

DEFAULT_MESSAGE = "The system will undergo maintenance in 10 minutes. Please save your work and log out to avoid any data loss. \n Contact informatica@esnpolimi.it for more information."


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _read_notification():
    """Return the current notification dict from the JSON file."""
    try:
        with open(NOTIFICATION_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"notification_id": None, "message": DEFAULT_MESSAGE, "triggered_at": None}


def _write_notification(message=DEFAULT_MESSAGE):
    """Write a new notification to the JSON file and return the written data."""
    data = {
        "notification_id": str(uuid.uuid4()),
        "message": message,
        "triggered_at": timezone.now().isoformat(),
    }
    with open(NOTIFICATION_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return data


# ---------------------------------------------------------------------------
# SSE stream  –  GET /backend/maintenance/stream/
# Authentication required: anonymous requests are rejected with 403 to prevent
# any client from opening unbounded long-lived worker-thread connections.
# Each accepted connection auto-recycles after MAX_TICKS (~10 min); the
# browser EventSource reconnects automatically.
# NOTE: until the WSGI blocking issue is resolved this view must stay
# protected – do not remove the authentication guard.
# ---------------------------------------------------------------------------

def _sse_event_generator():
    """
    Generator that keeps a long-lived SSE connection open.
    - Immediately sends the current notification to newly-connected clients so
      they never miss a notification that was written before they connected.
    - Checks the JSON file every 3 seconds.
    - Sends a 'maintenance' event when the notification_id changes.
    - Sends a heartbeat comment every ~30 s to keep the connection alive.
    - Closes after MAX_TICKS iterations (~10 min) so the WSGI worker thread
      is recycled; the browser EventSource reconnects automatically.
    """
    MAX_TICKS = 200  # 200 × 3 s ≈ 10 minutes per connection slot

    # Read the notification that exists at connection time.
    current = _read_notification()
    current_id = current.get("notification_id")

    # If a notification is already active, deliver it immediately so clients
    # connecting after the write don't miss it.
    if current_id:
        payload = json.dumps({
            "message": current.get("message", DEFAULT_MESSAGE),
            "triggered_at": current.get("triggered_at", ""),
        }, ensure_ascii=False)
        yield f"event: maintenance\ndata: {payload}\n\n"

    last_id = current_id
    tick = 0

    while tick < MAX_TICKS:
        time.sleep(3)
        tick += 1

        # Heartbeat every ~30 s (10 ticks × 3 s)
        if tick % 10 == 0:
            yield ": heartbeat\n\n"

        current = _read_notification()
        current_id = current.get("notification_id")

        if current_id and current_id != last_id:
            last_id = current_id
            payload = json.dumps({
                "message": current.get("message", DEFAULT_MESSAGE),
                "triggered_at": current.get("triggered_at", ""),
            }, ensure_ascii=False)
            yield f"event: maintenance\ndata: {payload}\n\n"

    # Send a named 'reconnect' comment so the client knows this is an
    # intentional reset, not an error. EventSource will reconnect on its own.
    yield ": reconnect\n\n"


def maintenance_stream(request):
    """
    SSE endpoint. Clients hold this connection open to receive push alerts.

    Requires an authenticated session. Anonymous requests are rejected with
    HTTP 403 before the streaming generator is created, so unauthenticated
    clients can never tie up a worker thread with a long-lived connection.
    """
    if not request.user.is_authenticated:
        from django.http import JsonResponse
        return JsonResponse(
            {"detail": "Authentication required to connect to the maintenance stream."},
            status=403,
        )

    response = StreamingHttpResponse(
        _sse_event_generator(),
        content_type='text/event-stream; charset=utf-8',
    )
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'   # disable nginx buffering
    return response


# ---------------------------------------------------------------------------
# Django admin page  –  GET/POST /admin/maintenance-notify/
# Accessible only to staff members via a button in the admin panel.
# ---------------------------------------------------------------------------

@staff_member_required
@require_http_methods(["GET", "POST"])
def maintenance_admin_view(request):
    """Simple staff-only page with a button to fire the maintenance alert."""
    sent = False
    if request.method == 'POST':
        _write_notification(DEFAULT_MESSAGE)
        sent = True

    context = {
        'title': 'Notifica Manutenzione',
        'sent': sent,
        'has_permission': True,
    }
    return render(request, 'maintenance/notify_admin.html', context)

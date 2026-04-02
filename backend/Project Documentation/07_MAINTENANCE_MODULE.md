# 07 - Maintenance Module

## 1. Module Purpose

The maintenance module manages application-maintenance notifications for authenticated clients.

Responsibilities:

- expose current maintenance state
- push events via SSE with controlled connections
- trigger and clear notifications via staff-only admin page
- persist notification state in a shared JSON file

## 2. Domain Model

The module does not use dedicated Django models.

Application state is persisted in:

- backend/maintenance_notification.json

Payload schema:

- notification_id (UUID or null)
- triggered_at (ISO datetime or null)

Invariants:

1. `notification_id = null` indicates no active notification.
2. `message` keeps a default operational text when not provided.
3. `triggered_at` is set only when notification is active.

## 3. API Contract Summary

Base path: /backend/

### 3.1 Streaming API

- GET /maintenance/stream/

Behavior:

- requires JWT access token in query parameter `token`
- returns HTTP `403` when token is missing or invalid
- sends a maintenance event when `notification_id` changes
- sends periodic heartbeat to keep connection alive
- auto-rotates connection after a time window to recycle workers

### 3.2 Polling API

- GET /maintenance/status/

Behavior:

- requires authentication (`IsAuthenticated`)
- returns current notification state (`notification_id`, `message`, `triggered_at`)

### 3.3 Admin Action Endpoint

- GET|POST /admin/maintenance-notify/

Behavior:

- accessible only to staff members
- `action=send`: creates a new notification with UUID and timestamp
- `action=clear`: resets state to no active notification

## 4. Permission Model

Main rules:

1. maintenance stream requires valid JWT token.
2. maintenance status requires an authenticated user.
3. maintenance admin page requires `staff_member_required`.
4. trigger/clear are available only from authorized admin UI.

## 5. Core Business Flows

### 5.1 Trigger Maintenance Notification

1. staff opens maintenance admin page
2. submits `action=send`
3. backend generates `notification_id` and `triggered_at`
4. state is written to `maintenance_notification.json`
5. SSE clients detect change and receive maintenance event

### 5.2 Clear Maintenance Notification

1. staff submits `action=clear`
2. backend resets payload with `notification_id = null`
3. state is updated in `maintenance_notification.json`
4. polling/SSE clients no longer receive active state

### 5.3 Client Consumption Flow

1. authenticated client reads state from `/maintenance/status/`
2. optionally opens `EventSource` on `/maintenance/stream/?token=<jwt>`
3. on maintenance event, shows UI banner/notification
4. on clear, removes banner

## 6. Operational Constraints

1. File-based persistence depends on shared local filesystem access.
2. SSE on WSGI relies on controlled long-lived connections with timeout/recycle.
3. Stream authentication via query param is required due to EventSource header limits.
4. Heartbeats are required to prevent infrastructure idle timeouts.

## 7. Operational Risks

1. race condition on file writes in multi-process environments.
2. state mismatch across instances if storage is not shared.
3. token exposure in query string inside infrastructure logs.
4. worker saturation if stream is not limited/recycled correctly.

## 8. Testing Requirements

1. stream without token returns 403.
2. stream with invalid/expired token returns 403.
3. status requires authentication and returns full payload.
4. `action=send` creates `notification_id` and `triggered_at`.
5. action clear resets notification_id and triggered_at.
6. verify maintenance-event emission when `notification_id` changes.

## 9. Canonical Source Files

For AI-agent analysis/verification, use these files as primary references:

- backend/maintenance/urls.py
- backend/maintenance/views.py
- backend/backend/urls.py
- backend/maintenance_notification.json

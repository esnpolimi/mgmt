# 03 - Events Module

## 1. Module Purpose

The events module is the operational core for event, list, and subscription management.

Responsibilities:

- event CRUD and metadata
- EventList management and capacity pooling
- office subscriptions and public form submissions
- dynamic fields (form/additional)
- SumUp payment integration
- payment-state synchronization with treasury
- organizer utilities (move, waivers, shared lists)

## 2. Domain Model

### 2.1 Event

Main business attributes:

- identifiers: `name`, `date`, `description`
- pricing: `cost`, `deposit`
- subscription window: `subscription_start_date`, `subscription_end_date`
- form: `enable_form`, `form_programmed_open_time`, `form_note`, `form_capacity`
- online payment toggle: `allow_online_payment`
- WhatsApp group sharing: `enable_whatsapp_link`, `whatsapp_group_link` (see 5.7; unrelated to the content-module `whatsapp-register` flow)
- Event editor shows a concise explanation of WhatsApp sharing in an information tooltip next to the sharing toggle.
- Event editor shows explanations for event options and profile data next to their labels through information tooltips.
- Generated release forms keep the personal-data section bilingual, while the waiver and privacy text are written in English.
- vCard contact exports avoid duplicating phone and WhatsApp prefixes already included in profile data.
- dynamic configuration: `fields`, `profile_fields`, `services`
- governance: `notify_list`, `visible_to_board_only`, `reimbursements_by_organizers_only`

### 2.2 EventList

Many-to-many relation with `Event` through `EventListEvent`.

Attributes:

- name
- capacity (0 = unlimited)
- display_order
- is_main_list
- is_waiting_list

Computed metrics:

- subscription_count
- available_capacity

### 2.3 Subscription

Attributes:

- `profile` (nullable) and `external_*` fields for external subscribers
- event, list
- form_data, additional_data
- selected_services
- created_by_form
- sumup_checkout_id, sumup_transaction_id
- `additional_data['payment_failed']`: technical flag shown in the subscriber table as "Pagamento fallito"; it indicates that the latest online payment attempt failed and is cleared when a new checkout is created.

Computed serializer fields (`SubscriptionSerializer`):

- `subscribed_at`: alias of `created_at`
- `paid_at`: `created_at` of the earliest payment transaction (types `SUBSCRIPTION`, `CAUZIONE`, `SERVICE`) linked to the subscription, or `null` if nothing is paid. `EventWithSubscriptionsSerializer` precomputes it with a `paid_at_annotated` queryset annotation (`Min` over `transaction__created_at`); other callers fall back to a per-object aggregate query. The type list is `PAYMENT_TRANSACTION_TYPES` in `backend/events/serializers.py`.

Constraint: `unique(profile, event)` — enforced at the database level only for rows where `profile` is non-null (standard SQL `UNIQUE` behaviour treats each `NULL` as distinct, so multiple external subscriptions with `profile=null` on the same event are not blocked by the DB). Deduplication of external subscribers (identified by `external_name`) is enforced at the application level in the subscription creation and move-subscription views.

## 3. API Contract Summary

Base path: /backend/

### 3.1 Event APIs

- GET /events/
- POST /event/
- GET|PATCH|DELETE /event/<pk>/

### 3.2 Subscription APIs

- POST /subscription/
- GET|PATCH|DELETE /subscription/<pk>/
- POST /move-subscriptions/

### 3.3 Public Form APIs

- GET /event/<event_id>/form/
- GET /event/<event_id>/formstatus/
- POST /event/<event_id>/formsubmit/

`formsubmit` success response also returns `access_token` (the per-subscription signed token, see 5.7) and `whatsapp_link_url` (stable WhatsApp access URL, or `null` when the subscription is not eligible).

### 3.4 Payment APIs

- GET /subscription/<pk>/status/
- POST /subscription/<pk>/process_payment/
- POST /sumup/webhook/
- GET /subscription/<pk>/whatsapp/?t=<token> (public, no auth)

Behavior notes:

- `status` is computed primarily from local subscription/transaction state and can expose a pre-payment block (`payment_blocked=true`, reason `sold_out`) when both Main and Waiting lists are full.
- in sold-out conditions, `process_payment` returns `409` with `status=BLOCKED` and `error=sold_out`, except when the remote checkout is already confirmed as paid (in that case it finalizes local transactions and returns success).
- `process_payment` accepts an optional body field `t` (the per-subscription token). A `PAID` response additionally carries `assigned_list` (only when `notify_list`), `is_main_list`, `whatsapp_enabled` and, only when `t` is valid and the subscription is eligible, `whatsapp_link_url` (built by `_paid_result_extras`).
- `subscription/<pk>/whatsapp/` returns `{whatsapp_group_link, event_name}` with the event's *current* link when the token is valid and the subscription is eligible; any other case (unknown pk, bad/missing token, not eligible, feature off) returns `404 {"error": "not_available"}`.

### 3.5 Organizer Utilities

- GET /event/<event_id>/printable_liberatorie/
- POST /generate_liberatorie_pdf/
- POST /link-lists/
- GET /available-for-sharing/
- PATCH /subscription/<pk>/edit_formfields/

## 4. Permission Model

Core mapping:

- view_event
- add_event
- change_event
- delete_event
- view_subscription
- add_subscription
- change_subscription
- delete_subscription

Additional rules:

1. printable/generate waivers: Board or lead organizer.
2. `visible_to_board_only`: visibility restricted to Board.
3. `reimbursements_by_organizers_only`: reimbursements limited to organizer/Board.

## 5. Core Business Flows

### 5.1 Office Subscription Flow

1. subscription-window validation
2. duplicate check on `profile/event` or `external_name/event`
3. `selected_services` validation against event catalog
4. subscription persistence
5. transaction sync for fee/deposit/services

Transaction sync goes through `_upsert_transaction` in `backend/events/views.py`: an existing transaction of the same type is updated in place when account or amount changes (`Transaction.save()` rebalances accounts) instead of being deleted and recreated, so its `created_at` — and therefore the subscription's `paid_at` — keeps the original payment time. Same account and amount is a no-op.

### 5.2 Public Form Flow

1. load `fields` schema from `Event`
2. dynamic payload validation
3. optional file upload (field type `l`) to Drive
4. insertion into form list (always, even when Main/Waiting are full)
5. confirmation email delivery
6. optional online checkout trigger (payment remains a separate step)

### 5.3 Online Payment Reconciliation

1. pre-check on list capacity for subscriptions outside Main/Waiting
2. if Main and Waiting are both full: `status` reports `payment_blocked=true` (`sold_out`)
3. in the same sold-out condition, `process_payment` returns `409 BLOCKED` unless remote checkout is already paid
4. otherwise `process_payment` queries checkout status
5. webhook asynchronous server-to-server confirmation
6. idempotent transaction creation
7. subscription state alignment

### 5.4 ESNcard Gate for Online Payment

For events that are not open to external participants, users can submit the event form with an expired or absent ESNcard. When online payment starts, payment status and payment confirmation verify the latest ESNcard. Invalid cards block payment and show an explanatory renewal message.

For events open to external participants, the ESNcard gate is disabled: registered profiles with expired or absent cards can submit the form and complete online payment like any other participant.

Public form submission checks ESNcard eligibility before creating a SumUp checkout, so blocked users never receive a remote checkout link.

Integration payment flows use a valid ESNcard fixture because payment validation is enforced server-side.

### 5.5 Form Status Capacity Gate

`event/<event_id>/formstatus/` uses Form List as the primary online-capacity gate.

Compatibility notes:

1. `form_list_full` is the main indicator for public-form availability.
2. `main_list_full` and `waiting_list_full` are still returned for backward compatibility.
3. sold-out payment blocking remains based on Main/Waiting capacity rules at payment time.

When creating or updating an event with the public form enabled, `form_capacity` controls the automatic Form List: a positive integer sets the exact number of online form submissions, while `0` means unlimited capacity. If omitted by a legacy API client, creation keeps the previous fallback based on Main + Waiting capacity.

PATCH enabling an existing event form applies submitted `form_capacity` when creating a missing Form List.

The subscriber grid supports selecting multiple rows and copying their visible values as tab-separated text for spreadsheets.

Spreadsheet exports prefix subscriber-controlled values beginning with `=`, `+`, `-`, or `@` to prevent formula execution.

Event subscriptions require an active profile with verified email, for both public forms and authenticated subscriptions.

### 5.6 Unified Refund UI Flow (Single Icon)

For each subscription in list view, a single "Reimburse" action is available.

Behavior:

1. open menu/modal with reimbursable-item selection
2. available items: fee, additional services, deposit
3. checkbox disabled when item is already reimbursed or not paid
4. icon disabled when no item is reimbursable
5. submit uses frontend orchestration across existing endpoints
6. partial outcomes are managed per item (OK/Error)

Operational note:

- combined flow uses separate calls to `reimburse_quota` and `reimburse_deposits`
- in partial errors, successful items stay confirmed and failed items can be retried
- with current backend logic, "services only" is allowed only if fee is already reimbursed
- frontend action rendering enables reimburse menu also for service-only events (no fee/deposit), based on presence of configured event services and paid service status on subscription

### 5.7 WhatsApp Group Link Sharing

Per-event option to share a WhatsApp group invite with subscribers that hold a spot. Event-level setting, independent of `enable_form`: configured in `EventModal` by `WhatsAppBlock` (switch + link field, rendered for every event, after the additional fields and before the form settings); `Event.clean()` requires a non-empty link starting with `https://chat.whatsapp.com/` (`WHATSAPP_GROUP_LINK_PREFIX`) when `enable_whatsapp_link` is true, and the frontend applies the same check before submit.

Eligibility (`_whatsapp_link_eligible`): sharing active (flag on and link non-empty) AND either

1. subscription total (`cost + deposit + selected services`) is 0, or
2. payment fully registered (`_subscription_payment_already_registered`) AND subscription currently in the Main List.

Partial office payments and waiting-list payers are not eligible.

Security model:

- the raw group link is never exposed by public form/event endpoints; subscribers receive a stable access URL `{SCHEME_HOST}/event/<event_id>/whatsapp?subscriptionId=<pk>&t=<token>`
- the token is `django.core.signing.Signer(salt='events.subscription.whatsapp').signature(str(pk))`, compared with `constant_time_compare`; it exists because subscription pks are sequential
- the same token is appended as `&t=` to online payment links in emails, so the payment page can request the WhatsApp URL after payment
- the access URL resolves the event's current link at click time, so changing the link needs no resend

Delivery (each subscriber receives it once per event; tracked by `additional_data['whatsapp_link_email_sent']`). Invariant: every eligible subscriber with a recipient email receives it; `_maybe_send_whatsapp_link_email` is idempotent and re-checks eligibility, so it is safe to call after any mutation.

1. free event: shown on the form result page (`WhatsAppGroupCard`) and included in the form confirmation email
2. online payment that lands in the Main List: shown on the result page and included in the payment confirmation email (or sent by `_maybe_send_whatsapp_link_email` after `_handle_payment_status`, including webhook-only confirmations)
3. office subscription create/PATCH: `_handle_payment_status` always calls `_maybe_send_whatsapp_link_email` (`send_whatsapp=True`), independently of `send_payment_email` and of whether a payment was registered (covers free events and PATCHes that move a paid subscription into the Main List)
4. `move-subscriptions`: `_handle_payment_status(send_whatsapp=False)`, then `transaction.on_commit(_maybe_send_whatsapp_link_email)` for every moved subscription, so a rolled-back batch sends nothing
5. subscription moved to another event (`move-subscriptions` or PATCH `event`): `_reset_whatsapp_link_sent` clears the flag, so the target event's link is sent if eligible
6. any event PATCH that leaves sharing active: `_send_whatsapp_links_for_event` backfills every eligible subscriber without the flag (background thread unless `CHECKOUT_BACKFILL_ASYNC=False`); already-notified subscribers are skipped, so a link change sends nothing

Not delivered: subscriptions without a recipient email (`_subscription_recipient_email` empty, e.g. office externals); failed sends are not retried until the next mutation or event PATCH.

Frontend pieces:

- `frontend/src/Pages/events/EventWhatsApp.jsx` (route `/event/:id/whatsapp`): calls the resolve endpoint and redirects with `window.location.replace`
- `frontend/src/Components/events/WhatsAppGroupCard.jsx`: button + QR code (desktop only) built with `qrcode.react`
- `EventForm` -> `EventFormResult` -> `EventPayment` pass `accessToken` through router state; `EventPayment` also reads `t` from the query string and, after the SumUp widget reports paid, re-calls `process_payment` with `t` to get list placement and the link

### 5.8 Subscriber List Ordering

`EventListAccordions.jsx` sorts each list client-side with a per-list "Ordina per" selector and asc/desc toggle (state `sortByList`, keyed by list id; default `subscribed_at` desc):

- `subscribed_at` (form/subscription time)
- `paid_at` (only offered when the event has cost, deposit or services)
- `name_surname` / `surname_name` (profile name, then `external_first_name`/`external_last_name`, then `external_name`; Italian locale compare)

Missing values always sort last; ties break on subscription id. When the event has payments, a "Pagato il" column shows `paid_at` (`DD/MM/YYYY HH:mm`), which is also included in copied rows. The backend still returns subscriptions ordered by `-created_at`.

## 6. Dynamic Field Schema

`Event.fields` contains two logical blocks:

- form
- additional

Tipologie supportate:

- t, n, c, m, s, b, d, e, p, l

`Event.services` defines the optional-services catalog with pricing.

## 7. Shared Lists Model

A list can be shared across multiple events.

Invarianti:

1. list capacity is a single cross-event pool
2. `move-subscriptions` can change list and event in the same operation
3. `unique(profile,event)` must remain valid after move

## 8. Integration Notes

- profiles: user resolution and profile metadata
- treasury: payment/reimbursement transactions
- content: public surfaces for event communication

## 9. Operational Risks

1. duplicate/out-of-order webhooks
2. inconsistent payment state between events and treasury
3. incomplete handling of external subscribers in downstream flows
4. regressions in dynamic-schema validation
5. WhatsApp invite links can be forwarded once opened; organizers are advised to enable "approve new participants" in the WhatsApp group
6. reintroducing delete+recreate in `_upsert_transaction` would reset `paid_at`

## 10. Testing Requirements

1. permission matrix for events and subscriptions
2. `fields/services` schema validation
3. idempotenza process_payment + webhook
4. `move-subscriptions` integrity with shared list
5. transaction sync on subscription update
6. form file upload and fallback error handling
7. unified reimbursement: coherent icon/checkbox disable logic and selection validation
8. partial reimbursement: per-item error messages and selective retry
9. form submit vs payment separation: form list insertion must stay allowed, payment blocked only on full Main+Waiting
10. `paid_at` exposure and preservation on payment-account change (`SubscriptionPaidAtTests`)
11. WhatsApp link eligibility, token checks, email delivery paths, event-PATCH backfill, PATCH validation, event-level config without form, office free/no-payment-email paths, event change reset (`WhatsAppGroupLinkTests`)

Test reference: `backend/events/tests.py`.

## 11. Canonical Source Files

For AI-agent analysis/verification, use these files as primary references:

- backend/events/models.py
- backend/events/urls.py
- backend/events/views.py
- backend/events/serializers.py

## 12. Recent Quality Fixes (2026-09-01)

1. Introduced shared constant `FORM_LIST_NAME` in `backend/events/serializers.py` to avoid repeated hardcoded literals.
2. Kept existing form-list behavior unchanged while reducing duplication-related static-analysis noise.
3. Updated multiple exception handlers in `backend/events/views.py` to use `logger.exception(...)` for improved observability without changing business behavior.
4. Reduced cognitive complexity in `subscription_edit_formfields` by extracting JSON parsing/coercion/merge/validation-flattening helpers while preserving endpoint semantics.
5. Reduced nesting in `frontend/src/Components/events/EventListAccordions.jsx` by extracting copy and dynamic-field rendering helpers/components.
6. Reduced cognitive complexity of `event_form_submit` (52 → low) by extracting `_resolve_form_submitter`, `_check_duplicate_form_subscription`, `_apply_form_link_uploads`, `_assign_form_capacity_label`, and `_create_form_payment_checkout` helpers. Endpoint behavior and response payloads are unchanged.
7. Reduced cognitive complexity of `subscription_detail` by extracting PATCH/DELETE flow helpers and shared payload/serialization utilities (`_normalize_subscription_patch_payload`, `_add_auto_move_info`, `_handle_subscription_detail_patch`, `_handle_subscription_detail_delete`) while keeping API behavior unchanged.

## 13. Database Compatibility (2026-09-14)

Some local or legacy databases may still contain obsolete payment confirmation columns on `events_event`; these are not part of the current `Event` model and must be removed or aligned during database maintenance rather than handled in application code.

## 14. Recent Features (2026-10)

1. PR #82: subscriber list ordering and `paid_at` / "Pagato il" column (5.8); `_upsert_transaction` now updates in place (5.1).
2. PR #88: WhatsApp group link sharing (5.7); new model fields `enable_whatsapp_link`, `whatsapp_group_link` (migration `0003_event_whatsapp_group_link`; migrations are gitignored and generated on deploy by `makemigrations`); new frontend dependency `qrcode.react`.

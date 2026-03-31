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
- form: `enable_form`, `form_programmed_open_time`, `form_note`
- online payment toggle: `allow_online_payment`
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

Constraint: `unique(profile, event)`.

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

### 3.4 Payment APIs

- GET /subscription/<pk>/status/
- POST /subscription/<pk>/process_payment/
- POST /sumup/webhook/

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

### 5.2 Public Form Flow

1. load `fields` schema from `Event`
2. dynamic payload validation
3. optional file upload (field type `l`) to Drive
4. insertion into form list
5. confirmation email delivery
6. optional online checkout trigger

### 5.3 Online Payment Reconciliation

1. `process_payment` queries checkout status
2. webhook asynchronous server-to-server confirmation
3. idempotent transaction creation
4. subscription state alignment

### 5.4 Unified Refund UI Flow (Single Icon)

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

## 10. Testing Requirements

1. permission matrix for events and subscriptions
2. `fields/services` schema validation
3. idempotenza process_payment + webhook
4. `move-subscriptions` integrity with shared list
5. transaction sync on subscription update
6. form file upload and fallback error handling
7. unified reimbursement: coherent icon/checkbox disable logic and selection validation
8. partial reimbursement: per-item error messages and selective retry

Test reference: `backend/events/tests.py`.

## 11. Canonical Source Files

For AI-agent analysis/verification, use these files as primary references:

- backend/events/models.py
- backend/events/urls.py
- backend/events/views.py
- backend/events/serializers.py

# 06 - Integration & E2E

## 1. Document Purpose

This specification defines the cross-module flows that represent the functional acceptance baseline.

Scope:

- users
- profiles
- events
- treasury
- content
- maintenance

## 2. End-to-End Critical Scenarios

### 2.1 Scenario A - Complete ESNer Onboarding

Preconditions:

- valid institutional email domain
- working email verification endpoint

Sequence:

1. POST profile/initiate-creation con is_esner=true
2. GET verify-email with valid uid/token
3. POST login
4. access protected endpoints
5. verify initial group and activation state

Test oracles:

- active user
- profile aligned with initial role
- valid token lifecycle

### 2.2 Scenario B - Erasmus onboarding + public form

Preconditions:

- event with active form

Sequence:

1. Erasmus registration and email verification
2. read public form
3. submit valid payload
4. create subscription in form list
5. send confirmation email

Test oracles:

- persistence of form/additional data
- correct subscription state

### 2.3 Scenario C - SumUp payment reconciliation

Preconditions:

- allow_online_payment=true

Sequence:

1. formsubmit creates subscription in Form List and generates checkout_id
2. if Main and Waiting are both full, `status` reports `payment_blocked=true` (`sold_out`)
3. in the same sold-out condition, `process_payment` returns `409 BLOCKED`
4. otherwise `process_payment` or webhook confirms `paid` status
5. create local transactions (fee/deposit/services)
6. payment-status alignment on subscription

Test oracles:

- idempotency on duplicate webhooks
- no double accounting
- form submit remains accepted even when payment is blocked by full Main+Waiting capacity

### 2.4 Scenario D - Reimbursements (fee/deposit/services)

Preconditions:

- original payment transactions exist

Sequence:

1. open single "Reimburse" action on subscription
2. select items (fee/services/deposit) with automatic disable for invalid items
3. orchestrazione chiamate reimburse_quota e/o reimburse_deposits
4. generate refund transactions for successful items
5. update account balance
6. block duplicate reimbursement attempts

Test oracles:

- anti-duplicate constraints respected
- handling of external users without profile preserved
- partial-outcome management: precise error for failed item + selective retry

### 2.5 Scenario E - ESNcard emission/revocation + accounting

Sequence:

1. issue card on valid profile
2. correct fee calculation for the use case
3. create ESNcard transaction
4. card revocation by Board user
5. creation of `rimborso_esncard` transaction on the same account
6. verify emission transaction remains in history
7. verify account balance after refund

Test oracles:

- correct fee policy
- ledger consistency (emission + refund)
- emission transaction preserved for audit
- revocation blocked on accounting edge cases (insufficient balance, closed account)

### 2.6 Scenario F - Content + WhatsApp public workflow

Sequence:

1. manager updates `whatsapp-config`
2. public user submits `whatsapp-register`
3. send email link
4. append audit CSV on Drive

Test oracles:

- access policy respected
- audit trail present

### 2.7 Scenario G - Maintenance notification

Sequence:

1. admin triggers notification
2. authenticated clients read maintenance/status
3. banner frontend visibile
4. clear notification

Test oracles:

- correct state propagation
- consistent notification reset

## 3. Test Asset Mapping

Suite integrazione dedicate:

- backend/test_integration_e2e.py
- backend/users/test_integration.py

Cross-domain support from module suites:

- backend/events/tests.py
- backend/treasury/tests.py
- backend/profiles/tests.py
- backend/content/tests.py

## 4. Release Regression Gate

Minimum checklist for each release:

1. login, refresh, logout
2. ESNer/Erasmus registration and verification
3. event creation + main lists
4. office subscription and public form
5. SumUp payment + idempotent webhook + sold-out pre-payment block
6. fee/deposit/services reimbursements
7. ESNcard issue and revocation
8. transaction export
9. CRUD content home
10. whatsapp register end-to-end

## 5. Cross-Module Risk Register

1. payment misalignment between events and treasury
2. race conditions on account balance updates
3. out-of-order or duplicate webhooks
4. backend/frontend authorization mismatch
5. regressions on external-subscription flows

## 6. Test Strategy Guidelines

1. unit tests for local rules and permissions
2. integration API test per side-effect DB
3. synthetic E2E tests on mission-critical flows
4. deterministic mocks for SumUp, Drive, SMTP

## 7. Acceptance Baseline

An E2E scenario is considered accepted only if:

1. final state is persisted and verifiable
2. external side effects are tracked (email/webhook/export)
3. accounting/authorization invariants are respected
4. no duplication occurs in idempotent operations

## 8. Traceability Map (Scenario -> Test Assets)

Reference mapping for quick agent-driven troubleshooting:

- Scenario A: backend/users/test_integration.py, backend/profiles/tests.py
- Scenario B: backend/profiles/tests.py, backend/events/tests.py
- Scenario C: backend/events/tests.py, backend/treasury/tests.py
- Scenario D: backend/treasury/tests.py, backend/events/tests.py
- Scenario E: backend/treasury/tests.py, backend/profiles/tests.py
- Scenario F: backend/content/tests.py
- Scenario G: backend/maintenance/views.py (comportamento), backend/test_integration_e2e.py

Note: this map indicates the primary tests to inspect; it does not imply exhaustive edge-case coverage.

Documentation reference for Scenario G:

- 07_MAINTENANCE_MODULE.md

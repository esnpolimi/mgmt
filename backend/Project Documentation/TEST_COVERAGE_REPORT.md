# Test Coverage Report - ESN Polimi Management

Last update date: 2026-04-01  
Scope: Django backend (users, profiles, events, treasury, content)

## 1. Quality Scope

This report describes functional test coverage and residual risks.

Methodology note:

- counts represent the number of `test_` functions, not line coverage percentage
- this metric reflects suite breadth, not branch-level depth

## 2. Test Inventory

| Test File | Number of `test_` Functions |
|---|---:|
| backend/users/tests.py | 40 |
| backend/users/test_integration.py | 14 |
| backend/profiles/tests.py | 70 |
| backend/events/tests.py | 114 |
| backend/treasury/tests.py | 83 |
| backend/content/tests.py | 43 |
| backend/test_integration_e2e.py | 6 |
| Total | 370 |

## 3. Functional Coverage Matrix

### 3.1 Users

- JWT authentication (login/refresh/logout)
- reset and forgot password
- user and group CRUD
- special application-permission management

### 3.2 Profiles

- Erasmus/ESNer onboarding
- automatic email verification and Board manual verification
- profile and document CRUD
- search and filters
- support endpoints for events/subscriptions

### 3.3 Events

- event/list CRUD
- office and public-form subscriptions
- dynamic field schema and additional fields
- optional services with pricing
- SumUp flows (checkout/process/webhook)
- sold-out handling: form submission stays allowed in Form List, payment blocked only when Main+Waiting are full
- shared lists and move subscriptions
- waivers and organizer utilities

### 3.4 Treasury

- account CRUD and group-based visibility
- transaction CRUD with balance impact
- ESNcard issuance and fee policy
- ESNcard revocation with tracked refund (`rimborso_esncard`)
- reimbursement request lifecycle
- deposit/fee/services reimbursements
- export XLSX

### 3.5 Content

- section and link CRUD
- policy content manager (Board o can_manage_content)
- WhatsApp singleton configuration
- public `whatsapp-register` workflow with email and Drive CSV audit

### 3.6 E2E Integration

- multi-module tests in `backend/test_integration_e2e.py`
- coverage of critical onboarding/events/payments/reimbursements flows

## 4. Residual Risk Register

1. Treasury concurrency: race conditions on simultaneous balance updates.
2. Scalability: large datasets on events/transactions/reimbursements.
3. Webhook/token security: replay, ordering, expiration, abuse rate.
4. Frontend-backend contracts: payload drift on public forms/payments.

## 5. Recommended Test Enhancements

1. Add concurrency tests for accounting transactions.
2. Introduce explicit contract tests for public endpoints.
3. Strengthen webhook idempotency tests with duplicate/out-of-order events.
4. Add automated E2E smoke tests in release gate.

## 6. Execution Commands

Full execution:

```bash
python manage.py test
```

Per module:

```bash
python manage.py test users
python manage.py test profiles
python manage.py test events
python manage.py test treasury
python manage.py test content
python manage.py test test_integration_e2e
```

Execution with test settings:

```bash
DJANGO_SETTINGS_MODULE=backend.settings.test python manage.py test
```

## 7. Maintenance Policy

1. Every bug fix must include at least one regression test.
2. Every new API must include permissions, validation, happy path, and error path tests.
3. Financial flows must include balance and idempotency checks.
4. This report must be updated for every significant test-suite change.

## 8. AI Agent Interpretation Notes

Rules for correct report usage by AI agents:

1. Do not use total test count as the only quality metric.
2. For high-risk changes, consult `06_INTEGRATION_E2E.md` first.
3. Always validate residual gaps against the requested change.
4. If report and real suite differ, current test execution is authoritative.

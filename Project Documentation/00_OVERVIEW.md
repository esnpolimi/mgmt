# ESN Polimi Management - Technical System Overview

This document is the reference architectural view of the project.
Purpose: provide a clear technical baseline for development, maintenance, onboarding, and AI automation.

## 1. Product Scope

The system covers ESN Polimi core processes:

- Erasmus and ESNer profile management
- onboarding with email verification
- event, list, subscription, and public-form management
- payments and reimbursements (fee, deposit, services)
- treasury operations (accounts, transactions, export)
- dynamic homepage content
- public WhatsApp registration with audit trail
- maintenance state management

## 2. Architecture Snapshot

### 2.1 Backend

- framework: Django + Django REST Framework
- authentication: JWT (SimpleJWT access/refresh)
- database: MySQL (dev/prod), SQLite (test)
- pattern: modular monolith by application domain

### 2.2 Frontend

- stack: React 19 + Vite + MUI
- routing: SPA with protected routes
- API base URL:
  - local: http://localhost:8000/backend
  - prod: https://mgmt.esnpolimi.it/backend

### 2.3 External Integrations

- Google Drive API: form file upload + CSV audit append
- SumUp API: checkout, payment confirmation, webhook reconciliation
- SMTP: operational/transactional email delivery
- Sentry: error tracking in production
- OIDC provider: Dokuwiki integration

## 3. Domain Boundaries

| Module | Responsibilities | Logical Dependencies |
|---|---|---|
| users | auth, user/group management, special permissions | profiles |
| profiles | profiles, documents, email verification, search | users, events |
| events | events, lists, subscriptions, forms, payments | profiles, treasury |
| treasury | accounts, transactions, ESNcard, reimbursements | profiles, events, users |
| content | homepage content, WhatsApp config/register | users |
| maintenance | maintenance state and notifications | - |

## 4. Authorization Model

### 4.1 Groups

- Board
- Attivi
- Aspiranti

### 4.2 Custom User Flags

- can_manage_casse
- can_view_casse_import
- can_manage_content

### 4.3 Global Rules

1. Board has broad implicit privileges across most modules.
2. Attivi can operate in treasury areas based on endpoint permissions.
3. Aspiranti require explicit flags for extra capabilities.
4. A content manager is either Board or has `can_manage_content=true`.
5. Some endpoints enforce object-level permissions (owner/staff/Board).

## 5. API Surface Map

Common backend prefix: /backend/

Routing note:

- API prefixes are centralized in `backend/backend/urls.py` (`BACKEND_API_PREFIX`, `BACKEND_CONTENT_PREFIX`) to keep route declarations consistent and reduce duplication-driven regressions.

- users: /login/, /logout/, /api/token/*, /users/*, /groups/
- profiles: /erasmus_profiles/, /esner_profiles/, /profile/*, /document/*
- events: /events/, /event/*, /subscription/*, /event/*/form*, /sumup/webhook/
- treasury: /accounts/, /account/*, /transactions/, /transaction/*, /esncard_*
- content: /content/sections/*, /content/links/*, /content/whatsapp-*
- maintenance: /maintenance/status/, /maintenance/stream/

## 6. Critical Cross-Module Flows

1. onboarding ESNer: profiles + users
2. onboarding Erasmus: profiles
3. office subscription flow: events + treasury
4. public form subscription flow: events + profiles + treasury
5. SumUp online payment reconciliation: events + treasury
6. reimbursement flow (fee/deposit/services): treasury + events
7. ESNcard issuance/revocation flow: treasury + profiles
8. WhatsApp public registration flow: content + email + drive

Operational details are available in module documents 01-06.

## 7. Configuration and Environments

Primary settings files:

- backend/settings/base.py
- backend/settings/dev.py
- backend/settings/prod.py
- backend/settings/test.py

REST framework exception handling:

- custom handler `utils.exceptions.api_exception_handler` is configured in base and test settings to keep unknown-exception behavior aligned across runtime and CI tests

Primary sensitive variables:

- SECRET_KEY
- SIMPLE_JWT_SIGNING_KEY
- CORS_ALLOWED_ORIGINS
- EMAIL_HOST_PASSWORD
- GOOGLE_DRIVE_FOLDER_ID
- SUMUP_CLIENT_ID
- SUMUP_CLIENT_SECRET
- SUMUP_WEBHOOK_SECRET
- SUMUP_PAY_TO_EMAIL
- SUMUP_MERCHANT_CODE
- SENTRY_DSN

## 8. Observability and Audit

- backend file logging in production
- audit middleware for DB/action context
- Sentry with configurable tracing
- maintenance notification persisted in `maintenance_notification.json`

## 9. Technical Constraints and Invariants

1. Account balance consistency must be preserved on transaction create/update/delete.
2. Online payments and webhooks must be handled idempotently.
3. Permission constraints must not be bypassed at API level.
4. Dynamic event fields must respect the expected JSON schema.
5. External flows without profile (external subscribers) must always be handled in reimbursements.
6. ESNcard revocation must preserve the original emission transaction and register a dedicated refund transaction.

## 10. AI/Automation Notes

1. Always check `urls.py` for actual endpoints and avoid assuming legacy naming.
2. For payments, evaluate `events` and `treasury` logic together.
3. Do not assume `Subscription.profile` is always set.
4. In content, only Board and `can_manage_content` enable management actions.

## 11. Documentation Index

- 01_USERS_MODULE.md
- 02_PROFILES_MODULE.md
- 03_EVENTS_MODULE.md
- 04_TREASURY_MODULE.md
- 05_CONTENT_MODULE.md
- 06_INTEGRATION_E2E.md
- 07_MAINTENANCE_MODULE.md
- TEST_COVERAGE_REPORT.md

## 12. Canonical Code Pointers

This section lists the files to treat as source of truth when an agent must validate real behavior.

- backend routing root: backend/backend/urls.py
- users: backend/users/urls.py, backend/users/views.py, backend/users/serializers.py
- profiles: backend/profiles/urls.py, backend/profiles/views.py, backend/profiles/serializers.py
- events: backend/events/urls.py, backend/events/views.py, backend/events/serializers.py
- treasury: backend/treasury/urls.py, backend/treasury/views.py, backend/treasury/serializers.py
- content: backend/content/urls.py, backend/content/views.py, backend/content/serializers.py
- maintenance: backend/maintenance/urls.py, backend/maintenance/views.py

## 13. AI Reference Usage Rules

Operational rules for AI agents:

1. Use these documents as functional baseline, not as a replacement for code inspection.
2. If documentation and code differ, observed behavior in canonical files is authoritative.
3. Before payment/reimbursement changes, always verify both `events` and `treasury`.
4. Before authorization changes, verify both Django permissions and custom user flags.
5. Do not assume invariants that are not explicitly documented or verifiable in code.

## 14. Documentation Completeness Notes

Current coverage:

- core modules users, profiles, events, treasury, content: detailed
- maintenance module: detailed
- E2E integration baseline: present
- qualitative coverage: present

## 15. CI/CD and Production Deployment

Production release automation is managed by `.github/workflows/deploy-production.yml`.

Current flow:

1. trigger on push to `main`
2. semantic tag creation (`vMAJOR.MINOR.PATCH` with current project policy)
3. backend deploy branch update (`deploy-backend` from `backend/` subtree)
4. frontend build + deploy branch update (`deploy-frontend` from `frontend/build` subtree)
5. GitHub release generation with changelog
6. remote cPanel deploy via SSH (if secrets are configured)

Frontend CI runtime requirement:

- GitHub Actions frontend build uses Node.js 22 (required by Vite 7 / Rollup compatibility).

Guard behavior:

- the `deploy-cpanel` job confirms that both deploy branches are available.
- the cPanel server applies updates through its local pull deployment script, scheduled independently of GitHub Actions or run manually by an operator.

The cPanel pull deployment script runs from `/home/fazucrdl/mgmt.esnpolimi.it/deploy_local.sh` and updates the backend and frontend from their respective deploy branches before applying Django migrations, static files, checks, and the Passenger restart marker.

No GitHub Actions SSH secrets are required for cPanel deployment.

- `CPANEL_SSH_HOST` (origin server hostname or IP; not the Cloudflare-proxied public domain)
- `CPANEL_USERNAME`
- `CPANEL_SSH_KEY`
- `CPANEL_SSH_PORT` (optional)

Remote cPanel execution expects:

- `/home/fazucrdl/mgmt.esnpolimi.it/gitpull_backend.sh`
- `/home/fazucrdl/mgmt.esnpolimi.it/gitpull_frontend.sh`

Then backend post-deploy commands run automatically:

- `pip install -r requirements.txt`
- `python manage.py makemigrations --noinput`
- `python manage.py migrate --noinput`
- `python manage.py collectstatic --noinput`
- `python manage.py check`

Python app restart is performed at the end of the deploy via Passenger/cPanel convention:

- `touch $CPANEL_PYTHON_APP_ROOT/tmp/restart.txt`

If `CPANEL_PYTHON_APP_ROOT` is not configured, the workflow defaults to:

- `/home/fazucrdl/mgmt.esnpolimi.it/backend`

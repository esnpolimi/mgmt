# 05 - Content Module

## 1. Module Purpose

The content module governs dynamic homepage content and the public WhatsApp workflow.

Responsibilities:

- management of editorial sections and ordered links
- authorization enforcement for content managers
- centralized WhatsApp link configuration
- public registration with validation, email delivery, and CSV audit on Drive

## 2. Domain Model

### 2.1 ContentSection

Main attributes:

- title (enum, unique): LINK_UTILI | WIKI_TUTORIAL
- order
- is_active
- created_by, created_at, updated_at

### 2.2 ContentLink

Main attributes:

- section (FK)
- name
- description
- url
- color
- order
- created_by, created_at, updated_at

### 2.3 WhatsAppConfig

Singleton configuration (`pk=1`):

- whatsapp_link
- updated_at
- updated_by

## 3. API Contract Summary

Base path: /backend/content/

### 3.1 Sections APIs

- GET /sections/
- GET /sections/active_sections/
- POST /sections/
- PATCH /sections/<id>/
- DELETE /sections/<id>/

Behavior note:

- `GET /sections/` and `GET /sections/active_sections/` both expose active sections (filtered server-side by `is_active=true`).

### 3.2 Links APIs

- GET /links/
- POST /links/
- PATCH /links/<id>/
- DELETE /links/<id>/

### 3.3 WhatsApp APIs

- GET|PATCH /whatsapp-config/
- POST /whatsapp-register/

## 4. Permission Model

Central guard: `_can_manage_content(user)`

True conditions:

- user in Board
- user.can_manage_content

Endpoint policy:

1. `sections/links` GET: authenticated.
2. sections/links POST/PATCH/DELETE: content manager.
3. `whatsapp-config` GET: authenticated.
4. whatsapp-config PATCH: content manager.
5. `whatsapp-register` POST: public (`AllowAny`).

## 5. Core Business Flows

### 5.1 Editorial CRUD Flow

1. manager creates/updates section or link
2. ordering is applied through `order`
3. `is_active` controls homepage exposure
4. audit metadata preserves change traceability

### 5.2 Public WhatsApp Registration

Required input:

- first_name
- last_name
- email
- is_international
- home_university
- course_of_study

Sequence:

1. serializer validation
2. application of eligibility rules (international/erasmus)
3. verify configured `whatsapp_link` presence
4. send email with group link
5. append audit CSV to Google Drive with timestamp/outcome

Error-path notes:

1. non-international users are rejected with `403`.
2. missing WhatsApp link configuration returns `503`.
3. email delivery failures return `500` and are logged to Sentry + CSV audit.

Target CSV: `cronologia richieste gruppo whatsapp.csv`.

## 6. Integration Notes

- home frontend: rendering active sections and ordered links
- content manager frontend: complete content/configuration administration
- external services: SMTP for emails, Drive API for audit trail

## 7. Operational Constraints

1. `active_sections` is filtered server-side.
2. CSV append is protected by in-process lock to reduce collisions.
3. Email/Drive errors must be traced and observable.

## 8. Operational Risks

1. inconsistent WhatsApp singleton configuration across environments
2. local lock may be insufficient in multi-process deployments
3. regressions in content-manager access policy
4. non-uniform external error handling (SMTP/Drive)

## 9. Testing Requirements

1. permission matrix for Board, `can_manage_content`, standard user
2. validazioni ContentLink (url/color/name/order)
3. `whatsapp-register` allowed and blocked paths
4. failure path email e append CSV
5. verify `active_sections` returns only active content

Test reference: `backend/content/tests.py`.

## 10. Canonical Source Files

For AI-agent analysis/verification, use these files as primary references:

- backend/content/models.py
- backend/content/urls.py
- backend/content/views.py
- backend/content/serializers.py

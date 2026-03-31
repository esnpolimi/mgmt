# 02 - Profiles Module

## 1. Module Purpose

The profiles module manages demographic and document lifecycle for Erasmus and ESNer users.

Responsibilities:

- initial profile registration
- automatic and manual email verification
- identity document management
- administrative search and listing
- profile data exposure for events/treasury modules
- ESNcard actions from profile view integrated with treasury (issuance and revocation)

## 2. Domain Model

### 2.1 Profile

Main functional fields:

- identification: `email` (unique), `is_esner`
- state: `email_is_verified`, `enabled`
- personal info: `name`, `surname`, `birthdate`, `country`, `course`, `domicile`
- contacts: `phone_*`, `whatsapp_*`
- identifiers: `person_code`, `matricola_number`, `matricola_expiration`

Computed properties:

- latest_esncard
- latest_document

### 2.2 Document

- relazione: FK su Profile
- document type: enum (Passport, ID Card, Driving License, Residency Permit, Other)
- globally unique number
- expiration
- enabled

## 3. API Contract Summary

Base path: /backend/

### 3.1 Listing and Search

| Endpoint | Method | Notes |
|---|---|---|
| /erasmus_profiles/ | GET | paginated listing of non-ESNer profiles |
| /esner_profiles/ | GET | paginated listing of ESNer profiles |
| /profiles/search/ | GET | cross-field multi-token search |

Main filters:

- page, page_size, ordering, search
- group (only on `esner_profiles`)
- esncardValidity = valid|expired|absent

### 3.2 Creation and Verification

| Endpoint | Method | Auth |
|---|---|---|
| /profile/initiate-creation/ | POST | public |
| /api/profile/verify-email/<uid>/<token>/ | GET | public |
| /profile/<pk>/manual-verify-email/ | POST | Board |

### 3.3 Detail and Related Data

| Endpoint | Method | Auth |
|---|---|---|
| /profile/<pk>/ | GET/PATCH/DELETE | authenticated + permissions |
| /document/ | POST | authenticated |
| /document/<pk>/ | PATCH/DELETE | authenticated + permissions |
| /profile_subscriptions/<pk>/ | GET | object-level protected |
| /profile_events/<pk>/ | GET | authenticated |
| /check_erasmus_email/ | POST | public |

## 4. Lifecycle Flows

### 4.1 Erasmus Registration Flow

1. `initiate-creation` creates disabled `Profile`/`Document` records.
2. Verification email is sent.
3. `verify-email` enables profile/document.

### 4.2 ESNer Registration Flow

1. `@esnpolimi.it` email domain is mandatory.
2. A related `User` is created in group `Aspiranti`.
3. `verify-email` enables profile/document/user.
4. Post-verification notification is sent to secretariat.

### 4.3 Manual Verification

Board can force profile verification/activation for exceptional cases.

## 5. Authorization Rules

### 5.1 Profile Permissions

- listing: authentication required
- patch profile: profiles.change_profile
- delete profile: Board only
- delete is blocked if linked `Subscription` records exist

### 5.2 Group Transition Constraints

1. `Aspiranti` -> `Attivi`/`Board`: Board only.
2. `Attivi` -> `Board`: Board only.
3. Other transitions follow request validation rules.

### 5.3 Document Permissions

- patch: profiles.change_document
- delete: profiles.delete_document

### 5.4 Object-Level Access

`profile_subscriptions` is accessible only to:

- owner
- staff
- Board

### 5.5 ESNcard Actions From Profile View

- ESNcard issue/update follows dedicated treasury permissions
- ESNcard revocation is visible only to Board members
- Revocation uses treasury flow and generates a `rimborso_esncard` transaction

## 6. Search Semantics

Combined profile search across:

- name, surname, email
- document number
- esncard number
- phone/whatsapp

`esncardValidity` filter is based on `latest_esncard` evaluation.

## 7. Integration Notes

- users: ESNer account creation/activation
- events: profile resolution for subscriptions and data visibility
- treasury: `latest_esncard` lookup for card/service validity
- treasury: ESNcard revocation from profile with preserved emission history and new `rimborso_esncard`

## 8. Operational Risks

1. Misaligned profile/document/user states during activation flows.
2. Regressions in group-promotion rules.
3. Profile deletion with uncaught event dependencies.

## 9. Testing Requirements

1. Registration matrix Erasmus vs ESNer
2. token verification valid/invalid/expired
3. permission matrix profile/document CRUD
4. group transition constraints
5. object-level access profile_subscriptions

Test reference: `backend/profiles/tests.py`.

## 10. Canonical Source Files

For AI-agent analysis/verification, use these files as primary references:

- backend/profiles/models.py
- backend/profiles/urls.py
- backend/profiles/views.py
- backend/profiles/serializers.py

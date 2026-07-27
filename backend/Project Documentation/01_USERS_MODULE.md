# 01 - Users Module

## 1. Module Purpose

The users module implements authentication, JWT token lifecycle handling, user management, and cross-cutting authorization policies.

Main responsibilities:

- login/logout and token lifecycle
- password recovery
- user and Django group management
- exposing raw/effective permissions to frontend
- custom finance/content flag controls
- OIDC support endpoints for wiki integration

## 2. Data Model and Identity

### 2.1 Entita User

`User` extends `AbstractBaseUser` + `PermissionsMixin`.

Relevant fields:

- profile (OneToOne with `Profile`, logical user key)
- is_staff
- last_login
- can_manage_casse
- can_view_casse_import
- can_manage_content

### 2.2 Identity Mapping

- user email is derived from `profile.email`
- application ID is aligned with the profile key
- account validity also depends on linked profile state

## 3. API Contract Summary

Base path: /backend/

### 3.1 Authentication APIs

| Endpoint | Method | Auth Required | Notes |
|---|---|---|---|
| /login/ | POST | no | only `@esnpolimi.it` domain is accepted |
| /logout/ | POST | no | blacklists refresh token if present, clears cookies |
| /api/token/ | POST | no | token pair creation |
| /api/token/refresh/ | POST | no | refresh da cookie |
| /api/token/verify/ | POST | no | token verification |
| /api/forgot-password/ | POST | no | neutral response to prevent user enumeration |
| /api/reset-password/<uid>/<token>/ | POST | no | reset with signed token |

### 3.2 User Management APIs

| Endpoint | Method | Permission |
|---|---|---|
| /users/ | GET | authenticated |
| /users/ | POST | users.add_user |
| /users/<pk>/ | GET | authenticated |
| /users/<pk>/ | PATCH | users.change_user |
| /users/<pk>/ | DELETE | Board only |
| /groups/ | GET | authenticated |
| /users/finance-permissions/ | GET | authenticated |
| /users/finance-permissions/ | PATCH | Board |

## 4. Business Rules

### 4.1 Login Rules

1. Required email domain: `@esnpolimi.it`.
2. Valid credentials are mandatory.
3. `profile.email_is_verified` must be `true`.
4. Response includes token pair and user metadata.
5. ESNer users stay inactive until email verification completes.

### 4.2 Refresh Rules

1. Refresh token is read from an httpOnly cookie.
2. Missing cookie -> `400`.
3. Invalid/expired token -> `401`.

### 4.3 Password Reset Rules

1. Forgot-password never confirms whether an email exists.
2. Reset requires valid uid/token and matching password input.

## 5. Authorization and Effective Permissions

Effective permissions are derived from:

- group membership (Board/Attivi/Aspiranti)
- custom user flags

`finance-permissions` endpoint rules:

1. `PATCH` is allowed only to Board.
2. `can_manage_casse` and related flags can be assigned only to Aspiranti.
3. `can_manage_content` can be assigned only to ESNer profiles.
4. `GET` returns both raw and effective permissions.

## 6. Security Notes

1. Logout is resilient: it succeeds even if token blacklisting is not possible.
2. Refresh cookie uses secure attributes compatible with environment.
3. Password reset is based on signed token and encoded uid.

## 7. Frontend Integration Points

- AuthContext: login/logout/refresh
- ForgotPassword: trigger email reset
- ResetPassword: submit new password
- Profile/Settings: reading and updating finance permissions

## 8. Operational Risks

1. Browser differences for secure cookies in local environments.
2. Regressions in effective permissions exposed to frontend.
3. Mismatch between profile state and active user state.

## 9. Testing Requirements

Minimum required tests:

1. login matrix (domain, verified state, credentials)
2. refresh da cookie (ok/missing/expired)
3. permission matrix CRUD users
4. Board-only `finance-permissions` + group constraints
5. reset-password invalid token and mismatch cases

Test references:

- backend/users/tests.py
- backend/users/test_integration.py

## 10. Canonical Source Files

For AI-agent analysis/verification, use these files as primary references:

- backend/users/models.py
- backend/users/urls.py
- backend/users/views.py
- backend/users/serializers.py
- backend/users/managers.py

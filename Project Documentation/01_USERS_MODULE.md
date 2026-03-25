# 01 - Users Module

## 1. Module Purpose

Il modulo users implementa autenticazione, ciclo token JWT, gestione utenti e policy autorizzative trasversali.

Responsabilita principali:

- login/logout e token lifecycle
- recupero password
- gestione utenti e gruppi Django
- esposizione permessi raw/effective per frontend
- controllo flag custom finance/content
- endpoint OIDC di supporto integrazione wiki

## 2. Data Model and Identity

### 2.1 Entita User

User estende AbstractBaseUser + PermissionsMixin.

Campi rilevanti:

- profile (OneToOne con Profile, chiave logica utente)
- is_staff
- last_login
- can_manage_casse
- can_view_casse_import
- can_manage_content

### 2.2 Identity Mapping

- email utente e derivata da profile.email
- id applicativo e allineato alla chiave profile
- la validita dell account dipende anche dallo stato del profilo correlato

## 3. API Contract Summary

Base path: /backend/

### 3.1 Authentication APIs

| Endpoint | Metodo | Auth richiesta | Note |
|---|---|---|---|
| /login/ | POST | no | consente solo dominio @esnpolimi.it |
| /logout/ | POST | no | blacklist refresh se presente, cookie cleanup |
| /api/token/ | POST | no | token pair creation |
| /api/token/refresh/ | POST | no | refresh da cookie |
| /api/token/verify/ | POST | no | verifica token |
| /api/forgot-password/ | POST | no | risposta neutra anti user enumeration |
| /api/reset-password/<uid>/<token>/ | POST | no | reset con token signed |

### 3.2 User Management APIs

| Endpoint | Metodo | Permission |
|---|---|---|
| /users/ | GET | autenticato |
| /users/ | POST | users.add_user |
| /users/<pk>/ | GET | autenticato |
| /users/<pk>/ | PATCH | users.change_user |
| /users/<pk>/ | DELETE | solo Board |
| /groups/ | GET | autenticato |
| /users/finance-permissions/ | GET | autenticato |
| /users/finance-permissions/ | PATCH | Board |

## 4. Business Rules

### 4.1 Login Rules

1. dominio email obbligatorio: @esnpolimi.it
2. credenziali corrette obbligatorie
3. profile.email_is_verified deve essere true
4. risposta include token pair e metadati utente

### 4.2 Refresh Rules

1. refresh letto da cookie httpOnly
2. cookie mancante -> 400
3. token invalido/scaduto -> 401

### 4.3 Password Reset Rules

1. forgot-password non conferma mai se email esiste
2. reset richiede uid/token validi e password coerenti

## 5. Authorization and Effective Permissions

Permessi effettivi (effective) sono derivati da:

- appartenenza a gruppo (Board/Attivi/Aspiranti)
- flag custom utente

Regole endpoint finance-permissions:

1. PATCH consentito solo a Board
2. flag casse assegnabili solo ad Aspiranti
3. flag content assegnabile solo a profili ESNer
4. output GET espone raw + effective permissions

## 6. Security Notes

1. logout e resiliente: successo anche su token non black-listabile
2. refresh cookie gestito con attributi secure compatibili con ambiente
3. reset password basato su token signed e uid encoded

## 7. Frontend Integration Points

- AuthContext: login/logout/refresh
- ForgotPassword: trigger email reset
- ResetPassword: submit nuova password
- Profile/Settings: lettura e aggiornamento finance permissions

## 8. Operational Risks

1. differenze browser su cookie secure in locale
2. regressioni su permessi effective esposti al frontend
3. mismatch tra stato profile e stato user attivo

## 9. Testing Requirements

Test minimi obbligatori:

1. login matrix (dominio, verificato, credenziali)
2. refresh da cookie (ok/missing/expired)
3. permission matrix CRUD users
4. finance-permissions Board-only + vincoli gruppo
5. reset-password token invalidi e mismatch

Riferimenti test:

- backend/users/tests.py
- backend/users/test_integration.py

## 10. Canonical Source Files

Per analisi/verifica agenti AI usare come riferimento primario:

- backend/users/models.py
- backend/users/urls.py
- backend/users/views.py
- backend/users/serializers.py
- backend/users/managers.py

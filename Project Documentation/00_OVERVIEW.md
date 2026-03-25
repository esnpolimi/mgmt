# ESN Polimi Management - Technical System Overview

Questo documento e la vista architetturale di riferimento del progetto.
Scopo: fornire una baseline tecnica chiara per sviluppo, manutenzione, onboarding e automazione AI.

## 1. Product Scope

Il sistema copre i processi core ESN Polimi:

- gestione anagrafiche Erasmus ed ESNer
- onboarding con verifica email
- gestione eventi, liste, iscrizioni e form pubblici
- pagamenti e rimborsi (quota, cauzione, servizi)
- tesoreria (casse, transazioni, export)
- contenuti dinamici homepage
- registrazione WhatsApp pubblica con audit
- gestione stato manutenzione applicativa

## 2. Architecture Snapshot

### 2.1 Backend

- framework: Django + Django REST Framework
- autenticazione: JWT (SimpleJWT access/refresh)
- database: MySQL (dev/prod), SQLite (test)
- pattern: modular monolith per dominio applicativo

### 2.2 Frontend

- stack: React 19 + Vite + MUI
- routing: SPA con route protette
- API base URL:
  - local: http://localhost:8000/backend
  - prod: https://mgmt.esnpolimi.it/backend

### 2.3 External Integrations

- Google Drive API: upload file form + append CSV audit
- SumUp API: checkout, payment confirmation, webhook reconciliation
- SMTP: invio email operative/transazionali
- Sentry: error tracking in produzione
- OIDC provider: integrazione Dokuwiki

## 3. Domain Boundaries

| Modulo | Responsabilita | Dipendenze logiche |
|---|---|---|
| users | auth, gestione utenti e gruppi, permessi speciali | profiles |
| profiles | profili, documenti, verifica email, ricerca | users, events |
| events | eventi, liste, iscrizioni, form, pagamenti | profiles, treasury |
| treasury | casse, transazioni, ESNcard, rimborsi | profiles, events, users |
| content | contenuti homepage, WhatsApp config/register | users |
| maintenance | stato manutenzione e notifiche | - |

## 4. Authorization Model

### 4.1 Gruppi

- Board
- Attivi
- Aspiranti

### 4.2 Flag custom utente

- can_manage_casse
- can_view_casse_import
- can_manage_content

### 4.3 Regole globali

1. Board mantiene privilegi impliciti estesi su quasi tutti i moduli.
2. Attivi puo operare su aree treasury in base ai permessi endpoint.
3. Aspiranti richiede flag espliciti per funzioni extra.
4. Content manager e Board oppure can_manage_content=true.
5. Alcuni endpoint applicano object-level permissions (owner/staff/Board).

## 5. API Surface Map

Prefisso comune backend: /backend/

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
6. reimbursement flow (quota/cauzione/servizi): treasury + events
7. ESNcard issuance flow: treasury + profiles
8. WhatsApp public registration flow: content + email + drive

Dettagli operativi nei documenti modulo 01-06.

## 7. Configuration and Environments

Settings principali:

- backend/settings/base.py
- backend/settings/dev.py
- backend/settings/prod.py
- backend/settings/test.py

Variabili sensibili principali:

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

- logging backend su file in produzione
- audit middleware per context DB/action
- Sentry con tracing configurabile
- maintenance notification persistita in maintenance_notification.json

## 9. Technical Constraints and Invariants

1. Coerenza saldo account deve essere preservata su create/update/delete transazioni.
2. Pagamenti online e webhook devono essere trattati in modo idempotente.
3. Vincoli permessi non devono essere bypassati lato API.
4. I campi dinamici evento devono rispettare schema JSON previsto.
5. I flussi esterni senza profile (iscritti esterni) devono essere sempre gestiti nei rimborsi.

## 10. AI/Automation Notes

1. Verificare sempre urls.py per endpoint effettivi e non assumere naming legacy.
2. Per pagamenti usare insieme logica events e treasury.
3. Non assumere che Subscription.profile sia sempre valorizzato.
4. In content, Board e can_manage_content sono le sole condizioni di gestione.

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

Questa sezione indica i file da trattare come source of truth quando un agente deve verificare comportamento reale.

- backend routing root: backend/backend/urls.py
- users: backend/users/urls.py, backend/users/views.py, backend/users/serializers.py
- profiles: backend/profiles/urls.py, backend/profiles/views.py, backend/profiles/serializers.py
- events: backend/events/urls.py, backend/events/views.py, backend/events/serializers.py
- treasury: backend/treasury/urls.py, backend/treasury/views.py, backend/treasury/serializers.py
- content: backend/content/urls.py, backend/content/views.py, backend/content/serializers.py
- maintenance: backend/maintenance/urls.py, backend/maintenance/views.py

## 13. AI Reference Usage Rules

Regole operative per agenti AI:

1. Usare questi documenti come baseline funzionale, non come sostituto del codice.
2. In caso di mismatch documentazione-codice, prevale il comportamento osservabile nei file canonici.
3. Prima di modifiche su pagamenti/rimborsi, verificare sempre sia events che treasury.
4. Prima di modifiche su autorizzazioni, verificare sia permessi Django sia flag custom utente.
5. Non assumere invarianti non esplicitate nei documenti o non verificabili nel codice.

## 14. Documentation Completeness Notes

Copertura attuale:

- moduli core users, profiles, events, treasury, content: dettagliati
- modulo maintenance: dettagliato
- integrazione E2E: baseline presente
- coverage qualitativa: presente

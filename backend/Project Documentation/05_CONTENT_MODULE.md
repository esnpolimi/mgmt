# 05 - Content Module

## 1. Module Purpose

Il modulo content governa i contenuti dinamici della home e il workflow pubblico WhatsApp.

Responsabilita:

- gestione sezioni editoriali e link ordinati
- enforcement autorizzativo content manager
- configurazione centralizzata link WhatsApp
- registrazione pubblica con validazione, email e audit CSV su Drive

## 2. Domain Model

### 2.1 ContentSection

Attributi principali:

- title (enum, unique): LINK_UTILI | WIKI_TUTORIAL
- order
- is_active
- created_by, created_at, updated_at

### 2.2 ContentLink

Attributi principali:

- section (FK)
- name
- description
- url
- color
- order
- created_by, created_at, updated_at

### 2.3 WhatsAppConfig

Configurazione singleton (pk=1):

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

### 3.2 Links APIs

- GET /links/
- POST /links/
- PATCH /links/<id>/
- DELETE /links/<id>/

### 3.3 WhatsApp APIs

- GET|PATCH /whatsapp-config/
- POST /whatsapp-register/

## 4. Permission Model

Guard centrale: _can_manage_content(user)

Condizioni true:

- user in Board
- user.can_manage_content

Policy endpoint:

1. sections/links GET: autenticati.
2. sections/links POST/PATCH/DELETE: content manager.
3. whatsapp-config GET: autenticati.
4. whatsapp-config PATCH: content manager.
5. whatsapp-register POST: pubblico (AllowAny).

## 5. Core Business Flows

### 5.1 Editorial CRUD Flow

1. manager crea/aggiorna sezione o link
2. ordinamento applicato via campo order
3. is_active governa esposizione lato home
4. audit metadata mantiene tracciabilita modifica

### 5.2 Public WhatsApp Registration

Input richiesto:

- first_name
- last_name
- email
- is_international
- home_university
- course_of_study

Sequenza:

1. validazione serializer
2. applicazione regole ammissibilita (international/erasmus)
3. verifica presenza whatsapp_link configurato
4. invio email con link gruppo
5. append audit CSV su Google Drive con timestamp/esito

CSV target: cronologia richieste gruppo whatsapp.csv.

## 6. Integration Notes

- home frontend: rendering sezioni attive e links ordinati
- content manager frontend: amministrazione completa contenuti/config
- servizi esterni: SMTP per invio email, Drive API per audit trail

## 7. Operational Constraints

1. active_sections filtrate server-side.
2. append CSV protetto da lock in-process per ridurre collisioni.
3. errori email/Drive devono essere tracciati e osservabili.

## 8. Operational Risks

1. inconsistenza configurazione singleton WhatsApp in ambienti multipli
2. lock locale non sufficiente in deployment multi-process
3. regressioni su policy di accesso content manager
4. error handling esterno (SMTP/Drive) non uniforme

## 9. Testing Requirements

1. permission matrix Board, can_manage_content, utente standard
2. validazioni ContentLink (url/color/name/order)
3. percorso whatsapp-register ammesso e non ammesso
4. failure path email e append CSV
5. verifica active_sections solo su contenuti attivi

Riferimento test: backend/content/tests.py.

## 10. Canonical Source Files

Per analisi/verifica agenti AI usare come riferimento primario:

- backend/content/models.py
- backend/content/urls.py
- backend/content/views.py
- backend/content/serializers.py

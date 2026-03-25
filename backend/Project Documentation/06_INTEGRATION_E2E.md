# 06 - Integration & E2E

## 1. Document Purpose

Questa specifica definisce i flussi cross-modulo che rappresentano la baseline di accettazione funzionale.

Scope:

- users
- profiles
- events
- treasury
- content
- maintenance

## 2. End-to-End Critical Scenarios

### 2.1 Scenario A - ESNer onboarding completo

Precondizioni:

- email dominio istituzionale valida
- endpoint verifica email operativo

Sequenza:

1. POST profile/initiate-creation con is_esner=true
2. GET verify-email con uid/token validi
3. POST login
4. accesso endpoint protetti
5. verifica gruppo iniziale e stato attivazione

Oracoli di test:

- utente attivo
- profile coerente con ruolo iniziale
- token lifecycle valido

### 2.2 Scenario B - Erasmus onboarding + public form

Precondizioni:

- evento con form attivo

Sequenza:

1. registrazione erasmus e verifica email
2. lettura form pubblico
3. submit payload valido
4. creazione subscription in form list
5. invio conferma email

Oracoli di test:

- persistenza dati form/additional
- stato subscription corretto

### 2.3 Scenario C - SumUp payment reconciliation

Precondizioni:

- allow_online_payment=true

Sequenza:

1. formsubmit genera checkout_id
2. process_payment o webhook conferma stato paid
3. creazione transazioni locali (quota/cauzione/servizi)
4. riallineamento payment status subscription

Oracoli di test:

- idempotenza su webhook duplicati
- assenza doppia contabilizzazione

### 2.4 Scenario D - Reimbursements (deposit/quota/services)

Precondizioni:

- pagamenti originari esistenti

Sequenza:

1. chiamata reimburse_deposits o reimburse_quota
2. generazione transazioni rimborso
3. aggiornamento saldo account
4. blocco tentativo doppio rimborso

Oracoli di test:

- vincoli anti-duplicato rispettati
- gestione esterni senza profile preservata

### 2.5 Scenario E - ESNcard emission + accounting

Sequenza:

1. emissione card su profilo valido
2. calcolo fee corretta per caso d'uso
3. creazione transazione esncard
4. verifica balance account

Oracoli di test:

- fee policy corretta
- consistenza ledger

### 2.6 Scenario F - Content + WhatsApp public workflow

Sequenza:

1. manager aggiorna whatsapp-config
2. utente pubblico invia whatsapp-register
3. invio email link
4. append audit CSV su Drive

Oracoli di test:

- policy accesso rispettata
- audit trail presente

### 2.7 Scenario G - Maintenance notification

Sequenza:

1. admin trigger notifica
2. client autenticati leggono maintenance/status
3. banner frontend visibile
4. clear notifica

Oracoli di test:

- propagazione stato corretta
- reset notifica coerente

## 3. Test Asset Mapping

Suite integrazione dedicate:

- backend/test_integration_e2e.py
- backend/users/test_integration.py

Supporto cross-domain da suite modulo:

- backend/events/tests.py
- backend/treasury/tests.py
- backend/profiles/tests.py
- backend/content/tests.py

## 4. Release Regression Gate

Checklist minima per ogni release:

1. login, refresh, logout
2. registrazione e verifica ESNer/Erasmus
3. creazione evento + liste principali
4. iscrizione office e public form
5. pagamento SumUp + webhook idempotente
6. rimborsi quota/cauzione/servizi
7. emissione ESNcard
8. export transazioni
9. CRUD content home
10. whatsapp register end-to-end

## 5. Cross-Module Risk Register

1. disallineamento pagamento tra events e treasury
2. race su update balance account
3. webhook non ordinati o duplicati
4. mismatch autorizzazioni backend/frontend
5. regressioni su flussi external subscriptions

## 6. Test Strategy Guidelines

1. unit test per regole locali e permessi
2. integration API test per side-effect DB
3. E2E sintetici su mission-critical flow
4. mock deterministic per SumUp, Drive, SMTP

## 7. Acceptance Baseline

Uno scenario E2E e considerato accettato solo se:

1. stato finale persistito e verificabile
2. side-effect esterni tracciati (email/webhook/export)
3. invarianti contabili/autorizzative rispettate
4. assenza di duplicazioni in operazioni idempotenti

## 8. Traceability Map (Scenario -> Test Assets)

Mappatura di riferimento per troubleshooting rapido agent-driven:

- Scenario A: backend/users/test_integration.py, backend/profiles/tests.py
- Scenario B: backend/profiles/tests.py, backend/events/tests.py
- Scenario C: backend/events/tests.py, backend/treasury/tests.py
- Scenario D: backend/treasury/tests.py, backend/events/tests.py
- Scenario E: backend/treasury/tests.py, backend/profiles/tests.py
- Scenario F: backend/content/tests.py
- Scenario G: backend/maintenance/views.py (comportamento), backend/test_integration_e2e.py

Nota: la mappa indica i test principali da consultare; non implica copertura esaustiva di ogni edge case.

Riferimento documentale scenario G:

- 07_MAINTENANCE_MODULE.md

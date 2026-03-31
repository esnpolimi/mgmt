# 04 - Treasury Module

## 1. Module Purpose

Il modulo treasury gestisce la contabilita applicativa e le regole finanziarie:

- casse (Account) e visibilita per gruppi
- ledger transazioni con aggiornamento saldo
- emissione/modifica ESNcard con fee parametrica
- workflow richieste rimborso
- rimborsi automatici su flussi evento (quota/cauzione/servizi)
- export transazioni per reporting operativo

## 2. Domain Model

### 2.1 Settings

Parametri economici configurabili:

- esncard_release_fee
- esncard_lost_fee

### 2.2 ESNcard

Attributi principali:

- profile
- number (unique)
- expiration (calcolata)
- membership_year (derivata)

### 2.3 Account

Attributi principali:

- name (unique)
- status: open|closed
- balance
- changed_by
- visible_to_groups

### 2.4 Transaction

Tipi operativi:

- subscription
- esncard
- deposit
- withdrawal
- reimbursement
- cauzione
- rimborso_cauzione
- rimborso_quota
- service
- rimborso_service

Invarianti contabili:

1. create/update/delete transazione riallinea sempre balance account.
2. account closed non accetta nuove operazioni mutative.
3. per tipi vincolati, saldo negativo bloccato.

### 2.5 ReimbursementRequest

Attributi:

- user
- amount
- payment (cash/paypal/bonifico)
- description
- receipt_link
- account
- reimbursement_transaction

## 3. API Contract Summary

Base path: /backend/

### 3.1 ESNcard APIs

- POST /esncard_emission/
- PATCH /esncard/<pk>/
- GET /esncard_fees/

### 3.2 Transaction APIs

- POST /transaction/
- GET /transactions/
- GET|PATCH|DELETE /transaction/<pk>/
- GET /transactions_export/

### 3.3 Account APIs

- GET /accounts/
- POST /account/
- GET|PATCH /account/<pk>/

### 3.4 Reimbursement APIs

- POST /reimbursement_request/
- GET /reimbursement_requests/
- GET|PATCH|DELETE /reimbursement_request/<pk>/
- GET /reimbursable_deposits/
- POST /reimburse_deposits/
- POST /reimburse_quota/

## 4. Permission Model

Regole principali:

1. creazione account: Board.
2. patch completo account: change_account.
3. update status account: anche casse manager (gruppo/flag).
4. create transaction: add_transaction.
5. patch/delete transaction: permessi specifici o can_manage_casse.
6. patch reimbursement request: Board.
7. delete reimbursement request: Board o permesso dedicato.

Visibilita account:

- account visibile se utente appartiene a visible_to_groups
- oppure se account non ha gruppi associati

## 5. Core Business Flows

### 5.1 ESNcard Emission

1. validazione profilo e prerequisiti emissione
2. calcolo fee corretta (rilascio/smarrimento/rinnovo)
3. creazione ESNcard
4. registrazione transaction esncard su account

### 5.2 Manual Transactions

1. creazione deposit/withdrawal
2. validazione account e saldo
3. eventuale upload ricevuta
4. notifica operativa in ambienti non localhost

### 5.3 Reimbursement Request Lifecycle

1. utente apre richiesta rimborso
2. Board valuta e aggiorna stato/dati
3. creazione transazione rimborso collegata
4. riallineamento saldo account

### 5.4 Event Reimbursements

Depositi:

1. input bulk subscription_ids
2. verifica transazione cauzione originaria
3. blocco duplicati rimborso_cauzione
4. supporto iscritti esterni senza profile

Quota/servizi:

1. verifica pagamenti originari
2. blocco doppio rimborso
3. rimborso opzionale servizi associati
4. controllo saldo account disponibile

Orchestrazione UI unificata (single icon):

1. il frontend puo selezionare piu voci (quota/servizi/cauzione) in una singola azione utente
2. lato backend restano endpoint separati (reimburse_quota, reimburse_deposits)
3. il flusso non e atomico cross-endpoint: possibili successi parziali
4. in caso di successo parziale, ogni voce mantiene il proprio stato e puo essere ritentata
5. motivazione errore per singola voce propagata al client per retry guidato

## 6. Query, Filters and Export

transactions list supporta:

- search
- event
- account multipli
- type multipli
- dateFrom/dateTo
- limit per dashboard

transactions_export produce XLSX con metadati contabili e descrizioni operative.

## 7. Cross-Module Dependencies

- events: source of truth per Subscription/Event usati nei rimborsi
- profiles/users: identita attore e ownership richieste
- notification/email: avvisi operativi su operazioni sensibili

## 8. Operational Risks

1. race su aggiornamento balance in operazioni concorrenti
2. disallineamento transazioni evento/treasury in caso errori parziali
3. regressioni su edge case iscritti esterni senza profile
4. policy account visibility non allineata con gruppi runtime

## 9. Testing Requirements

1. coerenza balance su create/update/delete transaction
2. blocco operazioni su account chiuso
3. permission matrix Board/Attivi/Aspiranti con flag speciali
4. rimborsi quota/cauzione/servizi incluse condizioni duplicate
5. gestione esterni senza profile nei rimborsi deposito
6. export con filtri combinati e dataset non banali

Riferimento test: backend/treasury/tests.py.

## 10. Canonical Source Files

Per analisi/verifica agenti AI usare come riferimento primario:

- backend/treasury/models.py
- backend/treasury/urls.py
- backend/treasury/views.py
- backend/treasury/serializers.py

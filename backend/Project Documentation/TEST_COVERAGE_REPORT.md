# Test Coverage Report - ESN Polimi Management

Data ultimo aggiornamento: 2026-03-25  
Ambito: backend Django (users, profiles, events, treasury, content)

## 1. Quality Scope

Questo report descrive la copertura test a livello funzionale e i rischi residui.

Nota metodologica:

- i conteggi rappresentano numero di funzioni test_, non line coverage percentuale
- il dato misura ampiezza della suite, non profondita per ramo logico

## 2. Test Inventory

| File test | Numero funzioni test_ |
|---|---:|
| backend/users/tests.py | 40 |
| backend/users/test_integration.py | 14 |
| backend/profiles/tests.py | 70 |
| backend/events/tests.py | 111 |
| backend/treasury/tests.py | 76 |
| backend/content/tests.py | 43 |
| backend/test_integration_e2e.py | 6 |
| Totale | 360 |

## 3. Functional Coverage Matrix

### 3.1 Users

- autenticazione JWT (login/refresh/logout)
- reset e forgot password
- CRUD utenti e gruppi
- gestione permessi applicativi speciali

### 3.2 Profiles

- onboarding Erasmus/ESNer
- verifica email automatica e verifica manuale Board
- CRUD profili e documenti
- ricerca e filtri
- endpoint di supporto per eventi/iscrizioni

### 3.3 Events

- CRUD eventi/liste
- iscrizioni office e public form
- schema campi dinamici e additional fields
- servizi opzionali con pricing
- flussi SumUp (checkout/process/webhook)
- shared lists e move subscriptions
- liberatorie e utilities organizzative

### 3.4 Treasury

- CRUD account e visibilita per gruppi
- CRUD transazioni con impatto su balance
- emissione ESNcard e fee policy
- reimbursement request lifecycle
- rimborsi deposito/quota/servizi
- export XLSX

### 3.5 Content

- CRUD sezioni e link
- policy content manager (Board o can_manage_content)
- configurazione WhatsApp singleton
- workflow pubblico whatsapp-register con email e audit CSV Drive

### 3.6 E2E Integration

- test multi-modulo in backend/test_integration_e2e.py
- copertura flussi critici onboarding/eventi/pagamenti/rimborsi

## 4. Residual Risk Register

1. Concorrenza treasury: race su update simultanei di balance.
2. Scalabilita: dataset grandi su events/transactions/reimbursements.
3. Sicurezza webhook/token: replay, ordering, scadenza, abuse rate.
4. Contratti frontend-backend: drift payload su form pubblici/pagamenti.

## 5. Recommended Test Enhancements

1. Aggiungere test di concorrenza per transazioni contabili.
2. Introdurre contract test espliciti per endpoint pubblici.
3. Rafforzare test idempotenza webhook con eventi duplicati/disordinati.
4. Aggiungere smoke E2E automatizzati su gate release.

## 6. Execution Commands

Esecuzione completa:

```bash
python manage.py test
```

Per modulo:

```bash
python manage.py test users
python manage.py test profiles
python manage.py test events
python manage.py test treasury
python manage.py test content
python manage.py test test_integration_e2e
```

Esecuzione con test settings:

```bash
DJANGO_SETTINGS_MODULE=backend.settings.test python manage.py test
```

## 7. Maintenance Policy

1. Ogni bug fix deve includere almeno un test di regressione.
2. Ogni nuova API deve includere permessi, validazione, happy path, error path.
3. Flussi finanziari devono includere controlli su balance e idempotenza.
4. Questo report va aggiornato a ogni modifica significativa della suite test.

## 8. AI Agent Interpretation Notes

Regole per uso corretto del report da parte di agenti AI:

1. Non usare il numero totale test come metrica unica di qualita.
2. Per cambi ad alto rischio consultare prima 06_INTEGRATION_E2E.md.
3. Validare sempre i gap residui rispetto al cambiamento richiesto.
4. In caso di mismatch tra report e suite reale, prevale l esecuzione test corrente.

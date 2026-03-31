# 03 - Events Module

## 1. Module Purpose

Il modulo events e il cuore operativo per gestione eventi, liste e iscrizioni.

Responsabilita:

- CRUD evento e metadati
- gestione EventList e capacity pooling
- iscrizioni office e public form
- campi dinamici (form/additional)
- integrazione pagamenti SumUp
- sincronizzazione stato pagamento con treasury
- strumenti organizzativi (move, liberatorie, liste condivise)

## 2. Domain Model

### 2.1 Event

Attributi business principali:

- identificativi: name, date, description
- pricing: cost, deposit
- finestra iscrizione: subscription_start_date, subscription_end_date
- form: enable_form, form_programmed_open_time, form_note
- online payment toggle: allow_online_payment
- configurazione dinamica: fields, profile_fields, services
- governance: notify_list, visible_to_board_only, reimbursements_by_organizers_only

### 2.2 EventList

Relazione many-to-many con Event tramite EventListEvent.

Attributi:

- name
- capacity (0 = unlimited)
- display_order
- is_main_list
- is_waiting_list

Computed metrics:

- subscription_count
- available_capacity

### 2.3 Subscription

Attributi:

- profile (nullable) e campi external_* per iscritti esterni
- event, list
- form_data, additional_data
- selected_services
- created_by_form
- sumup_checkout_id, sumup_transaction_id

Vincolo: unique(profile, event).

## 3. API Contract Summary

Base path: /backend/

### 3.1 Event APIs

- GET /events/
- POST /event/
- GET|PATCH|DELETE /event/<pk>/

### 3.2 Subscription APIs

- POST /subscription/
- GET|PATCH|DELETE /subscription/<pk>/
- POST /move-subscriptions/

### 3.3 Public Form APIs

- GET /event/<event_id>/form/
- GET /event/<event_id>/formstatus/
- POST /event/<event_id>/formsubmit/

### 3.4 Payment APIs

- GET /subscription/<pk>/status/
- POST /subscription/<pk>/process_payment/
- POST /sumup/webhook/

### 3.5 Organizer Utilities

- GET /event/<event_id>/printable_liberatorie/
- POST /generate_liberatorie_pdf/
- POST /link-lists/
- GET /available-for-sharing/
- PATCH /subscription/<pk>/edit_formfields/

## 4. Permission Model

Core mapping:

- view_event
- add_event
- change_event
- delete_event
- view_subscription
- add_subscription
- change_subscription
- delete_subscription

Regole aggiuntive:

1. printable/generate liberatorie: Board o lead organizer.
2. visible_to_board_only: visibilita ristretta a Board.
3. reimbursements_by_organizers_only: rimborsi limitati a organizer/Board.

## 5. Core Business Flows

### 5.1 Office Subscription Flow

1. validazione finestra iscrizione
2. check duplicati profile/event o external_name/event
3. validazione selected_services contro catalogo evento
4. persistenza subscription
5. sync transazioni quota/cauzione/servizi

### 5.2 Public Form Flow

1. caricamento schema fields da Event
2. validazione dinamica payload
3. upload eventuali file (field type l) su Drive
4. inserimento in form list
5. invio email conferma
6. eventuale innesco checkout online

### 5.3 Online Payment Reconciliation

1. process_payment interroga stato checkout
2. webhook conferma asincrona server-server
3. creazione transazioni idempotente
4. allineamento stato subscription

### 5.4 Unified Refund UI Flow (Single Icon)

Per ogni subscription in lista e disponibile una singola azione "Rimborsa".

Comportamento:

1. apertura menu/modal con selezione voci rimborsabili
2. voci disponibili: quota, servizi aggiuntivi, cauzione
3. checkbox disabilitata se voce gia rimborsata o non pagata
4. icona disabilitata se nessuna voce e rimborsabile
5. submit con orchestrazione frontend su endpoint esistenti
6. gestione esiti parziali con stato per singola voce (OK/Errore)

Nota operativa:

- il flusso combinato usa chiamate separate a reimburse_quota e reimburse_deposits
- in caso di errore parziale, le voci riuscite restano confermate e le fallite sono ripetibili
- con logica backend attuale, "solo servizi" e consentito solo se quota gia rimborsata

## 6. Dynamic Field Schema

Event.fields contiene due blocchi logici:

- form
- additional

Tipologie supportate:

- t, n, c, m, s, b, d, e, p, l

Event.services definisce catalogo servizi opzionali con pricing.

## 7. Shared Lists Model

Una lista puo essere condivisa tra eventi multipli.

Invarianti:

1. capacity della lista e pool unica cross-event
2. move-subscriptions puo cambiare list e event contestualmente
3. il vincolo unique(profile,event) deve restare valido dopo move

## 8. Integration Notes

- profiles: risoluzione utente e metadati anagrafici
- treasury: transazioni pagamento/rimborso
- content: superfici pubbliche di comunicazione evento

## 9. Operational Risks

1. webhook duplicati/non ordinati
2. inconsistenza stato pagamento events vs treasury
3. gestione incompleta iscritti esterni nei flussi downstream
4. regressioni su validazione schema dinamico

## 10. Testing Requirements

1. permission matrix eventi e iscrizioni
2. validazione schema fields/services
3. idempotenza process_payment + webhook
4. integrita move-subscriptions con shared list
5. sync transazioni su update subscription
6. upload file form e fallback error handling
7. rimborso unificato: disable coerente icona/checkbox e validazioni selezione
8. rimborso parziale: messaggi errore per voce fallita e retry selettivo

Riferimento test: backend/events/tests.py.

## 11. Canonical Source Files

Per analisi/verifica agenti AI usare come riferimento primario:

- backend/events/models.py
- backend/events/urls.py
- backend/events/views.py
- backend/events/serializers.py

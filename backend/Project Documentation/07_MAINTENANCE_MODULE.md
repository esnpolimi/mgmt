# 07 - Maintenance Module

## 1. Module Purpose

Il modulo maintenance gestisce la notifica di manutenzione applicativa verso client autenticati.

Responsabilita:

- esposizione stato manutenzione corrente
- push eventi tramite SSE con connessioni controllate
- trigger e clear notifica via pagina admin staff-only
- persistenza stato notifica su file JSON condiviso

## 2. Domain Model

Il modulo non usa modelli Django dedicati.

Stato applicativo persistito in file:

- backend/maintenance_notification.json

Schema payload:

- notification_id (UUID o null)
- message (string)
- triggered_at (ISO datetime o null)

Invarianti:

1. notification_id null indica assenza notifica attiva.
2. message mantiene default operativo se non specificato.
3. triggered_at e valorizzato solo quando notifica e attiva.

## 3. API Contract Summary

Base path: /backend/

### 3.1 Streaming API

- GET /maintenance/stream/

Comportamento:

- richiede token JWT access in query param token
- ritorna HTTP 403 se token assente o invalido
- invia evento maintenance quando notification_id cambia
- invia heartbeat periodico per mantenere connessione viva
- auto-rotate connessione dopo finestra temporale per riciclo worker

### 3.2 Polling API

- GET /maintenance/status/

Comportamento:

- richiede autenticazione (IsAuthenticated)
- ritorna stato corrente notifica (notification_id, message, triggered_at)

### 3.3 Admin Action Endpoint

- GET|POST /admin/maintenance-notify/

Comportamento:

- accessibile solo a staff member
- action=send: crea nuova notifica con UUID e timestamp
- action=clear: resetta stato a notifica assente

## 4. Permission Model

Regole principali:

1. maintenance stream richiede token JWT valido.
2. maintenance status richiede utente autenticato.
3. maintenance admin page richiede staff_member_required.
4. trigger/clear sono disponibili solo da interfaccia admin autorizzata.

## 5. Core Business Flows

### 5.1 Trigger Maintenance Notification

1. staff apre pagina admin maintenance
2. invia action send
3. backend genera notification_id e triggered_at
4. stato scritto su maintenance_notification.json
5. client SSE rilevano cambio e ricevono evento maintenance

### 5.2 Clear Maintenance Notification

1. staff invia action clear
2. backend resetta payload a notification_id null
3. stato aggiornato su maintenance_notification.json
4. client polling/SSE non ricevono piu stato attivo

### 5.3 Client Consumption Flow

1. client autenticato legge stato da /maintenance/status/
2. opzionalmente apre EventSource su /maintenance/stream/?token=<jwt>
3. su evento maintenance mostra banner/notifica UI
4. su clear rimuove banner

## 6. Operational Constraints

1. persistenza file-based: dipende da accesso filesystem locale condiviso.
2. SSE su WSGI: connessioni lunghe controllate con timeout/riciclo.
3. autenticazione stream via query param necessaria per limiti EventSource headers.
4. heartbeats necessari per prevenire idle timeout infrastrutturali.

## 7. Operational Risks

1. race condition su scrittura file in ambienti multi-process.
2. mismatch stato tra istanze se storage non condiviso.
3. token esposto in query string nei log infrastrutturali.
4. saturazione worker se stream non limitato/correttamente riciclato.

## 8. Testing Requirements

1. stream senza token ritorna 403.
2. stream con token invalido/scaduto ritorna 403.
3. status richiede autenticazione e ritorna payload completo.
4. action send crea notification_id e triggered_at.
5. action clear resetta notification_id e triggered_at.
6. verifica emissione evento maintenance su cambio notification_id.

## 9. Canonical Source Files

Per analisi/verifica agenti AI usare come riferimento primario:

- backend/maintenance/urls.py
- backend/maintenance/views.py
- backend/backend/urls.py
- backend/maintenance_notification.json

# 02 - Profiles Module

## 1. Module Purpose

Il modulo profiles gestisce il lifecycle anagrafico e documentale di Erasmus/ESNer.

Responsabilita:

- registrazione iniziale profilo
- verifica email automatica e manuale
- gestione documenti identificativi
- ricerca e listing amministrativo
- esposizione dati profilo per moduli events/treasury

## 2. Domain Model

### 2.1 Profile

Campi funzionali principali:

- identificazione: email (unique), is_esner
- stato: email_is_verified, enabled
- anagrafica: name, surname, birthdate, country, course, domicile
- contatti: phone_*, whatsapp_*
- identificativi: person_code, matricola_number, matricola_expiration

Computed properties:

- latest_esncard
- latest_document

### 2.2 Document

- relazione: FK su Profile
- tipo documento: enum (Passport, ID Card, Driving License, Residency Permit, Other)
- number unique globale
- expiration
- enabled

## 3. API Contract Summary

Base path: /backend/

### 3.1 Listing and Search

| Endpoint | Metodo | Note |
|---|---|---|
| /erasmus_profiles/ | GET | listing paginato profili non ESNer |
| /esner_profiles/ | GET | listing paginato profili ESNer |
| /profiles/search/ | GET | ricerca multi-token cross-field |

Filtri principali:

- page, page_size, ordering, search
- group (solo esner_profiles)
- esncardValidity = valid|expired|absent

### 3.2 Creation and Verification

| Endpoint | Metodo | Auth |
|---|---|---|
| /profile/initiate-creation/ | POST | pubblico |
| /api/profile/verify-email/<uid>/<token>/ | GET | pubblico |
| /profile/<pk>/manual-verify-email/ | POST | Board |

### 3.3 Detail and Related Data

| Endpoint | Metodo | Auth |
|---|---|---|
| /profile/<pk>/ | GET/PATCH/DELETE | autenticato + permessi |
| /document/ | POST | autenticato |
| /document/<pk>/ | PATCH/DELETE | autenticato + permessi |
| /profile_subscriptions/<pk>/ | GET | object-level protected |
| /profile_events/<pk>/ | GET | autenticato |
| /check_erasmus_email/ | POST | pubblico |

## 4. Lifecycle Flows

### 4.1 Erasmus Registration Flow

1. initiate-creation crea profile/document disabled
2. invio email verifica
3. verify-email abilita profile/document

### 4.2 ESNer Registration Flow

1. dominio email obbligatorio @esnpolimi.it
2. creazione User correlato in gruppo Aspiranti
3. verify-email abilita profile/document/user
4. invio notifica segreteria post-verifica

### 4.3 Manual Verification

Board puo forzare verifica/attivazione profilo per casi eccezionali.

## 5. Authorization Rules

### 5.1 Profile Permissions

- listing: autenticazione richiesta
- patch profile: profiles.change_profile
- delete profile: solo Board
- delete bloccato se esistono Subscription collegate

### 5.2 Group Transition Constraints

1. Aspiranti -> Attivi/Board: solo Board
2. Attivi -> Board: solo Board
3. altre transizioni secondo validazione richiesta

### 5.3 Document Permissions

- patch: profiles.change_document
- delete: profiles.delete_document

### 5.4 Object-Level Access

profile_subscriptions accessibile solo a:

- owner
- staff
- Board

## 6. Search Semantics

Ricerca profili combinata su:

- name, surname, email
- document number
- esncard number
- phone/whatsapp

Filtro esncardValidity basato su valutazione latest_esncard.

## 7. Integration Notes

- users: creazione/attivazione account ESNer
- events: risoluzione profilo per iscrizioni e visibilita dati
- treasury: lookup latest_esncard per validita servizi/card

## 8. Operational Risks

1. stati non allineati profile/document/user in flussi di attivazione
2. regressioni su regole promozione gruppi
3. cancellazione profilo con dipendenze evento non intercettata

## 9. Testing Requirements

1. registration matrix Erasmus vs ESNer
2. token verification valid/invalid/expired
3. permission matrix profile/document CRUD
4. group transition constraints
5. object-level access profile_subscriptions

Riferimento test: backend/profiles/tests.py.

## 10. Canonical Source Files

Per analisi/verifica agenti AI usare come riferimento primario:

- backend/profiles/models.py
- backend/profiles/urls.py
- backend/profiles/views.py
- backend/profiles/serializers.py

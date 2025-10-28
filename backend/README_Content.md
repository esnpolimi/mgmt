# Sistema di Gestione Contenuti Dinamici

## Descrizione

Questo modulo permette di gestire dinamicamente i contenuti della home page attraverso un'interfaccia di amministrazione. Il sistema è progettato per gestire due categorie fisse di contenuti: **LINK UTILI** e **WIKI E TUTORIAL**.

## Caratteristiche Principali

- **Due categorie predefinite**: LINK UTILI e WIKI E TUTORIAL
- **Campi obbligatori per ogni link**: Titolo, Descrizione, URL e Colore
- **Gestione completa dal pannello admin**: Solo membri Board possono modificare
- **Tutti i link vengono letti dal database**: Nessun contenuto hardcoded

## Struttura

### Backend (`backend/content/`)

- **models.py**: Definisce i modelli `ContentSection` e `ContentLink`
  - `ContentSection`: Sezione di contenuti (es: "LINK UTILI")
  - `ContentLink`: Singolo link all'interno di una sezione

- **serializers.py**: Serializer REST per le API
- **views.py**: ViewSet con permessi (solo Board può modificare)
- **urls.py**: Route API per gestione contenuti
- **admin.py**: Interfaccia Django Admin

### Frontend

- **Pages/ContentManager.jsx**: Pagina di amministrazione per gestire sezioni e link
- **Pages/Home.jsx**: Pagina home aggiornata per leggere contenuti dinamici
- **Components/ProtectedRoute.jsx**: Aggiornato per supportare `requiredGroup`

## API Endpoints

```
GET    /backend/content/sections/              - Lista sezioni
GET    /backend/content/sections/active_sections/  - Sezioni attive con link
POST   /backend/content/sections/              - Crea sezione (solo Board)
PATCH  /backend/content/sections/{id}/         - Modifica sezione (solo Board)
DELETE /backend/content/sections/{id}/         - Elimina sezione (solo Board)

GET    /backend/content/links/                 - Lista link
POST   /backend/content/links/                 - Crea link (solo Board)
PATCH  /backend/content/links/{id}/            - Modifica link (solo Board)
DELETE /backend/content/links/{id}/            - Elimina link (solo Board)
```

## Permessi

- **Lettura**: Tutti gli utenti autenticati
- **Modifica**: Solo membri del Board

## Setup e Migrazione

1. **Eseguire le migrazioni**:
```bash
cd backend
python manage.py migrate
```

2. **Popolare il database con i dati iniziali**:
```bash
python manage.py populate_content
```

Questo comando creerà automaticamente le due sezioni (LINK UTILI e WIKI E TUTORIAL) e popolerà i link iniziali.

## Modelli

### ContentSection
- `title`: Categoria (LINK_UTILI o WIKI_TUTORIAL) - **Campo unico**
- `order`: Ordine di visualizzazione
- `is_active`: Flag per attivare/disattivare
- `created_by`: Utente creatore
- `created_at`/`updated_at`: Timestamp

**Nota**: Le sezioni sono fisse, solo due categorie possibili.

### ContentLink
- `section`: ForeignKey a ContentSection
- `name`: Titolo del link - **Obbligatorio**
- `description`: Descrizione del link - **Obbligatorio**
- `url`: URL del link - **Obbligatorio**
- `color`: Colore esadecimale (es: #1976d2) - **Obbligatorio**
- `order`: Ordine all'interno della sezione
- `is_active`: Flag per attivare/disattivare
- `created_by`: Utente creatore
- `created_at`/`updated_at`: Timestamp

**Tutti i campi name, description, url e color sono obbligatori.**

## Azioni Speciali

~~Per link che devono eseguire azioni custom (come aprire modali), impostare il campo `action_type`~~

**Rimosso**: Il campo `action_type` è stato rimosso. Tutti i link ora sono link standard che aprono URL.

## Fallback

~~Se il caricamento dei contenuti dinamici fallisce, la home page usa automaticamente i contenuti statici hardcoded come fallback.~~

**Aggiornato**: Tutti i contenuti ora vengono caricati dal database. Non ci sono più contenuti statici di fallback. In caso di errore, viene mostrato un messaggio di errore all'utente.

## Accesso alla Pagina di Gestione

La pagina di gestione contenuti è accessibile solo ai membri del Board tramite:
- Menu laterale: "Gestione Contenuti"
- URL diretto: `/content-manager`

## Funzionalità della Pagina di Gestione

### Sezioni
- **Due sezioni fisse**: LINK UTILI e WIKI E TUTORIAL
- Solo visualizzazione, non si possono creare/eliminare sezioni
- Ogni sezione mostra il numero di link contenuti

### Link
- Aggiunta link a una sezione
- **Campi obbligatori**:
  - **Titolo**: Nome del link
  - **Descrizione**: Testo descrittivo del link
  - **Link/URL**: URL completo (es: https://...)
  - **Colore**: Colore in formato esadecimale (es: #1976d2)
- Impostazione ordine di visualizzazione
- Attivazione/disattivazione
- Eliminazione

### Validazione
La pagina di gestione valida che tutti i campi obbligatori siano compilati prima di salvare.

## Note Tecniche

- I contenuti vengono caricati all'apertura della home page
- La cache non è implementata (ogni visita alla home carica i dati freschi)
- I contenuti inattivi non vengono mostrati agli utenti
- L'ordine dei contenuti è gestibile tramite il campo `order`

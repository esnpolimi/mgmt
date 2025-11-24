# Analisi Cronologia Commit - Cancellazioni Tesorieria e Caricamento Foto

## Sommario Esecutivo

Questa analisi documenta quando sono state rimosse parti del codice relative a:
1. **Tesorieria (Treasury)** - componenti backend e frontend
2. **Caricamento Foto nei Form Eventi** - funzionalità di upload file per iscrizioni e creazione eventi

---

## 1. TESORIERIA (Treasury)

### 🔴 Commit di Cancellazione Principale: `8a87559`

**Commit Hash:** `8a87559de5452e04891732affdce1e2cd053d374`  
**Autore:** Matteo Pompilio <matteo.pompilio@mail.polimi.it>  
**Data:** Domenica 9 Novembre 2025, 10:34:34 +0100  
**Messaggio:** "merge and production deploy"

### File Backend Treasury Cancellati:
- `backend/treasury/__init__.py`
- `backend/treasury/admin.py`
- `backend/treasury/apps.py`
- `backend/treasury/exceptions.py`
- `backend/treasury/models.py`
- `backend/treasury/serializers.py`
- `backend/treasury/tests.py`
- `backend/treasury/urls.py`
- `backend/treasury/views.py`
- Tutte le migration (0001 attraverso 0010):
  - `backend/treasury/migrations/0001_initial.py`
  - `backend/treasury/migrations/0002_initial.py`
  - `backend/treasury/migrations/0003_settings.py`
  - `backend/treasury/migrations/0004_rename_esncard_renewal_fee_currency_settings_esncard_lost_fee_currency_and_more.py`
  - `backend/treasury/migrations/0005_transaction_esncard_transaction_type_and_more.py`
  - `backend/treasury/migrations/0006_alter_transaction_type.py`
  - `backend/treasury/migrations/0007_account_visible_to_groups.py`
  - `backend/treasury/migrations/0008_alter_account_visible_to_groups.py`
  - `backend/treasury/migrations/0009_delete_historicalaccount.py`
  - `backend/treasury/migrations/0010_alter_esncard_options_and_more.py`
  - `backend/treasury/migrations/__init__.py`

### File Frontend Treasury Cancellati:
- `frontend/src/Components/treasury/AccountModal.jsx`
- `frontend/src/Components/treasury/AccountsDash.jsx`
- `frontend/src/Components/treasury/EventsDash.jsx`
- `frontend/src/Components/treasury/RecentAccountTransactionsModal.jsx`
- `frontend/src/Components/treasury/ReimburseRequestModal.jsx`
- `frontend/src/Components/treasury/ReimbursementRequestModal.jsx`
- `frontend/src/Components/treasury/ReimbursementRequestsDash.jsx`
- `frontend/src/Components/treasury/TransactionAdd.jsx`
- `frontend/src/Components/treasury/TransactionModal.jsx`
- `frontend/src/Components/treasury/TransactionsDash.jsx`
- `frontend/src/Pages/treasury/AccountsList.jsx`
- `frontend/src/Pages/treasury/ReimbursementRequestsList.jsx`
- `frontend/src/Pages/treasury/TransactionsList.jsx`
- `frontend/src/Pages/treasury/TreasuryDashboard.jsx`

### Note Importanti:
⚠️ **ATTENZIONE:** Dopo l'unshallow del repository, si è scoperto che i file treasury esistono ancora nella versione corrente del repository. Il commit `8a87559` era parte di un merge complesso, e i file sono stati successivamente ripristinati. Attualmente (commit `e53583a`), i file treasury sono presenti in:
- `backend/treasury/` ✅ Presente (verificato)
- `frontend/src/Components/treasury/` ✅ Presente (10 componenti verificati)
- `frontend/src/Pages/treasury/` ✅ Presente (4 pagine verificate)

---

## 2. CARICAMENTO FOTO NEI FORM EVENTI (File Upload Feature)

### 🟢 Commit di Aggiunta: `22a9108`

**Commit Hash:** `22a9108b5a600f76165b1518d2cabcc4ccb04955`  
**Autore:** Matteo Pompilio <matteo.pompilio@mail.polimi.it>  
**Data:** Mercoledì 1 Ottobre 2025, 20:42:15 +0200  
**Messaggio:** "Added File Upload type to Form fields; production deploy"

#### Modifiche Apportate:
Il commit ha aggiunto il tipo di campo `'l'` (File Upload) ai form degli eventi:

**In `frontend/src/Components/events/EventModal.jsx`:**
```javascript
// PRIMA (commit 22a9108^):
{value: 'p', label: 'Telefono'}

// DOPO (commit 22a9108):
{value: 'p', label: 'Telefono'},
{value: 'l', label: 'File Upload'},
```

**File Modificati:**
- `backend/events/models.py` - 6 linee modificate
- `backend/events/views.py` - 88 linee aggiunte
- `frontend/src/Components/common/ReceiptFileUpload.jsx` - 39 linee modificate
- `frontend/src/Components/events/EditAnswersModal.jsx` - 41 linee modificate
- `frontend/src/Components/events/EventListAccordions.jsx` - 32 linee aggiunte
- `frontend/src/Components/events/EventModal.jsx` - 3 linee modificate
- `frontend/src/Pages/events/EventForm.jsx` - 58 linee aggiunte
- `frontend/src/index.jsx` - 11 linee modificate

**Statistiche del Commit:** 11 file modificati, 653 inserimenti(+), 449 cancellazioni(-)

### 🔴 Commit di Rimozione: `4a2d655`

**Commit Hash:** `4a2d655d2f9030b02ab3a01dba4adaf611c5f9b8`  
**Autore:** Moussa Gerges <moussagerges9@gmail.com>  
**Data:** Venerdì 3 Ottobre 2025, 22:39:13 +0200  
**Messaggio:** "adding ability to order form fields during creation and editing"

#### Stato della Funzionalità:
La funzionalità di upload file è stata rimossa (intenzionalmente o accidentalmente) durante il commit `4a2d655`, solo **2 giorni dopo** essere stata aggiunta.

**Verifica dello Stato:**
```bash
# Nel commit 22a9108 (1 Ottobre 2025) - PRESENTE
git show 22a9108:frontend/src/Components/events/EventModal.jsx | grep "'l', label"
> {value: 'l', label: 'File Upload'},

# Nel commit 4a2d655 (3 Ottobre 2025) - ASSENTE
git show 4a2d655:frontend/src/Components/events/EventModal.jsx | grep "'l', label"
> (nessun risultato)

# Nel commit corrente (e53583a) - ASSENTE
git show e53583a:frontend/src/Components/events/EventModal.jsx | grep "'l', label"
> (nessun risultato)
```

### 🔄 Storia della Funzionalità:

1. **1 Ottobre 2025 (22a9108):** ✅ Funzionalità di File Upload aggiunta da Matteo Pompilio
2. **3 Ottobre 2025 (4a2d655):** ❌ Funzionalità rimossa da Moussa Gerges durante refactoring dei form fields
3. **8-9 Ottobre 2025 (6d98750, ad683cf):** ✅ Funzionalità temporaneamente ripristinata tramite merge
4. **23 Ottobre 2025 e successivi (f7962e6+):** ❌ Funzionalità definitivamente rimossa

### Stato Attuale (commit e53583a):

**Campo File Upload NON è disponibile** nei form eventi. I tipi di campo disponibili sono:
- `'t'` - Testo
- `'n'` - Numero  
- `'c'` - Scelta Singola
- `'m'` - Scelta Multipla
- `'s'` - Menu a Tendina
- `'b'` - Sì/No
- `'d'` - Data
- `'e'` - ESNcard
- `'p'` - Telefono

**Il campo `'l'` (File Upload) NON è presente.**

### Residui nel Codice:

Alcuni riferimenti al tipo `'l'` sono ancora presenti in `EventForm.jsx`:
```javascript
// In frontend/src/Pages/events/EventForm.jsx (linea 49):
const linkFields = formFields.filter(f => f.type === 'l');
```

Questo suggerisce che il codice frontend mantiene ancora la capacità di visualizzare campi di tipo `'l'`, ma non è più possibile crearli tramite EventModal.

---

## 3. CANCELLAZIONI CORRELATE AGLI EVENTI

### Nel commit `8a87559` sono stati anche cancellati:

**Backend Events:**
- `backend/events.md`
- `backend/events/__init__.py`
- `backend/events/admin.py`
- `backend/events/apps.py`
- `backend/events/models.py`
- `backend/events/serializers.py`
- `backend/events/tests.py`
- `backend/events/urls.py`
- `backend/events/views.py`
- Tutte le migration degli eventi (18 file)

**Frontend Events:**
- `frontend/src/Components/events/EditAnswersModal.jsx`
- `frontend/src/Components/events/EventListAccordions.jsx`
- `frontend/src/Components/events/EventModal.jsx`
- `frontend/src/Components/events/MoveToListModal.jsx`
- `frontend/src/Components/events/PrintableLiberatorieModal.jsx`
- `frontend/src/Components/events/ReimburseDepositsModal.jsx`
- `frontend/src/Components/events/ReimburseQuotaModal.jsx`
- `frontend/src/Components/events/SharedListsSelector.jsx`
- `frontend/src/Components/events/SubscriptionModal.jsx`
- `frontend/src/Pages/events/Event.jsx`
- `frontend/src/Pages/events/EventForm.jsx`
- `frontend/src/Pages/events/EventFormLogin.jsx`
- `frontend/src/Pages/events/EventFormResult.jsx`
- `frontend/src/Pages/events/EventPayment.jsx`
- `frontend/src/Pages/events/EventsList.jsx`

⚠️ **NOTA IMPORTANTE:** Come per la tesorieria, questi file sono stati successivamente ripristinati e sono presenti nella versione corrente del repository.

---

## 4. TIMELINE COMPLETA

| Data | Commit | Autore | Azione | Componente |
|------|--------|--------|--------|------------|
| 1 Ottobre 2025 | 22a9108 | Matteo Pompilio | ✅ AGGIUNTA | File Upload in form eventi |
| 3 Ottobre 2025 | 4a2d655 | Moussa Gerges | ❌ RIMOZIONE | File Upload in form eventi |
| 8-9 Ottobre 2025 | 6d98750, ad683cf | Vari | 🔄 RIPRISTINO TEMPORANEO | File Upload via merge |
| 23 Ottobre 2025+ | f7962e6+ | Moussa Gerges | ❌ RIMOZIONE DEFINITIVA | File Upload in form eventi |
| 9 Novembre 2025 | 8a87559 | Matteo Pompilio | ❌ CANCELLAZIONE TEMPORANEA | Treasury + Events (poi ripristinati) |

---

## 5. CONCLUSIONI

### Tesorieria:
- **Cancellata temporaneamente** il 9 Novembre 2025 nel commit `8a87559`
- **Successivamente ripristinata** - attualmente presente nel repository
- I file treasury esistono nella versione corrente

### Caricamento Foto:
- **Aggiunta** il 1 Ottobre 2025 da Matteo Pompilio
- **Rimossa definitivamente** a partire dal 3 Ottobre 2025 da Moussa Gerges
- **NON presente** nella versione corrente del codice
- **Durata di vita:** circa 2 giorni in produzione

### Raccomandazioni:
1. Se si desidera ripristinare la funzionalità di upload file, fare riferimento al commit `22a9108`
2. Considerare se la rimozione della funzionalità di upload file è stata intenzionale o accidentale
3. Se accidentale, valutare un revert selettivo delle modifiche

---

## 6. COMANDI UTILI PER APPROFONDIMENTI

```bash
# Vedere le modifiche complete del commit di aggiunta file upload
git show 22a9108

# Vedere le modifiche complete del commit di rimozione file upload  
git show 4a2d655

# Vedere le modifiche complete del commit di cancellazione treasury
git show 8a87559

# Ripristinare la funzionalità di file upload
git show 22a9108:frontend/src/Components/events/EventModal.jsx > EventModal.jsx.with-upload
git show 22a9108:frontend/src/Pages/events/EventForm.jsx > EventForm.jsx.with-upload

# Vedere la differenza tra versione con e senza upload
git diff 4a2d655^ 4a2d655 -- frontend/src/Components/events/EventModal.jsx
```

---

**Documento generato il:** 24 Novembre 2025  
**Branch analizzato:** `copilot/track-commit-history-changes-again`  
**Ultimo commit analizzato:** `e53583a` (migration files production deploy)

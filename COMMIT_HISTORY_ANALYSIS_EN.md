# Commit History Analysis - Treasury and Photo Upload Deletions

## Executive Summary

This analysis documents when code related to the following was removed:
1. **Treasury** - backend and frontend components
2. **Photo Upload in Event Forms** - file upload functionality for event registration and creation

---

## 1. TREASURY

### 🔴 Main Deletion Commit: `8a87559`

**Commit Hash:** `8a87559de5452e04891732affdce1e2cd053d374`  
**Author:** Matteo Pompilio <matteo.pompilio@mail.polimi.it>  
**Date:** Sunday, November 9, 2025, 10:34:34 +0100  
**Message:** "merge and production deploy"

### Backend Treasury Files Deleted:
- `backend/treasury/__init__.py`
- `backend/treasury/admin.py`
- `backend/treasury/apps.py`
- `backend/treasury/exceptions.py`
- `backend/treasury/models.py`
- `backend/treasury/serializers.py`
- `backend/treasury/tests.py`
- `backend/treasury/urls.py`
- `backend/treasury/views.py`
- All migrations (0001 through 0010)

### Frontend Treasury Files Deleted:
- All components in `frontend/src/Components/treasury/`
- All pages in `frontend/src/Pages/treasury/`

### Important Note:
⚠️ **ATTENTION:** After unshallowing the repository, it was discovered that treasury files still exist in the current repository version (commit `e53583a`). Commit `8a87559` was part of a complex merge, and the files were subsequently restored. Current treasury files verified:
- `backend/treasury/` ✅ Present (verified)
- `frontend/src/Components/treasury/` ✅ Present (10 components verified)
- `frontend/src/Pages/treasury/` ✅ Present (4 pages verified)

---

## 2. PHOTO UPLOAD IN EVENT FORMS (File Upload Feature)

### 🟢 Addition Commit: `22a9108`

**Commit Hash:** `22a9108b5a600f76165b1518d2cabcc4ccb04955`  
**Author:** Matteo Pompilio <matteo.pompilio@mail.polimi.it>  
**Date:** Wednesday, October 1, 2025, 20:42:15 +0200  
**Message:** "Added File Upload type to Form fields; production deploy"

#### Changes Made:
Added field type `'l'` (File Upload) to event forms:

**In `frontend/src/Components/events/EventModal.jsx`:**
```javascript
// BEFORE (commit 22a9108^):
{value: 'p', label: 'Telefono'}

// AFTER (commit 22a9108):
{value: 'p', label: 'Telefono'},
{value: 'l', label: 'File Upload'},
```

**Files Modified:**
- `backend/events/models.py`
- `backend/events/views.py`
- `frontend/src/Components/common/ReceiptFileUpload.jsx`
- `frontend/src/Components/events/EditAnswersModal.jsx`
- `frontend/src/Components/events/EventListAccordions.jsx`
- `frontend/src/Components/events/EventModal.jsx`
- `frontend/src/Pages/events/EventForm.jsx`
- `frontend/src/index.jsx`

**Commit Stats:** 11 files changed, 653 insertions(+), 449 deletions(-)

### 🔴 Removal Commit: `4a2d655`

**Commit Hash:** `4a2d655d2f9030b02ab3a01dba4adaf611c5f9b8`  
**Author:** Moussa Gerges <moussagerges9@gmail.com>  
**Date:** Friday, October 3, 2025, 22:39:13 +0200  
**Message:** "adding ability to order form fields during creation and editing"

#### Feature Status:
The file upload functionality was removed (intentionally or accidentally) during commit `4a2d655`, only **2 days after** being added.

### 🔄 Feature History:

1. **October 1, 2025 (22a9108):** ✅ File Upload feature added by Matteo Pompilio
2. **October 3, 2025 (4a2d655):** ❌ Feature removed by Moussa Gerges during form fields refactoring
3. **October 8-9, 2025 (6d98750, ad683cf):** ✅ Feature temporarily restored via merge
4. **October 23, 2025 onwards (f7962e6+):** ❌ Feature permanently removed

### Current Status (commit e53583a):

**File Upload field is NOT available** in event forms. Available field types are:
- `'t'` - Text
- `'n'` - Number
- `'c'` - Single Choice
- `'m'` - Multiple Choice
- `'s'` - Dropdown Menu
- `'b'` - Yes/No
- `'d'` - Date
- `'e'` - ESNcard
- `'p'` - Phone

**The `'l'` (File Upload) field is NOT present.**

---

## 3. COMPLETE TIMELINE

| Date | Commit | Author | Action | Component |
|------|--------|--------|--------|-----------|
| Oct 1, 2025 | 22a9108 | Matteo Pompilio | ✅ ADDED | File Upload in event forms |
| Oct 3, 2025 | 4a2d655 | Moussa Gerges | ❌ REMOVED | File Upload in event forms |
| Oct 8-9, 2025 | 6d98750, ad683cf | Various | 🔄 TEMPORARY RESTORE | File Upload via merge |
| Oct 23, 2025+ | f7962e6+ | Moussa Gerges | ❌ PERMANENT REMOVAL | File Upload in event forms |
| Nov 9, 2025 | 8a87559 | Matteo Pompilio | ❌ TEMPORARY DELETION | Treasury + Events (later restored) |

---

## 4. CONCLUSIONS

### Treasury:
- **Temporarily deleted** on November 9, 2025 in commit `8a87559`
- **Subsequently restored** - currently present in the repository
- Treasury files exist in the current version

### Photo Upload:
- **Added** on October 1, 2025 by Matteo Pompilio
- **Permanently removed** starting October 3, 2025 by Moussa Gerges
- **NOT present** in the current code version
- **Lifespan:** approximately 2 days in production

### Recommendations:
1. To restore file upload functionality, refer to commit `22a9108`
2. Consider whether the removal of file upload functionality was intentional or accidental
3. If accidental, evaluate a selective revert of the changes

---

## 5. USEFUL COMMANDS FOR FURTHER INVESTIGATION

```bash
# View complete changes from file upload addition commit
git show 22a9108

# View complete changes from file upload removal commit
git show 4a2d655

# View complete changes from treasury deletion commit
git show 8a87559

# Restore file upload functionality
git show 22a9108:frontend/src/Components/events/EventModal.jsx > EventModal.jsx.with-upload
git show 22a9108:frontend/src/Pages/events/EventForm.jsx > EventForm.jsx.with-upload

# See difference between versions with and without upload
git diff 4a2d655^ 4a2d655 -- frontend/src/Components/events/EventModal.jsx
```

---

**Document generated:** November 24, 2025  
**Branch analyzed:** `copilot/track-commit-history-changes-again`  
**Last commit analyzed:** `e53583a` (migration files production deploy)

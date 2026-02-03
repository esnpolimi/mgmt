# ESN Polimi Gestionale - Test Specifications Overview

## Indice Generale

Questo documento fornisce una panoramica completa del sistema gestionale ESN Polimi e guida la creazione di unit tests per ogni modulo.

---

## Architettura del Sistema

### Stack Tecnologico
- **Backend**: Django 4.x + Django REST Framework
- **Database**: PostgreSQL (prod) / SQLite (dev)
- **Autenticazione**: JWT (SimpleJWT)
- **File Storage**: Google Drive API
- **Pagamenti**: SumUp API
- **Email**: Django Email Backend

### Moduli Principali

| Modulo | Descrizione | Dipendenze |
|--------|-------------|------------|
| `users` | Autenticazione, gestione utenti, permessi | `profiles` |
| `profiles` | Profili Erasmus/ESNers, documenti | - |
| `events` | Eventi, iscrizioni, liste, form pubblici | `profiles`, `treasury` |
| `treasury` | Casse, transazioni, ESNcard, rimborsi | `profiles`, `events`, `users` |
| `content` | Sezioni contenuto homepage | `users` |

---

## 🔐 Sistema di Ruoli e Permessi

### Gruppi Django
1. **Board** - Accesso completo a tutto il sistema
2. **Attivi** - Membri attivi ESN con permessi estesi
3. **Aspiranti** - Nuovi membri con permessi limitati

### Permessi Speciali (User Model)
- `can_manage_casse` - Permesso extra per gestire casse (concesso da Board agli Aspiranti)
- `can_view_casse_import` - Permesso per vedere importi casse (concesso da Board agli Aspiranti)

### Regole di Visibilità
- **SumUp Account**: Visibile solo a Board
- **Balance Casse**: Board vede tutto, Attivi tutto tranne SumUp, Aspiranti solo se flag attivo

---

## Struttura dei Documenti di Test

```
docs/test_specifications/
├── 00_OVERVIEW.md           # Questo file
├── 01_USERS_MODULE.md       # Test per users/
├── 02_PROFILES_MODULE.md    # Test per profiles/
├── 03_EVENTS_MODULE.md      # Test per events/
├── 04_TREASURY_MODULE.md    # Test per treasury/
└── 05_CONTENT_MODULE.md     # Test per content/
```

---

## Convenzioni di Testing

### Setup Base per Tutti i Test

```python
from django.test import TestCase
from django.contrib.auth.models import Group
from rest_framework.test import APITestCase, APIClient
from rest_framework_simplejwt.tokens import RefreshToken

class BaseTestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        # Crea gruppi
        cls.board_group = Group.objects.create(name='Board')
        cls.attivi_group = Group.objects.create(name='Attivi')
        cls.aspiranti_group = Group.objects.create(name='Aspiranti')
    
    def setUp(self):
        self.client = APIClient()
    
    def create_profile(self, email, is_esner=False, **kwargs):
        from profiles.models import Profile
        return Profile.objects.create(
            email=email,
            name=kwargs.get('name', 'Test'),
            surname=kwargs.get('surname', 'User'),
            email_is_verified=True,
            enabled=True,
            is_esner=is_esner,
            **kwargs
        )
    
    def create_user(self, profile, group=None, password='testpass123'):
        from users.models import User
        user = User.objects.create_user(profile=profile, password=password)
        if group:
            user.groups.add(group)
        return user
    
    def authenticate_user(self, user):
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
        return refresh
    
    def create_base_user(self):
        """Crea utente base (Aspiranti)"""
        profile = self.create_profile('base@esnpolimi.it', is_esner=True)
        return self.create_user(profile, self.aspiranti_group)
    
    def create_board_user(self):
        """Crea utente Board"""
        profile = self.create_profile('board@esnpolimi.it', is_esner=True)
        return self.create_user(profile, self.board_group)
```

### Categorie di Test

1. **Unit Tests** - Test di singole funzioni/metodi
2. **Integration Tests** - Test di flussi API completi
3. **Permission Tests** - Test di controllo accessi
4. **Validation Tests** - Test di validazione dati
5. **Edge Case Tests** - Test di casi limite

### Naming Convention

```python
def test_<action>_<scenario>_<expected_result>(self):
    """
    Test che <action> quando <scenario> ritorna <expected_result>
    """
```

Esempio:
```python
def test_login_with_valid_credentials_returns_tokens(self):
    """Test che il login con credenziali valide ritorna access e refresh token"""

def test_login_with_non_esn_email_returns_403(self):
    """Test che il login con email non @esnpolimi.it ritorna 403"""
```

---

## 🔄 Flussi Principali da Testare

### 1. Flusso Registrazione ESNer
1. Creazione profilo con email @esnpolimi.it
2. Creazione documento
3. Creazione utente con password
4. Invio email verifica
5. Verifica email e attivazione
6. Primo login

### 2. Flusso Registrazione Erasmus
1. Creazione profilo con email qualsiasi
2. Creazione documento
3. Invio email verifica
4. Verifica email e attivazione
5. (Nessun login - solo profilo)

### 3. Flusso Evento
1. Creazione evento con liste
2. Configurazione form pubblico
3. Iscrizione via form
4. Pagamento online (SumUp)
5. Spostamento tra liste
6. Rimborsi

### 4. Flusso Treasury
1. Apertura/chiusura casse
2. Emissione ESNcard
3. Transazioni (depositi, prelievi)
4. Richieste rimborso
5. Export bilancio

---

## Note Importanti

### Mock Services
- **Google Drive API**: Mock per upload file
- **SumUp API**: Mock per pagamenti
- **Email Backend**: Usa `django.core.mail.outbox` in test

### Database Constraints
- `Profile.email` è unique
- `Profile.person_code` e `matricola_number` sono unique (nullable)
- `User.profile` è la primary key (FK a Profile.email)
- `Subscription` ha constraint unique su (profile, event)

### Timezone
- Tutti i datetime sono timezone-aware
- Usare `django.utils.timezone.now()` nei test

---

## 📊 Coverage Target

| Modulo | Target |
|--------|--------|
| users | 90% |
| profiles | 90% |
| events | 85% |
| treasury | 85% |
| content | 80% |

---

## 🚀 Esecuzione Tests

```bash
# Tutti i test
python manage.py test

# Modulo specifico
python manage.py test users
python manage.py test profiles
python manage.py test events
python manage.py test treasury
python manage.py test content

# Con coverage
coverage run manage.py test
coverage report
coverage html
```

# 02 - Profiles Module Test Specifications

## Panoramica Modulo

Il modulo `profiles` gestisce:
- Profili Erasmus e ESNers
- Documenti d'identità
- Flusso di registrazione e verifica email
- Ricerca profili
- Gestione matricole

---

## File del Modulo

| File | Descrizione |
|------|-------------|
| `models.py` | Models Profile, Document, BaseEntity |
| `views.py` | Endpoint CRUD profili e documenti |
| `serializers.py` | Serializers per profili e documenti |
| `tokens.py` | Token generator per verifica email |
| `urls.py` | Route del modulo |

---

## Modelli

### Profile
```python
class Profile(BaseEntity):
    id = AutoField(primary_key=True)
    email = EmailField(unique=True)
    email_is_verified = BooleanField(default=False)
    name = CharField(max_length=128)
    surname = CharField(max_length=128)
    birthdate = DateField(null=True)
    country = CharField(max_length=2, null=True)  # ISO code
    course = CharField(choices=Course.choices, null=True)
    phone_prefix = CharField(max_length=10, null=True)
    phone_number = CharField(max_length=20, null=True)
    whatsapp_prefix = CharField(max_length=10, null=True)
    whatsapp_number = CharField(max_length=20, null=True)
    person_code = CharField(max_length=10, unique=True, null=True)
    domicile = CharField(max_length=256, null=True)
    is_esner = BooleanField(default=False)
    matricola_number = CharField(max_length=10, unique=True, null=True)
    matricola_expiration = DateField(null=True)
```

### Document
```python
class Document(BaseEntity):
    id = AutoField(primary_key=True)
    profile = ForeignKey(Profile)
    type = CharField(choices=Type.choices)
    number = CharField(unique=True)
    expiration = DateField()
```

---

## Endpoints

### 1. GET `/backend/erasmus_profiles/`
**Descrizione**: Lista profili Erasmus (is_esner=False) con paginazione
**Autenticazione**: Sì
**Permessi**: Tutti autenticati

#### Parametri Query
- `page`: numero pagina
- `page_size`: elementi per pagina
- `search`: ricerca multi-campo
- `ordering`: ordinamento (-created_at default)
- `esncardValidity`: filtro validità ESNcard (valid, expired, absent)

#### Scenari di Test

| ID | Scenario | Query Params | Expected | Status |
|----|----------|--------------|----------|--------|
| P-EL-001 | Lista senza filtri | - | Lista paginata Erasmus | 200 |
| P-EL-002 | Lista con ricerca nome | search=Mario | Profili con "Mario" | 200 |
| P-EL-003 | Lista con ricerca email | search=@gmail | Profili con @gmail | 200 |
| P-EL-004 | Lista con ricerca ESNcard | search=IT123 | Profili con ESNcard | 200 |
| P-EL-005 | Lista ordinata per nome | ordering=name | Ordinati per nome | 200 |
| P-EL-006 | Lista ordinata desc | ordering=-name | Ordinati desc | 200 |
| P-EL-007 | Paginazione pagina 2 | page=2&page_size=10 | Pagina 2 | 200 |
| P-EL-008 | Pagina invalida | page=999 | Errore pagina | 400 |
| P-EL-009 | Filtro ESNcard valida | esncardValidity=valid | Solo con card valida | 200 |
| P-EL-010 | Filtro ESNcard assente | esncardValidity=absent | Solo senza card | 200 |
| P-EL-011 | Non autenticato | - | Unauthorized | 401 |

```python
class ErasmusProfileListTestCase(BaseTestCase):
    
    def setUp(self):
        super().setUp()
        # Crea profili Erasmus di test
        for i in range(15):
            self.create_profile(f'erasmus{i}@university.edu', is_esner=False, 
                              name=f'Erasmus{i}', surname=f'Student{i}')
    
    def test_list_erasmus_profiles_returns_paginated_results(self):
        """P-EL-001: Lista Erasmus ritorna risultati paginati"""
        user = self.create_base_user()
        self.authenticate_user(user)
        
        response = self.client.get('/backend/erasmus_profiles/')
        
        self.assertEqual(response.status_code, 200)
        self.assertIn('results', response.data)
        self.assertIn('count', response.data)
    
    def test_search_by_name_filters_correctly(self):
        """P-EL-002: Ricerca per nome filtra correttamente"""
        user = self.create_base_user()
        self.authenticate_user(user)
        
        # Crea profilo specifico
        self.create_profile('mario@test.com', is_esner=False, name='Mario', surname='Rossi')
        
        response = self.client.get('/backend/erasmus_profiles/?search=Mario')
        
        self.assertEqual(response.status_code, 200)
        results = response.data['results']
        self.assertTrue(all('Mario' in r['name'] for r in results))
    
    def test_pagination_page_2(self):
        """P-EL-007: Paginazione pagina 2 funziona"""
        user = self.create_base_user()
        self.authenticate_user(user)
        
        response = self.client.get('/backend/erasmus_profiles/?page=2&page_size=5')
        
        self.assertEqual(response.status_code, 200)
        self.assertLessEqual(len(response.data['results']), 5)
```

---

### 2. GET `/backend/esner_profiles/`
**Descrizione**: Lista profili ESNers (is_esner=True) con paginazione
**Autenticazione**: Sì
**Permessi**: Tutti autenticati

#### Parametri Query Extra (rispetto a Erasmus)
- `group`: filtro per gruppo utente (Board, Attivi, Aspiranti)

#### Scenari di Test

| ID | Scenario | Query Params | Expected | Status |
|----|----------|--------------|----------|--------|
| P-ENL-001 | Lista senza filtri | - | Lista paginata ESNers | 200 |
| P-ENL-002 | Filtro per gruppo Board | group=Board | Solo Board members | 200 |
| P-ENL-003 | Filtro gruppi multipli | group=Board,Attivi | Board + Attivi | 200 |
| P-ENL-004 | Ricerca per cognome | search=Rossi | ESNers con Rossi | 200 |

```python
class ESNerProfileListTestCase(BaseTestCase):
    
    def test_filter_by_group_returns_only_group_members(self):
        """P-ENL-002: Filtro per gruppo ritorna solo membri del gruppo"""
        board_user = self.create_board_user()
        self.authenticate_user(board_user)
        
        # Crea ESNers in gruppi diversi
        attivi_profile = self.create_profile('attivi@esnpolimi.it', is_esner=True)
        self.create_user(attivi_profile, self.attivi_group)
        
        response = self.client.get('/backend/esner_profiles/?group=Board')
        
        self.assertEqual(response.status_code, 200)
        # Verifica che solo Board members siano ritornati
```

---

### 3. POST `/backend/profile/initiate-creation/`
**Descrizione**: Inizia creazione profilo (ESNer o Erasmus)
**Autenticazione**: No
**Permessi**: Pubblico

#### Scenari di Test - ESNer

| ID | Scenario | Input | Expected | Status |
|----|----------|-------|----------|--------|
| P-IC-001 | Crea ESNer con dati validi | email @esnpolimi.it, tutti i campi | Profilo creato, email inviata | 201 |
| P-IC-002 | Crea ESNer con email non ESN | email @gmail.com, is_esner=True | Errore email | 400 |
| P-IC-003 | Crea ESNer senza password | is_esner=True, no password | Utente non creato | 500 |
| P-IC-004 | Email ESNer già esistente | email già registrata | Errore unique | 400 |

#### Scenari di Test - Erasmus

| ID | Scenario | Input | Expected | Status |
|----|----------|-------|----------|--------|
| P-IC-005 | Crea Erasmus con dati validi | email qualsiasi, tutti i campi | Profilo creato, email inviata | 201 |
| P-IC-006 | Crea Erasmus senza documento | manca document_ fields | Errore validazione | 400 |
| P-IC-007 | Email Erasmus già esistente | email già registrata | Errore unique | 400 |

```python
class InitiateProfileCreationTestCase(BaseTestCase):
    
    def test_create_esner_with_valid_data_sends_verification_email(self):
        """P-IC-001: Crea ESNer con dati validi invia email verifica"""
        from django.core import mail
        
        response = self.client.post('/backend/profile/initiate-creation/', {
            'email': 'new@esnpolimi.it',
            'name': 'Mario',
            'surname': 'Rossi',
            'birthdate': '1995-01-15',
            'country': 'IT',
            'is_esner': True,
            'password': 'securepass123',
            'document_type': 'ID Card',
            'document_number': 'AB123456',
            'document_expiration': '2030-01-01'
        })
        
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('Verifica email', mail.outbox[0].subject)
        
        # Verifica profilo creato ma non attivo
        from profiles.models import Profile
        profile = Profile.objects.get(email='new@esnpolimi.it')
        self.assertFalse(profile.enabled)
        self.assertFalse(profile.email_is_verified)
    
    def test_create_esner_with_non_esn_email_returns_400(self):
        """P-IC-002: Crea ESNer con email non @esnpolimi.it ritorna 400"""
        response = self.client.post('/backend/profile/initiate-creation/', {
            'email': 'test@gmail.com',
            'name': 'Mario',
            'surname': 'Rossi',
            'is_esner': True,
            'password': 'test123',
            'document_type': 'ID Card',
            'document_number': 'AB123456',
            'document_expiration': '2030-01-01'
        })
        
        self.assertEqual(response.status_code, 400)
        self.assertIn('email', response.data)
    
    def test_create_erasmus_sends_english_email(self):
        """P-IC-005: Crea Erasmus invia email in inglese"""
        from django.core import mail
        
        response = self.client.post('/backend/profile/initiate-creation/', {
            'email': 'erasmus@university.edu',
            'name': 'John',
            'surname': 'Doe',
            'birthdate': '1998-05-20',
            'country': 'DE',
            'is_esner': False,
            'document_type': 'Passport',
            'document_number': 'DE12345678',
            'document_expiration': '2028-01-01'
        })
        
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('Email verification', mail.outbox[0].subject)
    
    def test_create_profile_with_duplicate_email_returns_400(self):
        """P-IC-004: Email duplicata ritorna 400"""
        self.create_profile('existing@esnpolimi.it', is_esner=True)
        
        response = self.client.post('/backend/profile/initiate-creation/', {
            'email': 'existing@esnpolimi.it',
            'name': 'Mario',
            'surname': 'Rossi',
            'is_esner': True,
            'password': 'test123',
            'document_type': 'ID Card',
            'document_number': 'NEW123456',
            'document_expiration': '2030-01-01'
        })
        
        self.assertEqual(response.status_code, 400)
```

---

### 4. GET `/backend/api/profile/verify-email/<uid>/<token>/`
**Descrizione**: Verifica email e attiva profilo
**Autenticazione**: No
**Permessi**: Pubblico (richiede token valido)

#### Scenari di Test

| ID | Scenario | Input | Expected | Status |
|----|----------|-------|----------|--------|
| P-VE-001 | Verifica con token valido | uid, token corretti | Profilo attivato | 200 |
| P-VE-002 | Verifica con token invalido | token sbagliato | "Link non valido" | 400 |
| P-VE-003 | Verifica con uid invalido | uid malformato | "Link non valido" | 400 |
| P-VE-004 | Verifica già effettuata | profilo già verificato | "Email già verificata" | 200 |
| P-VE-005 | Verifica ESNer attiva anche user | is_esner=True | User.is_active=True | 200 |

```python
class VerifyEmailTestCase(BaseTestCase):
    
    def test_verify_email_activates_profile_and_document(self):
        """P-VE-001: Verifica email attiva profilo e documento"""
        from profiles.tokens import email_verification_token
        from django.utils.encoding import force_bytes
        from django.utils.http import urlsafe_base64_encode
        from profiles.models import Profile, Document
        
        # Crea profilo non verificato
        profile = Profile.objects.create(
            email='test@esnpolimi.it',
            name='Test',
            surname='User',
            email_is_verified=False,
            enabled=False,
            is_esner=True
        )
        Document.objects.create(
            profile=profile,
            type='ID Card',
            number='TEST123',
            expiration='2030-01-01',
            enabled=False
        )
        
        uid = urlsafe_base64_encode(force_bytes(profile.pk))
        token = email_verification_token.make_token(profile)
        
        response = self.client.get(f'/backend/api/profile/verify-email/{uid}/{token}/')
        
        self.assertEqual(response.status_code, 200)
        
        profile.refresh_from_db()
        self.assertTrue(profile.email_is_verified)
        self.assertTrue(profile.enabled)
        
        doc = Document.objects.get(profile=profile)
        self.assertTrue(doc.enabled)
    
    def test_verify_esner_activates_user(self):
        """P-VE-005: Verifica ESNer attiva anche User"""
        from profiles.tokens import email_verification_token
        from django.utils.encoding import force_bytes
        from django.utils.http import urlsafe_base64_encode
        from profiles.models import Profile
        from users.models import User
        
        profile = Profile.objects.create(
            email='esner@esnpolimi.it',
            name='Test',
            surname='User',
            email_is_verified=False,
            enabled=False,
            is_esner=True
        )
        user = User.objects.create_user(profile=profile, password='test')
        user.is_active = False
        user.save()
        
        uid = urlsafe_base64_encode(force_bytes(profile.pk))
        token = email_verification_token.make_token(profile)
        
        response = self.client.get(f'/backend/api/profile/verify-email/{uid}/{token}/')
        
        self.assertEqual(response.status_code, 200)
        
        user.refresh_from_db()
        self.assertTrue(user.is_active)
```

---

### 5. GET/PATCH/DELETE `/backend/profile/<pk>/`
**Descrizione**: Dettaglio/Modifica/Elimina profilo
**Autenticazione**: Sì
**Permessi**: GET tutti, PATCH richiede `profiles.change_profile`, DELETE solo Board

#### Scenari di Test - GET

| ID | Scenario | User | Expected | Status |
|----|----------|------|----------|--------|
| P-PD-001 | GET profilo esistente | Autenticato | Dettagli profilo completi | 200 |
| P-PD-002 | GET profilo inesistente | Autenticato | "Il profilo non esiste" | 404 |
| P-PD-003 | GET include has_subscriptions | Autenticato | Flag presente | 200 |

#### Scenari di Test - PATCH

| ID | Scenario | User | Input | Expected | Status |
|----|----------|------|-------|----------|--------|
| P-PP-001 | PATCH nome/cognome | Con permesso | name, surname | Aggiornato | 200 |
| P-PP-002 | PATCH senza permesso | Aspirante | dati | "Non hai i permessi" | 403 |
| P-PP-003 | PATCH email (vietato) | Board | email | Email non cambia | 200 |
| P-PP-004 | PATCH gruppo Aspirante->Attivi | Board | group=Attivi | Gruppo cambiato | 200 |
| P-PP-005 | PATCH gruppo Aspirante->Board | Attivi | group=Board | "Solo Board può" | 403 |
| P-PP-006 | PATCH person_code 00000000 | Board | person_code=00000000 | Salvato come null | 200 |

#### Scenari di Test - DELETE

| ID | Scenario | User | Expected | Status |
|----|----------|------|----------|--------|
| P-PDE-001 | DELETE profilo senza iscrizioni | Board | Profilo eliminato | 200 |
| P-PDE-002 | DELETE profilo con iscrizioni | Board | "Elimina iscrizioni prima" | 400 |
| P-PDE-003 | DELETE come non-Board | Attivi | "Non hai i permessi" | 401 |
| P-PDE-004 | DELETE ESNer elimina anche User | Board | User eliminato | 200 |

```python
class ProfileDetailTestCase(BaseTestCase):
    
    def test_get_profile_includes_has_subscriptions_flag(self):
        """P-PD-003: GET profilo include has_subscriptions"""
        user = self.create_base_user()
        self.authenticate_user(user)
        
        erasmus = self.create_profile('erasmus@test.com', is_esner=False)
        
        response = self.client.get(f'/backend/profile/{erasmus.pk}/')
        
        self.assertEqual(response.status_code, 200)
        self.assertIn('has_subscriptions', response.data)
    
    def test_patch_group_aspirante_to_attivi_as_board_succeeds(self):
        """P-PP-004: Cambio gruppo Aspirante->Attivi come Board ha successo"""
        board_user = self.create_board_user()
        self.authenticate_user(board_user)
        
        aspirante_profile = self.create_profile('aspirante@esnpolimi.it', is_esner=True)
        aspirante = self.create_user(aspirante_profile, self.aspiranti_group)
        
        response = self.client.patch(f'/backend/profile/{aspirante_profile.pk}/', {
            'group': 'Attivi'
        })
        
        self.assertEqual(response.status_code, 200)
        
        aspirante.refresh_from_db()
        self.assertTrue(aspirante.groups.filter(name='Attivi').exists())
    
    def test_patch_person_code_zeros_becomes_null(self):
        """P-PP-006: person_code con tutti zeri diventa null"""
        board_user = self.create_board_user()
        self.authenticate_user(board_user)
        
        profile = self.create_profile('test@esnpolimi.it', is_esner=True)
        
        response = self.client.patch(f'/backend/profile/{profile.pk}/', {
            'person_code': '00000000'
        })
        
        self.assertEqual(response.status_code, 200)
        
        profile.refresh_from_db()
        self.assertIsNone(profile.person_code)
    
    def test_delete_profile_with_subscriptions_returns_400(self):
        """P-PDE-002: DELETE profilo con iscrizioni ritorna 400"""
        from events.models import Event, EventList, Subscription
        
        board_user = self.create_board_user()
        self.authenticate_user(board_user)
        
        erasmus = self.create_profile('erasmus@test.com', is_esner=False)
        
        # Crea evento e iscrizione
        event = Event.objects.create(name='Test Event', date='2025-06-01')
        event_list = EventList.objects.create(name='Main List', capacity=100, is_main_list=True)
        event_list.events.add(event)
        Subscription.objects.create(profile=erasmus, event=event, list=event_list)
        
        response = self.client.delete(f'/backend/profile/{erasmus.pk}/')
        
        self.assertEqual(response.status_code, 400)
        self.assertIn('iscrizioni', response.data['error'])
    
    def test_delete_esner_also_deletes_user(self):
        """P-PDE-004: DELETE ESNer elimina anche User"""
        from users.models import User
        
        board_user = self.create_board_user()
        self.authenticate_user(board_user)
        
        esner_profile = self.create_profile('target@esnpolimi.it', is_esner=True)
        target_user = self.create_user(esner_profile, self.aspiranti_group)
        
        response = self.client.delete(f'/backend/profile/{esner_profile.pk}/')
        
        self.assertEqual(response.status_code, 200)
        self.assertFalse(User.objects.filter(profile=esner_profile.email).exists())
```

---

### 6. POST `/backend/document/`
**Descrizione**: Crea nuovo documento
**Autenticazione**: Sì
**Permessi**: Tutti autenticati

#### Scenari di Test

| ID | Scenario | Input | Expected | Status |
|----|----------|-------|----------|--------|
| P-DC-001 | Crea documento valido | tutti i campi | Documento creato | 200 |
| P-DC-002 | Crea documento duplicato | number già esistente | Errore unique | 400 |
| P-DC-003 | Crea documento senza tipo | type mancante | Errore validazione | 400 |

```python
class DocumentCreationTestCase(BaseTestCase):
    
    def test_create_document_with_valid_data_succeeds(self):
        """P-DC-001: Crea documento con dati validi ha successo"""
        user = self.create_base_user()
        self.authenticate_user(user)
        
        profile = self.create_profile('erasmus@test.com', is_esner=False)
        
        response = self.client.post('/backend/document/', {
            'profile': profile.pk,
            'type': 'Passport',
            'number': 'NEW12345',
            'expiration': '2030-01-01'
        })
        
        self.assertEqual(response.status_code, 200)
    
    def test_create_duplicate_document_number_returns_400(self):
        """P-DC-002: Documento con numero duplicato ritorna 400"""
        from profiles.models import Document
        
        user = self.create_base_user()
        self.authenticate_user(user)
        
        profile1 = self.create_profile('erasmus1@test.com', is_esner=False)
        Document.objects.create(profile=profile1, type='Passport', number='SAME123', expiration='2030-01-01')
        
        profile2 = self.create_profile('erasmus2@test.com', is_esner=False)
        
        response = self.client.post('/backend/document/', {
            'profile': profile2.pk,
            'type': 'ID Card',
            'number': 'SAME123',
            'expiration': '2030-01-01'
        })
        
        self.assertEqual(response.status_code, 400)
```

---

### 7. PATCH/DELETE `/backend/document/<pk>/`
**Descrizione**: Modifica/Elimina documento
**Autenticazione**: Sì
**Permessi**: PATCH richiede `profiles.change_document`, DELETE richiede `profiles.delete_document`

#### Scenari di Test

| ID | Scenario | User | Expected | Status |
|----|----------|------|----------|--------|
| P-DD-001 | PATCH con permesso | Con permesso | Aggiornato | 200 |
| P-DD-002 | PATCH senza permesso | Aspirante | "Non hai i permessi" | 403 |
| P-DD-003 | DELETE con permesso | Con permesso | Eliminato | 200 |
| P-DD-004 | DELETE documento inesistente | Con permesso | "Il documento non esiste" | 404 |

---

### 8. GET `/backend/profiles/search/`
**Descrizione**: Ricerca profili per nome/cognome/ESNcard
**Autenticazione**: Sì
**Permessi**: Tutti autenticati

#### Parametri Query
- `q`: query di ricerca (min 2 caratteri)
- `valid_only`: solo profili attivi (true/false)
- `esner_only`: solo ESNers (true/false)

#### Scenari di Test

| ID | Scenario | Query Params | Expected | Status |
|----|----------|--------------|----------|--------|
| P-PS-001 | Ricerca con query valida | q=Mario | Risultati matching | 200 |
| P-PS-002 | Ricerca query troppo corta | q=M | Lista vuota | 200 |
| P-PS-003 | Ricerca solo ESNers | q=Test&esner_only=true | Solo ESNers | 200 |
| P-PS-004 | Ricerca per ESNcard | q=IT123 | Profili con card | 200 |

```python
class ProfileSearchTestCase(BaseTestCase):
    
    def test_search_with_valid_query_returns_results(self):
        """P-PS-001: Ricerca con query valida ritorna risultati"""
        user = self.create_base_user()
        self.authenticate_user(user)
        
        self.create_profile('mario@test.com', is_esner=False, name='Mario', surname='Rossi')
        self.create_profile('luigi@test.com', is_esner=False, name='Luigi', surname='Bianchi')
        
        response = self.client.get('/backend/profiles/search/?q=Mario')
        
        self.assertEqual(response.status_code, 200)
        self.assertTrue(len(response.data['results']) > 0)
    
    def test_search_with_short_query_returns_empty(self):
        """P-PS-002: Ricerca con query corta ritorna vuoto"""
        user = self.create_base_user()
        self.authenticate_user(user)
        
        response = self.client.get('/backend/profiles/search/?q=M')
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['results'], [])
```

---

### 9. POST `/backend/check_erasmus_email/`
**Descrizione**: Verifica se email appartiene a Erasmus (pubblico)
**Autenticazione**: No
**Permessi**: Pubblico

#### Scenari di Test

| ID | Scenario | Input | Expected | Status |
|----|----------|-------|----------|--------|
| P-CE-001 | Email Erasmus attivo | email esistente | id, email, esncard_number | 200 |
| P-CE-002 | Email non esistente | email nuova | error: email_not_found | 200 |
| P-CE-003 | Email non attiva | email non verificata | error: email_not_active | 200 |
| P-CE-004 | Email mancante | - | "Email required" | 400 |

```python
class CheckErasmusEmailTestCase(BaseTestCase):
    
    def test_check_active_erasmus_returns_profile_data(self):
        """P-CE-001: Email Erasmus attivo ritorna dati profilo"""
        profile = self.create_profile('erasmus@test.com', is_esner=False)
        
        response = self.client.post('/backend/check_erasmus_email/', {
            'email': 'erasmus@test.com'
        })
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['id'], profile.id)
        self.assertEqual(response.data['email'], 'erasmus@test.com')
    
    def test_check_nonexistent_email_returns_not_found(self):
        """P-CE-002: Email non esistente ritorna errore"""
        response = self.client.post('/backend/check_erasmus_email/', {
            'email': 'nonexistent@test.com'
        })
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['error'], 'email_not_found')
```

---

### 10. GET `/backend/profile_subscriptions/<pk>/`
**Descrizione**: Lista iscrizioni di un profilo
**Autenticazione**: Sì
**Permessi**: Tutti autenticati

```python
class ProfileSubscriptionsTestCase(BaseTestCase):
    
    def test_get_subscriptions_for_profile_returns_list(self):
        """Test lista iscrizioni per profilo"""
        from events.models import Event, EventList, Subscription
        
        user = self.create_base_user()
        self.authenticate_user(user)
        
        profile = self.create_profile('erasmus@test.com', is_esner=False)
        event = Event.objects.create(name='Test', date='2025-06-01')
        event_list = EventList.objects.create(name='ML', is_main_list=True)
        event_list.events.add(event)
        Subscription.objects.create(profile=profile, event=event, list=event_list)
        
        response = self.client.get(f'/backend/profile_subscriptions/{profile.pk}/')
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
```

---

## Model Property Tests

```python
class ProfileModelTestCase(TestCase):
    
    def test_latest_esncard_returns_most_recent(self):
        """Test che latest_esncard ritorna la più recente"""
        from profiles.models import Profile
        from treasury.models import ESNcard
        
        profile = Profile.objects.create(
            email='test@test.com', name='Test', surname='User',
            email_is_verified=True, enabled=True
        )
        
        card1 = ESNcard.objects.create(profile=profile, number='OLD123')
        card2 = ESNcard.objects.create(profile=profile, number='NEW456')
        
        self.assertEqual(profile.latest_esncard, card2)
    
    def test_latest_document_returns_most_recent_enabled(self):
        """Test che latest_document ritorna il più recente enabled"""
        from profiles.models import Profile, Document
        
        profile = Profile.objects.create(
            email='test@test.com', name='Test', surname='User',
            email_is_verified=True, enabled=True
        )
        
        doc1 = Document.objects.create(
            profile=profile, type='Passport', number='DOC1',
            expiration='2030-01-01', enabled=True
        )
        doc2 = Document.objects.create(
            profile=profile, type='ID Card', number='DOC2',
            expiration='2030-01-01', enabled=False  # Disabled
        )
        
        self.assertEqual(profile.latest_document, doc1)


class DocumentModelTestCase(TestCase):
    
    def test_is_valid_returns_true_for_future_expiration(self):
        """Test che is_valid ritorna True per documento non scaduto"""
        from profiles.models import Profile, Document
        
        profile = Profile.objects.create(
            email='test@test.com', name='Test', surname='User',
            email_is_verified=True, enabled=True
        )
        doc = Document.objects.create(
            profile=profile, type='Passport', number='TEST123',
            expiration='2030-01-01'
        )
        
        self.assertTrue(doc.is_valid)
    
    def test_is_valid_returns_false_for_past_expiration(self):
        """Test che is_valid ritorna False per documento scaduto"""
        from profiles.models import Profile, Document
        
        profile = Profile.objects.create(
            email='test@test.com', name='Test', surname='User',
            email_is_verified=True, enabled=True
        )
        doc = Document.objects.create(
            profile=profile, type='Passport', number='TEST123',
            expiration='2020-01-01'
        )
        
        self.assertFalse(doc.is_valid)
```

---

## Checklist Test Coverage

- [ ] Lista profili con tutti i filtri
- [ ] Flusso registrazione ESNer completo
- [ ] Flusso registrazione Erasmus completo
- [ ] Verifica email con token
- [ ] CRUD profili con permessi
- [ ] CRUD documenti con permessi
- [ ] Ricerca profili
- [ ] Check email Erasmus
- [ ] Cambio gruppi con regole di permesso
- [ ] Placeholder zeros -> null
- [ ] Model properties (latest_esncard, latest_document, is_valid)

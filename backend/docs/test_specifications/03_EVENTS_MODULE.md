# 03 - Events Module Test Specifications

## Panoramica Modulo

Il modulo `events` gestisce:
- Eventi e Liste Eventi
- Iscrizioni (Subscriptions)
- Form dinamici con campi personalizzati
- Integrazione pagamenti SumUp
- Organizzatori eventi
- Liberatorie PDF
- Servizi selezionabili

---

## File del Modulo

| File | Descrizione |
|------|-------------|
| `models.py` | Models Event, EventList, Subscription, EventOrganizer |
| `views.py` | Endpoint CRUD eventi e iscrizioni (~2085 linee) |
| `serializers.py` | Serializers complessi con nested data |
| `urls.py` | Route del modulo |

---

## Modelli

### Event
```python
class Event(models.Model):
    id = AutoField(primary_key=True)
    name = CharField(max_length=100)
    description = CharField(max_length=4096, null=True)
    date = DateField()
    time = TimeField(null=True)
    location = CharField(max_length=200, null=True)
    gmap_link = URLField(null=True)
    image = URLField(null=True)
    enabled = BooleanField(default=True)
    available_services = JSONField(null=True)  # Array di servizi disponibili
    form = JSONField(null=True)                 # Schema form dinamico
    event_type = CharField(choices=['event', 'trip'], default='event')
```

### EventList
```python
class EventList(models.Model):
    id = AutoField(primary_key=True)
    events = ManyToManyField(Event)
    name = CharField(max_length=100)
    capacity = PositiveIntegerField()
    is_main_list = BooleanField(default=False)
    is_open = BooleanField(default=True)
    price = DecimalField(default=0.00)
    deposit = DecimalField(default=0.00)
    selling_date = DateTimeField(null=True)
    end_selling_date = DateTimeField(null=True)
    sold = PositiveIntegerField(default=0)
    enabled = BooleanField(default=True)
```

### Subscription
```python
class Subscription(models.Model):
    id = AutoField(primary_key=True)
    profile = ForeignKey(Profile)
    event = ForeignKey(Event)
    list = ForeignKey(EventList)
    selected_services = JSONField(null=True)   # Servizi selezionati
    form_data = JSONField(null=True)           # Risposte form
    pending_payment = BooleanField(default=False)
    payment_id = CharField(null=True)
    payment_confirmed = BooleanField(default=False)
    refunded = BooleanField(default=False)
    deposit_payed = BooleanField(default=False)
    payed = BooleanField(default=False)
    liberatoria = BooleanField(default=False)
    notes = TextField(null=True)
    subscription_date = DateTimeField(auto_now_add=True)
```

### EventOrganizer
```python
class EventOrganizer(models.Model):
    event = ForeignKey(Event)
    user = ForeignKey(User)
```

---

## Endpoints

### 1. GET `/backend/events/`
**Descrizione**: Lista eventi con paginazione
**Autenticazione**: No (pubblico)

#### Parametri Query
- `page`, `page_size`: paginazione
- `ordering`: ordinamento
- `event_type`: filtro tipo (event/trip)

#### Scenari di Test

| ID | Scenario | Query Params | Expected | Status |
|----|----------|--------------|----------|--------|
| E-EL-001 | Lista eventi pubblici | - | Solo enabled=True | 200 |
| E-EL-002 | Filtro tipo event | event_type=event | Solo eventi | 200 |
| E-EL-003 | Filtro tipo trip | event_type=trip | Solo viaggi | 200 |
| E-EL-004 | Include has_lists flag | - | Flag per ogni evento | 200 |

```python
class EventListTestCase(TestCase):
    
    def test_list_events_returns_only_enabled(self):
        """E-EL-001: Lista eventi ritorna solo enabled"""
        from events.models import Event
        
        Event.objects.create(name='Active', date='2025-06-01', enabled=True)
        Event.objects.create(name='Disabled', date='2025-06-01', enabled=False)
        
        response = self.client.get('/backend/events/')
        
        self.assertEqual(response.status_code, 200)
        names = [e['name'] for e in response.data['results']]
        self.assertIn('Active', names)
        self.assertNotIn('Disabled', names)
    
    def test_filter_by_event_type(self):
        """E-EL-002: Filtro per tipo event funziona"""
        from events.models import Event
        
        Event.objects.create(name='Party', date='2025-06-01', event_type='event')
        Event.objects.create(name='Barcelona', date='2025-06-01', event_type='trip')
        
        response = self.client.get('/backend/events/?event_type=event')
        
        self.assertEqual(response.status_code, 200)
        self.assertTrue(all(e['event_type'] == 'event' for e in response.data['results']))
```

---

### 2. POST `/backend/events/`
**Descrizione**: Crea nuovo evento
**Autenticazione**: Sì
**Permessi**: `events.add_event`

#### Scenari di Test

| ID | Scenario | User | Input | Expected | Status |
|----|----------|------|-------|----------|--------|
| E-EC-001 | Crea evento base | Board | name, date | Evento creato | 201 |
| E-EC-002 | Crea evento con servizi | Board | + available_services | Servizi salvati | 201 |
| E-EC-003 | Crea evento con form | Board | + form JSON | Form salvato | 201 |
| E-EC-004 | Crea senza permesso | Aspiranti | dati | Forbidden | 403 |
| E-EC-005 | Crea con date passata | Board | date nel passato | Evento creato | 201 |

```python
class EventCreationTestCase(BaseTestCase):
    
    def test_create_event_with_services(self):
        """E-EC-002: Crea evento con servizi disponibili"""
        board = self.create_board_user()
        self.authenticate_user(board)
        
        response = self.client.post('/backend/events/', {
            'name': 'Trip to Barcelona',
            'date': '2025-07-15',
            'event_type': 'trip',
            'available_services': [
                {'name': 'Bus', 'price': 50},
                {'name': 'Hotel', 'price': 100},
                {'name': 'Guide', 'price': 20}
            ]
        }, format='json')
        
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.data['available_services']), 3)
    
    def test_create_event_with_dynamic_form(self):
        """E-EC-003: Crea evento con form dinamico"""
        board = self.create_board_user()
        self.authenticate_user(board)
        
        form_schema = {
            'fields': [
                {'name': 'tshirt_size', 'type': 'select', 'options': ['S', 'M', 'L', 'XL'], 'required': True},
                {'name': 'food_allergies', 'type': 'text', 'required': False},
                {'name': 'emergency_contact', 'type': 'text', 'required': True}
            ]
        }
        
        response = self.client.post('/backend/events/', {
            'name': 'Summer Camp',
            'date': '2025-08-01',
            'form': form_schema
        }, format='json')
        
        self.assertEqual(response.status_code, 201)
        self.assertIsNotNone(response.data['form'])
```

---

### 3. GET `/backend/events/<pk>/`
**Descrizione**: Dettaglio evento
**Autenticazione**: No (pubblico)

#### Scenari di Test

| ID | Scenario | Expected | Status |
|----|----------|----------|--------|
| E-ED-001 | GET evento esistente | Dettagli completi + liste | 200 |
| E-ED-002 | GET evento inesistente | Not found | 404 |
| E-ED-003 | GET include subscriptions_count | Count iscrizioni | 200 |

---

### 4. PATCH `/backend/events/<pk>/`
**Descrizione**: Modifica evento
**Autenticazione**: Sì
**Permessi**: `events.change_event`

#### Scenari di Test

| ID | Scenario | Input | Expected | Status |
|----|----------|-------|----------|--------|
| E-EU-001 | Aggiorna nome | name | Nome aggiornato | 200 |
| E-EU-002 | Aggiorna servizi | available_services | Servizi aggiornati | 200 |
| E-EU-003 | Disabilita evento | enabled=False | Evento disabilitato | 200 |
| E-EU-004 | Aggiorna senza permesso | - | Forbidden | 403 |

---

### 5. DELETE `/backend/events/<pk>/`
**Descrizione**: Elimina evento
**Autenticazione**: Sì
**Permessi**: `events.delete_event`

#### Scenari di Test

| ID | Scenario | Preconditions | Expected | Status |
|----|----------|---------------|----------|--------|
| E-EDE-001 | Elimina evento senza iscrizioni | Nessuna iscrizione | Eliminato | 200 |
| E-EDE-002 | Elimina evento con iscrizioni | Iscrizioni presenti | "Elimina prima" | 400 |
| E-EDE-003 | Elimina senza permesso | No permission | Forbidden | 403 |

```python
class EventDeleteTestCase(BaseTestCase):
    
    def test_delete_event_with_subscriptions_returns_error(self):
        """E-EDE-002: Elimina evento con iscrizioni ritorna errore"""
        from events.models import Event, EventList, Subscription
        from profiles.models import Profile
        
        board = self.create_board_user()
        self.authenticate_user(board)
        
        event = Event.objects.create(name='Test', date='2025-06-01')
        event_list = EventList.objects.create(
            name='Main', capacity=100, is_main_list=True, price=10
        )
        event_list.events.add(event)
        
        profile = Profile.objects.create(
            email='test@test.com', name='Test', surname='User',
            email_is_verified=True, enabled=True
        )
        Subscription.objects.create(profile=profile, event=event, list=event_list)
        
        response = self.client.delete(f'/backend/events/{event.pk}/')
        
        self.assertEqual(response.status_code, 400)
```

---

### 6. GET `/backend/event_lists/`
**Descrizione**: Lista delle EventList
**Autenticazione**: Sì
**Permessi**: Autenticati

---

### 7. POST `/backend/event_lists/`
**Descrizione**: Crea nuova EventList
**Autenticazione**: Sì
**Permessi**: `events.add_eventlist`

#### Scenari di Test

| ID | Scenario | Input | Expected | Status |
|----|----------|-------|----------|--------|
| E-LC-001 | Crea lista base | name, capacity, event_ids | Lista creata | 201 |
| E-LC-002 | Crea lista main | is_main_list=True | Solo una main per evento | 201 |
| E-LC-003 | Crea con selling_date | date futura | Lista con apertura programmata | 201 |
| E-LC-004 | Crea con prezzo e deposito | price, deposit | Prezzi salvati | 201 |

```python
class EventListCreationTestCase(BaseTestCase):
    
    def test_create_list_with_selling_dates(self):
        """E-LC-003: Crea lista con date di vendita"""
        from events.models import Event
        
        board = self.create_board_user()
        self.authenticate_user(board)
        
        event = Event.objects.create(name='Test', date='2025-06-01')
        
        response = self.client.post('/backend/event_lists/', {
            'name': 'Early Bird',
            'capacity': 50,
            'event_ids': [event.pk],
            'price': '25.00',
            'deposit': '10.00',
            'selling_date': '2025-05-01T00:00:00Z',
            'end_selling_date': '2025-05-15T23:59:59Z'
        }, format='json')
        
        self.assertEqual(response.status_code, 201)
        self.assertIsNotNone(response.data['selling_date'])
```

---

### 8. GET/PATCH/DELETE `/backend/event_lists/<pk>/`
**Descrizione**: Dettaglio/Modifica/Elimina EventList
**Autenticazione**: Sì
**Permessi**: Rispettivi permessi CRUD

---

### 9. GET `/backend/subscriptions/`
**Descrizione**: Lista iscrizioni
**Autenticazione**: Sì

#### Parametri Query
- `event`: ID evento
- `list`: ID lista
- `profile`: ID profilo
- `payed`: filtro pagato
- `deposit_payed`: filtro deposito pagato

```python
class SubscriptionListTestCase(BaseTestCase):
    
    def test_filter_by_event_returns_correct_subscriptions(self):
        """Test filtro per evento"""
        from events.models import Event, EventList, Subscription
        
        user = self.create_base_user()
        self.authenticate_user(user)
        
        event1 = Event.objects.create(name='Event1', date='2025-06-01')
        event2 = Event.objects.create(name='Event2', date='2025-06-02')
        
        # Setup lists and subscriptions
        list1 = EventList.objects.create(name='L1', capacity=100, is_main_list=True)
        list1.events.add(event1)
        list2 = EventList.objects.create(name='L2', capacity=100, is_main_list=True)
        list2.events.add(event2)
        
        profile = self.create_profile('test@test.com', is_esner=False)
        Subscription.objects.create(profile=profile, event=event1, list=list1)
        Subscription.objects.create(profile=profile, event=event2, list=list2)
        
        response = self.client.get(f'/backend/subscriptions/?event={event1.pk}')
        
        self.assertEqual(response.status_code, 200)
        self.assertTrue(all(s['event'] == event1.pk for s in response.data['results']))
```

---

### 10. POST `/backend/subscriptions/`
**Descrizione**: Crea iscrizione (endpoint per ESNers)
**Autenticazione**: Sì
**Permessi**: `events.add_subscription`

#### Scenari di Test

| ID | Scenario | Input | Expected | Status |
|----|----------|-------|----------|--------|
| E-SC-001 | Crea iscrizione valida | profile_id, event_id, list_id | Iscrizione creata | 201 |
| E-SC-002 | Iscrizione duplicata | stesso profile/event | Errore "già iscritto" | 400 |
| E-SC-003 | Lista piena | sold >= capacity | Errore "lista piena" | 400 |
| E-SC-004 | Lista non aperta | selling_date futuro | Errore | 400 |
| E-SC-005 | Lista chiusa | is_open=False | Errore | 400 |
| E-SC-006 | Con servizi selezionati | + selected_services | Servizi salvati | 201 |
| E-SC-007 | Con form_data | + form_data | Dati form salvati | 201 |

```python
class SubscriptionCreationTestCase(BaseTestCase):
    
    def test_create_subscription_increments_sold_count(self):
        """E-SC-001: Creare iscrizione incrementa contatore sold"""
        from events.models import Event, EventList
        
        board = self.create_board_user()
        self.authenticate_user(board)
        
        event = Event.objects.create(name='Test', date='2025-06-01')
        event_list = EventList.objects.create(
            name='Main', capacity=100, is_main_list=True, sold=5
        )
        event_list.events.add(event)
        
        profile = self.create_profile('erasmus@test.com', is_esner=False)
        
        response = self.client.post('/backend/subscriptions/', {
            'profile': profile.pk,
            'event': event.pk,
            'list': event_list.pk
        })
        
        self.assertEqual(response.status_code, 201)
        
        event_list.refresh_from_db()
        self.assertEqual(event_list.sold, 6)
    
    def test_duplicate_subscription_returns_error(self):
        """E-SC-002: Iscrizione duplicata ritorna errore"""
        from events.models import Event, EventList, Subscription
        
        board = self.create_board_user()
        self.authenticate_user(board)
        
        event = Event.objects.create(name='Test', date='2025-06-01')
        event_list = EventList.objects.create(
            name='Main', capacity=100, is_main_list=True
        )
        event_list.events.add(event)
        
        profile = self.create_profile('erasmus@test.com', is_esner=False)
        Subscription.objects.create(profile=profile, event=event, list=event_list)
        
        response = self.client.post('/backend/subscriptions/', {
            'profile': profile.pk,
            'event': event.pk,
            'list': event_list.pk
        })
        
        self.assertEqual(response.status_code, 400)
    
    def test_subscription_to_full_list_returns_error(self):
        """E-SC-003: Iscrizione a lista piena ritorna errore"""
        from events.models import Event, EventList
        
        board = self.create_board_user()
        self.authenticate_user(board)
        
        event = Event.objects.create(name='Test', date='2025-06-01')
        event_list = EventList.objects.create(
            name='Main', capacity=10, is_main_list=True, sold=10  # FULL
        )
        event_list.events.add(event)
        
        profile = self.create_profile('erasmus@test.com', is_esner=False)
        
        response = self.client.post('/backend/subscriptions/', {
            'profile': profile.pk,
            'event': event.pk,
            'list': event_list.pk
        })
        
        self.assertEqual(response.status_code, 400)
        self.assertIn('piena', str(response.data).lower())
```

---

### 11. PATCH `/backend/subscriptions/<pk>/`
**Descrizione**: Modifica iscrizione
**Autenticazione**: Sì
**Permessi**: `events.change_subscription`

#### Scenari di Test

| ID | Scenario | Input | Expected | Status |
|----|----------|-------|----------|--------|
| E-SU-001 | Aggiorna note | notes | Note aggiornate | 200 |
| E-SU-002 | Segna pagato | payed=True | payed=True | 200 |
| E-SU-003 | Segna deposito pagato | deposit_payed=True | Flag aggiornato | 200 |
| E-SU-004 | Segna liberatoria | liberatoria=True | Flag aggiornato | 200 |
| E-SU-005 | Aggiorna servizi | selected_services | Servizi aggiornati | 200 |
| E-SU-006 | Aggiorna senza permesso | - | Forbidden | 403 |

---

### 12. DELETE `/backend/subscriptions/<pk>/`
**Descrizione**: Elimina iscrizione
**Autenticazione**: Sì
**Permessi**: `events.delete_subscription`

#### Scenari di Test

| ID | Scenario | Preconditions | Expected | Status |
|----|----------|---------------|----------|--------|
| E-SD-001 | Elimina iscrizione | Iscrizione esistente | Eliminata, sold-- | 200 |
| E-SD-002 | Elimina decrementa sold | sold=5 | sold=4 | 200 |
| E-SD-003 | Elimina senza permesso | No permission | Forbidden | 403 |

```python
class SubscriptionDeleteTestCase(BaseTestCase):
    
    def test_delete_subscription_decrements_sold(self):
        """E-SD-002: Eliminare iscrizione decrementa contatore sold"""
        from events.models import Event, EventList, Subscription
        
        board = self.create_board_user()
        self.authenticate_user(board)
        
        event = Event.objects.create(name='Test', date='2025-06-01')
        event_list = EventList.objects.create(
            name='Main', capacity=100, is_main_list=True, sold=5
        )
        event_list.events.add(event)
        
        profile = self.create_profile('erasmus@test.com', is_esner=False)
        subscription = Subscription.objects.create(
            profile=profile, event=event, list=event_list
        )
        
        response = self.client.delete(f'/backend/subscriptions/{subscription.pk}/')
        
        self.assertEqual(response.status_code, 200)
        
        event_list.refresh_from_db()
        self.assertEqual(event_list.sold, 4)
```

---

### 13. POST `/backend/submit_form/<event_pk>/`
**Descrizione**: Sottomissione form pubblico (Erasmus self-registration)
**Autenticazione**: No (pubblico)

#### Request Body
```json
{
    "email": "erasmus@university.edu",
    "list_id": 1,
    "form_data": {
        "tshirt_size": "M",
        "food_allergies": "None"
    },
    "selected_services": ["Bus", "Hotel"]
}
```

#### Scenari di Test

| ID | Scenario | Input | Expected | Status |
|----|----------|-------|----------|--------|
| E-SF-001 | Submit form valido | tutti i campi | Iscrizione creata, email sent | 200 |
| E-SF-002 | Submit email non esistente | email non in DB | Errore | 400 |
| E-SF-003 | Submit lista piena | lista sold=capacity | Errore | 400 |
| E-SF-004 | Submit già iscritto | profile già iscritto | Errore | 400 |
| E-SF-005 | Submit form required mancanti | manca campo required | Errore validazione | 400 |
| E-SF-006 | Submit evento senza form | evento form=null | Solo lista | 200 |

```python
class SubmitFormTestCase(TestCase):
    
    def test_submit_form_creates_subscription_and_sends_email(self):
        """E-SF-001: Submit form crea iscrizione e invia email"""
        from django.core import mail
        from events.models import Event, EventList
        from profiles.models import Profile
        
        event = Event.objects.create(
            name='Party',
            date='2025-06-01',
            form={'fields': [{'name': 'tshirt', 'type': 'select', 'options': ['S', 'M', 'L']}]}
        )
        event_list = EventList.objects.create(
            name='Main', capacity=100, is_main_list=True, is_open=True
        )
        event_list.events.add(event)
        
        profile = Profile.objects.create(
            email='erasmus@test.com', name='Test', surname='User',
            email_is_verified=True, enabled=True
        )
        
        response = self.client.post(f'/backend/submit_form/{event.pk}/', {
            'email': 'erasmus@test.com',
            'list_id': event_list.pk,
            'form_data': {'tshirt': 'M'}
        }, format='json')
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)  # Confirmation email
```

---

### 14. POST `/backend/sumup/checkout/<subscription_pk>/`
**Descrizione**: Inizia pagamento SumUp per iscrizione
**Autenticazione**: No (pubblico, link diretto)

#### Scenari di Test (MOCK SumUp)

| ID | Scenario | Preconditions | Expected | Status |
|----|----------|---------------|----------|--------|
| E-SUM-001 | Crea checkout valido | Iscrizione non pagata | checkout_id returned | 200 |
| E-SUM-002 | Checkout già pagato | payed=True | Errore "già pagato" | 400 |
| E-SUM-003 | Checkout già in pending | pending_payment=True | Errore | 400 |

```python
class SumUpCheckoutTestCase(TestCase):
    
    @patch('events.views.requests.post')
    def test_create_checkout_returns_checkout_id(self, mock_post):
        """E-SUM-001: Crea checkout ritorna checkout_id"""
        from events.models import Event, EventList, Subscription
        from profiles.models import Profile
        
        # Mock SumUp response
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {
            'id': 'checkout_123',
            'checkout_reference': 'ref_123'
        }
        
        event = Event.objects.create(name='Test', date='2025-06-01')
        event_list = EventList.objects.create(
            name='Main', capacity=100, is_main_list=True, price=25
        )
        event_list.events.add(event)
        
        profile = Profile.objects.create(
            email='test@test.com', name='Test', surname='User',
            email_is_verified=True, enabled=True
        )
        subscription = Subscription.objects.create(
            profile=profile, event=event, list=event_list,
            payed=False, pending_payment=False
        )
        
        response = self.client.post(f'/backend/sumup/checkout/{subscription.pk}/')
        
        self.assertEqual(response.status_code, 200)
        self.assertIn('checkout_id', response.data)
```

---

### 15. POST `/backend/sumup/complete/<subscription_pk>/`
**Descrizione**: Completa pagamento SumUp (webhook o redirect)
**Autenticazione**: No

#### Scenari di Test (MOCK SumUp)

| ID | Scenario | Input | Expected | Status |
|----|----------|-------|----------|--------|
| E-SUMC-001 | Pagamento completato | checkout_id valido | payed=True, transaction creata | 200 |
| E-SUMC-002 | Pagamento fallito | status=FAILED | pending_payment=False | 200 |
| E-SUMC-003 | Checkout non trovato | checkout_id invalido | Errore | 400 |

```python
class SumUpCompleteTestCase(TestCase):
    
    @patch('events.views.requests.get')
    def test_complete_payment_creates_transaction(self, mock_get):
        """E-SUMC-001: Pagamento completato crea transazione"""
        from events.models import Event, EventList, Subscription
        from profiles.models import Profile
        from treasury.models import Transaction
        
        # Mock SumUp status check
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = {
            'status': 'PAID',
            'amount': 25.00,
            'checkout_reference': 'ref_123',
            'transactions': [{'payment_type': 'CARD'}]
        }
        
        event = Event.objects.create(name='Test', date='2025-06-01')
        event_list = EventList.objects.create(
            name='Main', capacity=100, is_main_list=True, price=25
        )
        event_list.events.add(event)
        
        profile = Profile.objects.create(
            email='test@test.com', name='Test', surname='User',
            email_is_verified=True, enabled=True
        )
        subscription = Subscription.objects.create(
            profile=profile, event=event, list=event_list,
            payed=False, pending_payment=True, payment_id='checkout_123'
        )
        
        response = self.client.post(f'/backend/sumup/complete/{subscription.pk}/')
        
        self.assertEqual(response.status_code, 200)
        
        subscription.refresh_from_db()
        self.assertTrue(subscription.payed)
        self.assertTrue(subscription.payment_confirmed)
        
        # Verifica transazione creata
        transaction = Transaction.objects.filter(
            subscription=subscription
        ).first()
        self.assertIsNotNone(transaction)
```

---

### 16. POST `/backend/move_subscriptions/`
**Descrizione**: Sposta iscrizioni da una lista all'altra
**Autenticazione**: Sì
**Permessi**: `events.change_subscription`

#### Request Body
```json
{
    "from_list_id": 1,
    "to_list_id": 2,
    "subscription_ids": [1, 2, 3]
}
```

#### Scenari di Test

| ID | Scenario | Input | Expected | Status |
|----|----------|-------|----------|--------|
| E-MS-001 | Sposta iscrizioni valide | ids esistenti | Iscrizioni spostate | 200 |
| E-MS-002 | Sposta a lista piena | target piena | Errore | 400 |
| E-MS-003 | Lista target non esiste | to_list_id invalido | Errore | 400 |
| E-MS-004 | Aggiorna sold count | - | from--, to++ | 200 |

```python
class MoveSubscriptionsTestCase(BaseTestCase):
    
    def test_move_subscriptions_updates_sold_counts(self):
        """E-MS-004: Spostare iscrizioni aggiorna contatori sold"""
        from events.models import Event, EventList, Subscription
        
        board = self.create_board_user()
        self.authenticate_user(board)
        
        event = Event.objects.create(name='Test', date='2025-06-01')
        
        from_list = EventList.objects.create(
            name='From', capacity=100, is_main_list=True, sold=5
        )
        from_list.events.add(event)
        
        to_list = EventList.objects.create(
            name='To', capacity=100, is_main_list=False, sold=2
        )
        to_list.events.add(event)
        
        profile = self.create_profile('test@test.com', is_esner=False)
        sub = Subscription.objects.create(
            profile=profile, event=event, list=from_list
        )
        
        response = self.client.post('/backend/move_subscriptions/', {
            'from_list_id': from_list.pk,
            'to_list_id': to_list.pk,
            'subscription_ids': [sub.pk]
        }, format='json')
        
        self.assertEqual(response.status_code, 200)
        
        from_list.refresh_from_db()
        to_list.refresh_from_db()
        
        self.assertEqual(from_list.sold, 4)
        self.assertEqual(to_list.sold, 3)
```

---

### 17. GET `/backend/liberatorie/<event_pk>/`
**Descrizione**: Genera PDF liberatorie per evento
**Autenticazione**: Sì
**Permessi**: Autenticato

#### Scenari di Test

| ID | Scenario | Preconditions | Expected | Status |
|----|----------|---------------|----------|--------|
| E-LIB-001 | Genera PDF evento con iscrizioni | Iscrizioni presenti | PDF generato | 200 |
| E-LIB-002 | Genera PDF evento senza iscrizioni | Nessuna iscrizione | PDF vuoto/errore | 200 |

---

### 18. EventOrganizer Endpoints

#### POST `/backend/organizers/`
**Descrizione**: Aggiunge organizzatore a evento
**Autenticazione**: Sì
**Permessi**: `events.add_eventorganizer`

#### DELETE `/backend/organizers/<pk>/`
**Descrizione**: Rimuove organizzatore
**Permessi**: `events.delete_eventorganizer`

```python
class EventOrganizerTestCase(BaseTestCase):
    
    def test_add_organizer_to_event(self):
        """Test aggiunta organizzatore"""
        from events.models import Event
        
        board = self.create_board_user()
        self.authenticate_user(board)
        
        event = Event.objects.create(name='Test', date='2025-06-01')
        user = self.create_base_user()
        
        response = self.client.post('/backend/organizers/', {
            'event': event.pk,
            'user': user.pk
        })
        
        self.assertEqual(response.status_code, 201)
    
    def test_organizer_can_view_event_subscriptions(self):
        """Test che organizzatore può vedere iscrizioni evento"""
        # Test che organizzatore ha accesso speciale
        pass
```

---

## Integration Tests - Flusso Completo

### Test Flusso Registrazione Erasmus
```python
class ErasmusSubscriptionFlowTestCase(TestCase):
    """Test del flusso completo: registrazione -> iscrizione -> pagamento"""
    
    def test_complete_erasmus_subscription_flow(self):
        """Test flusso completo Erasmus"""
        from django.core import mail
        from events.models import Event, EventList
        from profiles.models import Profile
        
        # 1. Crea evento con lista
        event = Event.objects.create(
            name='Welcome Party',
            date='2025-06-01',
            form={'fields': [{'name': 'diet', 'type': 'text'}]}
        )
        event_list = EventList.objects.create(
            name='Standard', capacity=100, is_main_list=True, price=15
        )
        event_list.events.add(event)
        
        # 2. Registra profilo Erasmus (simula già registrato e verificato)
        profile = Profile.objects.create(
            email='student@university.edu',
            name='John',
            surname='Doe',
            email_is_verified=True,
            enabled=True,
            is_esner=False
        )
        
        # 3. Submit form iscrizione
        response = self.client.post(f'/backend/submit_form/{event.pk}/', {
            'email': 'student@university.edu',
            'list_id': event_list.pk,
            'form_data': {'diet': 'Vegetarian'}
        }, format='json')
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)  # Confirmation email
        
        # 4. Verifica iscrizione creata
        from events.models import Subscription
        subscription = Subscription.objects.get(profile=profile, event=event)
        self.assertEqual(subscription.form_data['diet'], 'Vegetarian')
        self.assertFalse(subscription.payed)
```

### Test Flusso Pagamento
```python
class PaymentFlowTestCase(TestCase):
    """Test flusso pagamento SumUp"""
    
    @patch('events.views.requests.post')
    @patch('events.views.requests.get')
    def test_complete_payment_flow(self, mock_get, mock_post):
        """Test flusso checkout -> pagamento -> conferma"""
        from events.models import Event, EventList, Subscription
        from profiles.models import Profile
        
        # Setup mocks
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {
            'id': 'chk_123', 'checkout_reference': 'ref_123'
        }
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = {
            'status': 'PAID', 'amount': 15.00,
            'transactions': [{'payment_type': 'CARD'}]
        }
        
        # Setup data
        event = Event.objects.create(name='Test', date='2025-06-01')
        event_list = EventList.objects.create(
            name='Main', capacity=100, price=15
        )
        event_list.events.add(event)
        profile = Profile.objects.create(
            email='test@test.com', name='T', surname='U',
            email_is_verified=True, enabled=True
        )
        subscription = Subscription.objects.create(
            profile=profile, event=event, list=event_list
        )
        
        # 1. Crea checkout
        response = self.client.post(f'/backend/sumup/checkout/{subscription.pk}/')
        self.assertEqual(response.status_code, 200)
        
        # 2. Completa pagamento
        response = self.client.post(f'/backend/sumup/complete/{subscription.pk}/')
        self.assertEqual(response.status_code, 200)
        
        # 3. Verifica stato
        subscription.refresh_from_db()
        self.assertTrue(subscription.payed)
        self.assertTrue(subscription.payment_confirmed)
```

---

## Checklist Test Coverage

### Eventi
- [ ] CRUD eventi con permessi
- [ ] Filtri tipo evento
- [ ] Eventi con servizi disponibili
- [ ] Eventi con form dinamico
- [ ] Delete evento con/senza iscrizioni

### Liste Evento
- [ ] CRUD liste con permessi
- [ ] Date vendita (selling_date, end_selling_date)
- [ ] Contatore sold
- [ ] Stato is_open

### Iscrizioni
- [ ] Crea iscrizione (endpoint interno)
- [ ] Duplicati bloccati
- [ ] Lista piena bloccata
- [ ] Form data salvato
- [ ] Servizi selezionati salvati
- [ ] Aggiornamento note/flag
- [x] Eliminazione con sold--

### Form Submission
- [x] Submit pubblico valido
- [x] Validazione campi required
- [x] Email conferma inviata
- [x] Profilo non esistente

### SumUp Integration (MOCK)
- [x] Crea checkout
- [x] Completa pagamento
- [x] Gestione errori
- [x] Transazione creata

### Servizi (Services)
- [x] Event con servizi validi
- [x] Subscription con servizi selezionati
- [x] Validazione servizi sconosciuti
- [x] Validazione quantity zero/negativa
- [x] Calcolo costo servizi
- [x] Update servizi in subscription
- [x] Servizi con match by name
- [x] Servizi con prezzi decimali
- [x] Status services tracking

### Altri
- [x] Move subscriptions
- [x] Liberatorie PDF
- [x] Organizzatori evento

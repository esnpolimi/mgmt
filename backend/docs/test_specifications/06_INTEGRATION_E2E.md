# 06 - Integration & E2E Test Specifications

## Panoramica

Questo documento descrive i test di integrazione e End-to-End che coprono flussi completi attraverso più moduli.

---

## 🔄 Flussi Cross-Module

### 1. Flusso Completo Registrazione ESNer

**Moduli coinvolti**: profiles, users

```python
class ESNerRegistrationFlowTestCase(TestCase):
    """
    Flusso: 
    1. Registra profilo ESNer con email @esnpolimi.it
    2. Verifica email
    3. Login
    4. Accesso risorse autenticate
    """
    
    def test_complete_esner_registration_to_login(self):
        from django.core import mail
        from profiles.models import Profile
        from users.models import User
        from profiles.tokens import email_verification_token
        from django.utils.encoding import force_bytes
        from django.utils.http import urlsafe_base64_encode
        
        # 1. Registrazione
        response = self.client.post('/backend/profile/initiate-creation/', {
            'email': 'new.esner@esnpolimi.it',
            'name': 'Mario',
            'surname': 'Rossi',
            'birthdate': '1995-01-15',
            'country': 'IT',
            'is_esner': True,
            'password': 'SecurePass123!',
            'document_type': 'ID Card',
            'document_number': 'AB123456',
            'document_expiration': '2030-01-01'
        })
        
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(mail.outbox), 1)
        
        # Verifica profilo e user creati ma non attivi
        profile = Profile.objects.get(email='new.esner@esnpolimi.it')
        self.assertFalse(profile.email_is_verified)
        self.assertFalse(profile.enabled)
        
        user = User.objects.get(profile=profile)
        self.assertFalse(user.is_active)
        
        # 2. Verifica email
        uid = urlsafe_base64_encode(force_bytes(profile.pk))
        token = email_verification_token.make_token(profile)
        
        response = self.client.get(f'/backend/api/profile/verify-email/{uid}/{token}/')
        
        self.assertEqual(response.status_code, 200)
        
        profile.refresh_from_db()
        user.refresh_from_db()
        
        self.assertTrue(profile.email_is_verified)
        self.assertTrue(profile.enabled)
        self.assertTrue(user.is_active)
        
        # 3. Login
        response = self.client.post('/backend/api/login/', {
            'email': 'new.esner@esnpolimi.it',
            'password': 'SecurePass123!'
        })
        
        self.assertEqual(response.status_code, 200)
        self.assertIn('access', response.data)
        
        # 4. Accesso risorsa autenticata
        access_token = response.data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        
        response = self.client.get('/backend/erasmus_profiles/')
        
        self.assertEqual(response.status_code, 200)
```

---

### 2. Flusso Completo Registrazione Erasmus + Iscrizione Evento

**Moduli coinvolti**: profiles, events, treasury (opzionale per pagamento)

```python
class ErasmusEventSubscriptionFlowTestCase(TestCase):
    """
    Flusso:
    1. Registra profilo Erasmus
    2. Verifica email
    3. Iscrivi a evento tramite form pubblico
    4. Paga tramite SumUp (mock)
    """
    
    @patch('events.views.requests.post')
    @patch('events.views.requests.get')
    def test_erasmus_from_registration_to_paid_subscription(self, mock_get, mock_post):
        from django.core import mail
        from profiles.models import Profile
        from profiles.tokens import email_verification_token
        from django.utils.encoding import force_bytes
        from django.utils.http import urlsafe_base64_encode
        from events.models import Event, EventList, Subscription
        
        # Setup SumUp mocks
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {
            'id': 'chk_123', 'checkout_reference': 'ref_123'
        }
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = {
            'status': 'PAID', 'amount': 15.00,
            'transactions': [{'payment_type': 'CARD'}]
        }
        
        # 1. Crea evento con lista
        event = Event.objects.create(
            name='Welcome Party',
            date='2025-06-15',
            form={'fields': [{'name': 'diet', 'type': 'text'}]}
        )
        event_list = EventList.objects.create(
            name='Standard', capacity=100, is_main_list=True,
            price=15, is_open=True
        )
        event_list.events.add(event)
        
        # 2. Registra Erasmus
        response = self.client.post('/backend/profile/initiate-creation/', {
            'email': 'erasmus.student@university.edu',
            'name': 'John',
            'surname': 'Doe',
            'birthdate': '1998-05-20',
            'country': 'DE',
            'is_esner': False,
            'document_type': 'Passport',
            'document_number': 'DE12345678',
            'document_expiration': '2030-01-01'
        })
        
        self.assertEqual(response.status_code, 201)
        
        # 3. Verifica email
        profile = Profile.objects.get(email='erasmus.student@university.edu')
        uid = urlsafe_base64_encode(force_bytes(profile.pk))
        token = email_verification_token.make_token(profile)
        
        self.client.get(f'/backend/api/profile/verify-email/{uid}/{token}/')
        
        profile.refresh_from_db()
        self.assertTrue(profile.email_is_verified)
        
        # 4. Submit form evento
        mail.outbox.clear()
        
        response = self.client.post(f'/backend/submit_form/{event.pk}/', {
            'email': 'erasmus.student@university.edu',
            'list_id': event_list.pk,
            'form_data': {'diet': 'Vegetarian'}
        }, format='json')
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)  # Confirmation email
        
        subscription = Subscription.objects.get(profile=profile, event=event)
        self.assertFalse(subscription.payed)
        
        # 5. Inizia pagamento
        response = self.client.post(f'/backend/sumup/checkout/{subscription.pk}/')
        
        self.assertEqual(response.status_code, 200)
        
        subscription.refresh_from_db()
        self.assertTrue(subscription.pending_payment)
        
        # 6. Completa pagamento
        response = self.client.post(f'/backend/sumup/complete/{subscription.pk}/')
        
        self.assertEqual(response.status_code, 200)
        
        subscription.refresh_from_db()
        self.assertTrue(subscription.payed)
        self.assertTrue(subscription.payment_confirmed)
```

---

### 3. Flusso ESNcard con Quota Associativa

**Moduli coinvolti**: profiles, treasury

```python
class ESNcardMembershipFlowTestCase(BaseTestCase):
    """
    Flusso:
    1. Crea profilo Erasmus verificato
    2. Emetti ESNcard (include quota associativa automatica)
    3. Verifica transazioni create
    """
    
    def test_esncard_emission_with_membership_fee(self):
        from treasury.models import Account, ESNcard, Transaction, Settings
        from profiles.models import Profile
        
        # Setup
        Settings.objects.create(membership_fee=5, esncard_price=10)
        account = Account.objects.create(name='Cassa', type='cash', balance=0)
        
        profile = Profile.objects.create(
            email='erasmus@test.com',
            name='Test',
            surname='User',
            email_is_verified=True,
            enabled=True,
            is_esner=False
        )
        
        board = self.create_board_user()
        self.authenticate_user(board)
        
        # Emetti ESNcard
        response = self.client.post('/backend/esncard/emit/', {
            'profile_id': profile.pk,
            'card_number': 'IT-POL-0001234',
            'account_id': account.pk
        })
        
        self.assertEqual(response.status_code, 201)
        
        # Verifica
        card = ESNcard.objects.get(profile=profile)
        transactions = Transaction.objects.filter(profile=profile)
        
        # Dovrebbero esserci 2 transazioni
        self.assertEqual(transactions.count(), 2)
        
        # Una per ESNcard, una per quota
        types = [t.type for t in transactions]
        self.assertIn('esncard_emission', types)
        self.assertIn('membership_fee', types)
        
        # Balance = 10 (card) + 5 (quota) = 15
        account.refresh_from_db()
        self.assertEqual(account.balance, Decimal('15.00'))
```

---

### 4. Flusso Rimborso Spese Completo

**Moduli coinvolti**: users, treasury

```python
class ReimbursementFlowTestCase(BaseTestCase):
    """
    Flusso:
    1. ESNer crea richiesta rimborso
    2. Board approva
    3. Board effettua rimborso
    4. Verifica transazione e balance
    """
    
    def test_complete_reimbursement_workflow(self):
        from treasury.models import Account, ReimbursementRequest, Transaction
        
        # Setup
        account = Account.objects.create(name='Cassa', type='cash', balance=1000)
        
        # 1. ESNer crea richiesta
        esner = self.create_base_user()
        self.authenticate_user(esner)
        
        response = self.client.post('/backend/reimbursement_requests/', {
            'description': 'Acquisto materiale per evento Welcome',
            'amount': '125.50',
            'date': '2025-01-20',
            'receipt_url': 'https://drive.google.com/file/abc123'
        })
        
        self.assertEqual(response.status_code, 201)
        req_id = response.data['id']
        
        req = ReimbursementRequest.objects.get(pk=req_id)
        self.assertEqual(req.status, 'pending')
        
        # 2. Board approva
        board = self.create_board_user()
        self.authenticate_user(board)
        
        response = self.client.patch(f'/backend/reimbursement_requests/{req_id}/', {
            'status': 'approved',
            'notes': 'Approvato - materiale evento'
        })
        
        self.assertEqual(response.status_code, 200)
        
        req.refresh_from_db()
        self.assertEqual(req.status, 'approved')
        
        # 3. Board rimborsa
        response = self.client.post(f'/backend/reimbursement_requests/{req_id}/reimburse/', {
            'account_id': account.pk
        })
        
        self.assertEqual(response.status_code, 200)
        
        # 4. Verifica
        req.refresh_from_db()
        self.assertEqual(req.status, 'reimbursed')
        
        transaction = Transaction.objects.get(reimbursement_request=req)
        self.assertEqual(transaction.type, 'reimbursement')
        self.assertEqual(transaction.amount, Decimal('-125.50'))
        
        account.refresh_from_db()
        self.assertEqual(account.balance, Decimal('874.50'))
```

---

### 5. Flusso Viaggio con Deposito e Rimborso

**Moduli coinvolti**: events, treasury

```python
class TripDepositFlowTestCase(BaseTestCase):
    """
    Flusso viaggio:
    1. Crea iscrizione a viaggio con deposito
    2. Segna deposito pagato
    3. Dopo evento, rimborsa deposito
    """
    
    def test_trip_deposit_and_reimbursement(self):
        from events.models import Event, EventList, Subscription
        from treasury.models import Account, Transaction
        
        board = self.create_board_user()
        self.authenticate_user(board)
        
        # Setup
        account = Account.objects.create(name='Cassa', type='cash', balance=500)
        
        event = Event.objects.create(
            name='Trip to Barcelona',
            date='2025-07-15',
            event_type='trip'
        )
        event_list = EventList.objects.create(
            name='Main List',
            capacity=40,
            is_main_list=True,
            price=200,
            deposit=50
        )
        event_list.events.add(event)
        
        profile = self.create_profile('erasmus@test.com', is_esner=False)
        
        # 1. Crea iscrizione
        response = self.client.post('/backend/subscriptions/', {
            'profile': profile.pk,
            'event': event.pk,
            'list': event_list.pk
        })
        
        self.assertEqual(response.status_code, 201)
        subscription = Subscription.objects.get(profile=profile, event=event)
        
        # 2. Segna deposito pagato (in persona)
        response = self.client.patch(f'/backend/subscriptions/{subscription.pk}/', {
            'deposit_payed': True
        })
        
        self.assertEqual(response.status_code, 200)
        
        subscription.refresh_from_db()
        self.assertTrue(subscription.deposit_payed)
        
        # 3. Dopo evento - Rimborsa deposito
        response = self.client.post(f'/backend/reimburse_deposit/{subscription.pk}/', {
            'account_id': account.pk
        })
        
        self.assertEqual(response.status_code, 200)
        
        # Verifica
        subscription.refresh_from_db()
        self.assertTrue(subscription.refunded)
        
        transaction = Transaction.objects.filter(
            subscription=subscription,
            type='deposit_reimbursement'
        ).first()
        self.assertIsNotNone(transaction)
        self.assertEqual(transaction.amount, Decimal('-50.00'))
        
        account.refresh_from_db()
        self.assertEqual(account.balance, Decimal('450.00'))
```

---

### 6. Flusso Cambio Gruppo ESNer

**Moduli coinvolti**: profiles, users

```python
class ESNerGroupPromotionFlowTestCase(BaseTestCase):
    """
    Flusso:
    1. ESNer inizia come Aspirante
    2. Board lo promuove ad Attivi
    3. Verifica nuovi permessi
    """
    
    def test_promote_aspirante_to_attivi(self):
        from django.contrib.auth.models import Group
        
        # 1. Crea ESNer Aspirante
        aspirante_profile = self.create_profile('aspirante@esnpolimi.it', is_esner=True)
        aspirante = self.create_user(aspirante_profile, self.aspiranti_group)
        
        # Verifica permessi iniziali (limitati)
        self.authenticate_user(aspirante)
        
        # Aspirante non può creare eventi
        response = self.client.post('/backend/events/', {
            'name': 'Test', 'date': '2025-06-01'
        })
        self.assertEqual(response.status_code, 403)
        
        # 2. Board promuove ad Attivi
        board = self.create_board_user()
        self.authenticate_user(board)
        
        response = self.client.patch(f'/backend/profile/{aspirante_profile.pk}/', {
            'group': 'Attivi'
        })
        
        self.assertEqual(response.status_code, 200)
        
        # 3. Verifica nuovo gruppo
        aspirante.refresh_from_db()
        self.assertTrue(aspirante.groups.filter(name='Attivi').exists())
        self.assertFalse(aspirante.groups.filter(name='Aspiranti').exists())
        
        # Verifica nuovi permessi (Attivi può creare eventi)
        self.authenticate_user(aspirante)
        
        response = self.client.post('/backend/events/', {
            'name': 'Test Event',
            'date': '2025-06-01'
        })
        
        # Potrebbe essere 201 se Attivi ha permission, o 403 se solo Board
        # Dipende dalla configurazione permessi
```

---

### 7. Flusso Permessi Finanziari Custom

**Moduli coinvolti**: users, treasury

```python
class FinancePermissionsFlowTestCase(BaseTestCase):
    """
    Flusso:
    1. Aspirante senza permessi finanziari
    2. Board assegna can_manage_casse
    3. Aspirante può ora gestire transazioni
    """
    
    def test_assign_finance_permissions(self):
        from treasury.models import Account, Transaction
        
        # 1. Crea Aspirante
        aspirante_profile = self.create_profile('aspirante@esnpolimi.it', is_esner=True)
        aspirante = self.create_user(aspirante_profile, self.aspiranti_group)
        
        account = Account.objects.create(name='Cassa', type='cash', balance=100)
        
        # Senza permessi - non può creare transazioni
        self.authenticate_user(aspirante)
        
        response = self.client.post('/backend/transactions/', {
            'account': account.pk,
            'type': 'other',
            'amount': '10.00'
        })
        
        self.assertEqual(response.status_code, 403)
        
        # 2. Board assegna permesso
        board = self.create_board_user()
        self.authenticate_user(board)
        
        response = self.client.patch(
            f'/backend/users/{aspirante.pk}/finance_permissions/',
            {'can_manage_casse': True}
        )
        
        self.assertEqual(response.status_code, 200)
        
        # 3. Ora può creare transazioni
        aspirante.refresh_from_db()
        self.assertTrue(aspirante.can_manage_casse)
        
        self.authenticate_user(aspirante)
        
        response = self.client.post('/backend/transactions/', {
            'account': account.pk,
            'type': 'other',
            'amount': '10.00',
            'description': 'Test'
        })
        
        self.assertEqual(response.status_code, 201)
```

---

## 🔐 Security Tests

### Test Rate Limiting Login
```python
class LoginRateLimitTestCase(TestCase):
    """Test rate limiting su login falliti"""
    
    def test_multiple_failed_logins_get_rate_limited(self):
        # Effettua molti login falliti
        for i in range(10):
            self.client.post('/backend/api/login/', {
                'email': 'test@test.com',
                'password': 'wrong'
            })
        
        # L'11esimo dovrebbe essere rate limited
        response = self.client.post('/backend/api/login/', {
            'email': 'test@test.com',
            'password': 'wrong'
        })
        
        # Verifica rate limiting (429 o messaggio specifico)
        # Dipende dalla configurazione
```

### Test Token Expiration
```python
class TokenExpirationTestCase(BaseTestCase):
    """Test scadenza token"""
    
    def test_expired_access_token_returns_401(self):
        from rest_framework_simplejwt.tokens import AccessToken
        from datetime import timedelta
        
        user = self.create_base_user()
        
        # Crea token già scaduto
        token = AccessToken.for_user(user)
        token.set_exp(lifetime=-timedelta(hours=1))
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(token)}')
        
        response = self.client.get('/backend/erasmus_profiles/')
        
        self.assertEqual(response.status_code, 401)
```

### Test Permission Escalation Prevention
```python
class PermissionEscalationTestCase(BaseTestCase):
    """Test prevenzione escalation permessi"""
    
    def test_attivi_cannot_promote_to_board(self):
        """Attivi non può promuovere a Board"""
        attivi_profile = self.create_profile('attivi@esnpolimi.it', is_esner=True)
        attivi = self.create_user(attivi_profile, self.attivi_group)
        
        target_profile = self.create_profile('target@esnpolimi.it', is_esner=True)
        self.create_user(target_profile, self.aspiranti_group)
        
        self.authenticate_user(attivi)
        
        response = self.client.patch(f'/backend/profile/{target_profile.pk}/', {
            'group': 'Board'
        })
        
        # Dovrebbe fallire - solo Board può promuovere a Board
        self.assertIn(response.status_code, [400, 403])
```

---

## Checklist Test Coverage

### Flussi Registrazione
- [ ] ESNer registration -> verification -> login
- [ ] Erasmus registration -> verification
- [ ] Verifica email con token scaduto/invalido

### Flussi Eventi
- [ ] Erasmus subscription via form
- [ ] Pagamento SumUp completo
- [ ] Move subscriptions tra liste
- [ ] Liberatorie PDF

### Flussi Tesoreria
- [ ] ESNcard emission con quota
- [ ] Richiesta rimborso completa
- [ ] Rimborso deposito viaggio
- [ ] Export transazioni

### Flussi Permessi
- [ ] Promozione gruppi
- [ ] Permessi finanziari custom
- [ ] Prevention escalation

### Security
- [ ] Rate limiting
- [ ] Token expiration
- [ ] CORS
- [ ] CSRF (se applicabile)

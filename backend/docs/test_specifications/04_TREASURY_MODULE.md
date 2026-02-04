# 04 - Treasury Module Test Specifications

## Panoramica Modulo

Il modulo `treasury` gestisce:
- Conti (Accounts) e movimenti finanziari
- Transazioni di vario tipo
- ESNcard e quota associativa
- Richieste di rimborso
- Import/Export dati
- Depositi e rimborsi

---

## File del Modulo

| File | Descrizione |
|------|-------------|
| `models.py` | Models Account, Transaction, ESNcard, ReimbursementRequest, Settings |
| `views.py` | Endpoint finanziari (~1049 linee) |
| `serializers.py` | Serializers per dati finanziari |
| `exceptions.py` | Eccezioni custom |
| `urls.py` | Route del modulo |

---

## Modelli

### Account
```python
class Account(BaseEntity):
    id = AutoField(primary_key=True)
    name = CharField(max_length=100)
    type = CharField(choices=['bank', 'cash', 'digital'])
    balance = DecimalField(default=0.00)
    enabled = BooleanField(default=True)
```

### Transaction
```python
class Transaction(BaseEntity):
    id = AutoField(primary_key=True)
    account = ForeignKey(Account, null=True)
    type = CharField(choices=[
        'subscription_payment',      # Pagamento iscrizione evento
        'membership_fee',            # Quota associativa
        'esncard_emission',          # Emissione ESNcard
        'reimbursement',             # Rimborso spese
        'transfer_in',               # Trasferimento in entrata
        'transfer_out',              # Trasferimento in uscita
        'deposit_payment',           # Pagamento deposito
        'deposit_reimbursement',     # Rimborso deposito
        'other'                      # Altro
    ])
    amount = DecimalField()
    description = CharField(max_length=500, null=True)
    date = DateTimeField(auto_now_add=True)
    profile = ForeignKey(Profile, null=True)
    subscription = ForeignKey(Subscription, null=True)
    esncard = ForeignKey(ESNcard, null=True)
    reimbursement_request = ForeignKey(ReimbursementRequest, null=True)
    enabled = BooleanField(default=True)
```

### ESNcard
```python
class ESNcard(BaseEntity):
    id = AutoField(primary_key=True)
    profile = ForeignKey(Profile)
    number = CharField(unique=True)
    emission_date = DateField(auto_now_add=True)
    expiration_date = DateField()  # +1 anno da emission
    enabled = BooleanField(default=True)
```

### ReimbursementRequest
```python
class ReimbursementRequest(BaseEntity):
    id = AutoField(primary_key=True)
    user = ForeignKey(User)
    description = CharField(max_length=500)
    amount = DecimalField()
    date = DateField()
    status = CharField(choices=['pending', 'approved', 'rejected', 'reimbursed'])
    receipt_url = URLField(null=True)  # Google Drive link
    notes = TextField(null=True)
    enabled = BooleanField(default=True)
```

### Settings
```python
class Settings(models.Model):
    membership_fee = DecimalField(default=5.00)  # Quota associativa
    esncard_price = DecimalField(default=10.00)  # Prezzo ESNcard
```

---

## Endpoints

### 1. GET `/backend/accounts/`
**Descrizione**: Lista conti
**Autenticazione**: Sì
**Permessi**: `treasury.view_account` O `can_view_casse_import`

#### Scenari di Test

| ID | Scenario | User | Expected | Status |
|----|----------|------|----------|--------|
| T-AL-001 | Lista come Board | Board | Tutti i conti | 200 |
| T-AL-002 | Lista come Aspirante con can_view_casse_import | Aspirante + permesso | Conti | 200 |
| T-AL-003 | Lista come Aspirante senza permesso | Aspirante | Forbidden | 403 |
| T-AL-004 | Lista solo enabled | Qualsiasi | Solo enabled=True | 200 |

```python
class AccountListTestCase(BaseTestCase):
    
    def test_board_can_list_accounts(self):
        """T-AL-001: Board può listare conti"""
        from treasury.models import Account
        
        board = self.create_board_user()
        self.authenticate_user(board)
        
        Account.objects.create(name='Cassa', type='cash', balance=100)
        Account.objects.create(name='Banca', type='bank', balance=1000)
        
        response = self.client.get('/backend/accounts/')
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)
    
    def test_aspirante_with_permission_can_list_accounts(self):
        """T-AL-002: Aspirante con can_view_casse_import può listare"""
        from treasury.models import Account
        
        aspirante = self.create_base_user()
        aspirante.can_view_casse_import = True
        aspirante.save()
        self.authenticate_user(aspirante)
        
        Account.objects.create(name='Cassa', type='cash', balance=100)
        
        response = self.client.get('/backend/accounts/')
        
        self.assertEqual(response.status_code, 200)
    
    def test_aspirante_without_permission_gets_403(self):
        """T-AL-003: Aspirante senza permesso riceve 403"""
        aspirante = self.create_base_user()
        self.authenticate_user(aspirante)
        
        response = self.client.get('/backend/accounts/')
        
        self.assertEqual(response.status_code, 403)
```

---

### 2. POST `/backend/accounts/`
**Descrizione**: Crea nuovo conto
**Autenticazione**: Sì
**Permessi**: `treasury.add_account`

#### Scenari di Test

| ID | Scenario | User | Input | Expected | Status |
|----|----------|------|-------|----------|--------|
| T-AC-001 | Crea conto cash | Board | name, type=cash | Conto creato | 201 |
| T-AC-002 | Crea conto bank | Board | type=bank | Conto creato | 201 |
| T-AC-003 | Crea senza permesso | Aspirante | - | Forbidden | 403 |
| T-AC-004 | Crea con nome duplicato | Board | nome esistente | Conto creato | 201 |

```python
class AccountCreationTestCase(BaseTestCase):
    
    def test_create_cash_account(self):
        """T-AC-001: Crea conto cassa"""
        board = self.create_board_user()
        self.authenticate_user(board)
        
        response = self.client.post('/backend/accounts/', {
            'name': 'Cassa Principale',
            'type': 'cash',
            'balance': '0.00'
        })
        
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['type'], 'cash')
```

---

### 3. GET/PATCH/DELETE `/backend/accounts/<pk>/`
**Descrizione**: Dettaglio/Modifica/Elimina conto
**Autenticazione**: Sì
**Permessi**: Rispettivi permessi CRUD

#### Scenari di Test

| ID | Scenario | User | Expected | Status |
|----|----------|------|----------|--------|
| T-AD-001 | GET conto | Board | Dettagli conto | 200 |
| T-AD-002 | PATCH balance | Board | Balance aggiornato | 200 |
| T-AD-003 | DELETE conto senza transazioni | Board | Eliminato | 200 |
| T-AD-004 | DELETE conto con transazioni | Board | Errore | 400 |

---

### 4. GET `/backend/transactions/`
**Descrizione**: Lista transazioni con filtri
**Autenticazione**: Sì
**Permessi**: `treasury.view_transaction` O `can_view_casse_import`

#### Parametri Query
- `account`: ID conto
- `type`: tipo transazione
- `profile`: ID profilo
- `date_from`, `date_to`: range date
- `page`, `page_size`: paginazione

#### Scenari di Test

| ID | Scenario | Query Params | Expected | Status |
|----|----------|--------------|----------|--------|
| T-TL-001 | Lista senza filtri | - | Tutte le transazioni | 200 |
| T-TL-002 | Filtro per conto | account=1 | Solo del conto | 200 |
| T-TL-003 | Filtro per tipo | type=esncard_emission | Solo ESNcard | 200 |
| T-TL-004 | Filtro per profilo | profile=123 | Solo del profilo | 200 |
| T-TL-005 | Filtro date range | date_from, date_to | Nel range | 200 |

```python
class TransactionListTestCase(BaseTestCase):
    
    def test_filter_by_account(self):
        """T-TL-002: Filtro per conto funziona"""
        from treasury.models import Account, Transaction
        
        board = self.create_board_user()
        self.authenticate_user(board)
        
        acc1 = Account.objects.create(name='Cassa', type='cash')
        acc2 = Account.objects.create(name='Banca', type='bank')
        
        Transaction.objects.create(account=acc1, type='other', amount=10)
        Transaction.objects.create(account=acc2, type='other', amount=20)
        
        response = self.client.get(f'/backend/transactions/?account={acc1.pk}')
        
        self.assertEqual(response.status_code, 200)
        self.assertTrue(all(t['account'] == acc1.pk for t in response.data['results']))
    
    def test_filter_by_type(self):
        """T-TL-003: Filtro per tipo funziona"""
        from treasury.models import Account, Transaction
        
        board = self.create_board_user()
        self.authenticate_user(board)
        
        acc = Account.objects.create(name='Cassa', type='cash')
        Transaction.objects.create(account=acc, type='esncard_emission', amount=10)
        Transaction.objects.create(account=acc, type='membership_fee', amount=5)
        
        response = self.client.get('/backend/transactions/?type=esncard_emission')
        
        self.assertEqual(response.status_code, 200)
        self.assertTrue(all(t['type'] == 'esncard_emission' for t in response.data['results']))
```

---

### 5. POST `/backend/transactions/`
**Descrizione**: Crea nuova transazione
**Autenticazione**: Sì
**Permessi**: `treasury.add_transaction` O `can_manage_casse`

#### Scenari di Test

| ID | Scenario | Input | Expected | Status |
|----|----------|-------|----------|--------|
| T-TC-001 | Crea transazione other | account, type, amount | Transazione creata | 201 |
| T-TC-002 | Crea con profilo | + profile | FK salvata | 201 |
| T-TC-003 | Crea aggiorna balance conto | amount positivo | account.balance += | 201 |
| T-TC-004 | Crea senza permesso | Aspirante | Forbidden | 403 |
| T-TC-005 | Aspirante con can_manage_casse | + permesso | Transazione creata | 201 |

```python
class TransactionCreationTestCase(BaseTestCase):
    
    def test_create_transaction_updates_account_balance(self):
        """T-TC-003: Creare transazione aggiorna balance conto"""
        from treasury.models import Account
        
        board = self.create_board_user()
        self.authenticate_user(board)
        
        account = Account.objects.create(name='Cassa', type='cash', balance=100)
        
        response = self.client.post('/backend/transactions/', {
            'account': account.pk,
            'type': 'other',
            'amount': '50.00',
            'description': 'Entrata varia'
        })
        
        self.assertEqual(response.status_code, 201)
        
        account.refresh_from_db()
        self.assertEqual(account.balance, Decimal('150.00'))
    
    def test_aspirante_with_can_manage_casse_can_create(self):
        """T-TC-005: Aspirante con can_manage_casse può creare"""
        from treasury.models import Account
        
        aspirante = self.create_base_user()
        aspirante.can_manage_casse = True
        aspirante.save()
        self.authenticate_user(aspirante)
        
        account = Account.objects.create(name='Cassa', type='cash')
        
        response = self.client.post('/backend/transactions/', {
            'account': account.pk,
            'type': 'other',
            'amount': '25.00'
        })
        
        self.assertEqual(response.status_code, 201)
```

---

### 6. PATCH/DELETE `/backend/transactions/<pk>/`
**Descrizione**: Modifica/Elimina transazione
**Autenticazione**: Sì
**Permessi**: Rispettivi permessi

#### Scenari di Test

| ID | Scenario | Action | Expected | Status |
|----|----------|--------|----------|--------|
| T-TUD-001 | PATCH description | Modifica descrizione | Aggiornata | 200 |
| T-TUD-002 | DELETE transazione | Elimina | Balance aggiornato | 200 |
| T-TUD-003 | DELETE decrementa balance | amount era 50 | balance -= 50 | 200 |

```python
class TransactionDeleteTestCase(BaseTestCase):
    
    def test_delete_transaction_updates_balance(self):
        """T-TUD-003: Eliminare transazione aggiorna balance"""
        from treasury.models import Account, Transaction
        
        board = self.create_board_user()
        self.authenticate_user(board)
        
        account = Account.objects.create(name='Cassa', type='cash', balance=150)
        transaction = Transaction.objects.create(
            account=account, type='other', amount=50
        )
        
        response = self.client.delete(f'/backend/transactions/{transaction.pk}/')
        
        self.assertEqual(response.status_code, 200)
        
        account.refresh_from_db()
        self.assertEqual(account.balance, Decimal('100.00'))
```

---

### 7. POST `/backend/esncard/emit/`
**Descrizione**: Emette ESNcard per un profilo
**Autenticazione**: Sì
**Permessi**: `treasury.add_esncard` O `can_manage_casse`

#### Request Body
```json
{
    "profile_id": 123,
    "card_number": "IT-POL-1234567",
    "account_id": 1
}
```

#### Scenari di Test

| ID | Scenario | Input | Expected | Status |
|----|----------|-------|----------|--------|
| T-ESN-001 | Emette ESNcard valida | tutti i campi | Card + Transaction creati | 201 |
| T-ESN-002 | Emette con numero duplicato | card_number esistente | Errore unique | 400 |
| T-ESN-003 | Profilo già ha card valida | card non scaduta | Errore | 400 |
| T-ESN-004 | Profilo con card scaduta | card scaduta | Nuova card emessa | 201 |
| T-ESN-005 | Emette include quota associativa | - | 2 transazioni (card + quota) | 201 |
| T-ESN-006 | Emette senza quota se già pagata | nell'anno | 1 transazione (solo card) | 201 |

```python
class ESNcardEmissionTestCase(BaseTestCase):
    
    def test_emit_esncard_creates_card_and_transactions(self):
        """T-ESN-001: Emettere ESNcard crea card e transazioni"""
        from treasury.models import Account, ESNcard, Transaction
        
        board = self.create_board_user()
        self.authenticate_user(board)
        
        account = Account.objects.create(name='Cassa', type='cash', balance=0)
        profile = self.create_profile('erasmus@test.com', is_esner=False)
        
        response = self.client.post('/backend/esncard/emit/', {
            'profile_id': profile.pk,
            'card_number': 'IT-POL-0001234',
            'account_id': account.pk
        })
        
        self.assertEqual(response.status_code, 201)
        
        # Verifica ESNcard creata
        card = ESNcard.objects.get(profile=profile)
        self.assertEqual(card.number, 'IT-POL-0001234')
        
        # Verifica transazioni (ESNcard + quota associativa)
        transactions = Transaction.objects.filter(esncard=card)
        self.assertGreaterEqual(len(transactions), 1)
        
        # Verifica balance aggiornato
        account.refresh_from_db()
        self.assertGreater(account.balance, 0)
    
    def test_emit_duplicate_card_number_returns_error(self):
        """T-ESN-002: Numero card duplicato ritorna errore"""
        from treasury.models import Account, ESNcard
        
        board = self.create_board_user()
        self.authenticate_user(board)
        
        account = Account.objects.create(name='Cassa', type='cash')
        profile1 = self.create_profile('erasmus1@test.com', is_esner=False)
        profile2 = self.create_profile('erasmus2@test.com', is_esner=False)
        
        ESNcard.objects.create(
            profile=profile1,
            number='IT-POL-SAME123',
            expiration_date='2026-01-01'
        )
        
        response = self.client.post('/backend/esncard/emit/', {
            'profile_id': profile2.pk,
            'card_number': 'IT-POL-SAME123',
            'account_id': account.pk
        })
        
        self.assertEqual(response.status_code, 400)
    
    def test_emit_when_valid_card_exists_returns_error(self):
        """T-ESN-003: Profilo con card valida ritorna errore"""
        from treasury.models import Account, ESNcard
        from datetime import date, timedelta
        
        board = self.create_board_user()
        self.authenticate_user(board)
        
        account = Account.objects.create(name='Cassa', type='cash')
        profile = self.create_profile('erasmus@test.com', is_esner=False)
        
        # Card valida esistente
        ESNcard.objects.create(
            profile=profile,
            number='IT-POL-EXISTING',
            expiration_date=date.today() + timedelta(days=365)
        )
        
        response = self.client.post('/backend/esncard/emit/', {
            'profile_id': profile.pk,
            'card_number': 'IT-POL-NEW1234',
            'account_id': account.pk
        })
        
        self.assertEqual(response.status_code, 400)
    
    def test_emit_with_expired_card_succeeds(self):
        """T-ESN-004: Profilo con card scaduta può avere nuova"""
        from treasury.models import Account, ESNcard
        from datetime import date, timedelta
        
        board = self.create_board_user()
        self.authenticate_user(board)
        
        account = Account.objects.create(name='Cassa', type='cash')
        profile = self.create_profile('erasmus@test.com', is_esner=False)
        
        # Card scaduta
        ESNcard.objects.create(
            profile=profile,
            number='IT-POL-EXPIRED',
            expiration_date=date.today() - timedelta(days=1)
        )
        
        response = self.client.post('/backend/esncard/emit/', {
            'profile_id': profile.pk,
            'card_number': 'IT-POL-NEW1234',
            'account_id': account.pk
        })
        
        self.assertEqual(response.status_code, 201)
```

---

### 8. GET `/backend/esncards/`
**Descrizione**: Lista ESNcards
**Autenticazione**: Sì
**Permessi**: `treasury.view_esncard` O `can_view_casse_import`

#### Parametri Query
- `profile`: ID profilo
- `valid`: solo valide (true/false)
- `search`: ricerca numero

```python
class ESNcardListTestCase(BaseTestCase):
    
    def test_filter_valid_cards(self):
        """Test filtro carte valide"""
        from treasury.models import ESNcard
        from datetime import date, timedelta
        
        board = self.create_board_user()
        self.authenticate_user(board)
        
        profile = self.create_profile('test@test.com', is_esner=False)
        
        # Carta valida
        ESNcard.objects.create(
            profile=profile, number='VALID123',
            expiration_date=date.today() + timedelta(days=30)
        )
        # Carta scaduta
        ESNcard.objects.create(
            profile=profile, number='EXPIRED123',
            expiration_date=date.today() - timedelta(days=30)
        )
        
        response = self.client.get('/backend/esncards/?valid=true')
        
        self.assertEqual(response.status_code, 200)
        # Solo carte valide
```

---

### 9. POST `/backend/reimbursement_requests/`
**Descrizione**: Crea richiesta di rimborso
**Autenticazione**: Sì
**Permessi**: Tutti autenticati

#### Request Body
```json
{
    "description": "Spese per evento",
    "amount": "50.00",
    "date": "2025-01-15",
    "receipt_url": "https://drive.google.com/..."
}
```

#### Scenari di Test

| ID | Scenario | Input | Expected | Status |
|----|----------|-------|----------|--------|
| T-RR-001 | Crea richiesta valida | tutti i campi | Richiesta creata, status=pending | 201 |
| T-RR-002 | Crea senza receipt | manca receipt_url | Richiesta creata | 201 |
| T-RR-003 | Crea con importo negativo | amount=-10 | Errore validazione | 400 |

```python
class ReimbursementRequestCreationTestCase(BaseTestCase):
    
    def test_create_reimbursement_request_sets_pending_status(self):
        """T-RR-001: Crea richiesta imposta status pending"""
        from treasury.models import ReimbursementRequest
        
        user = self.create_base_user()
        self.authenticate_user(user)
        
        response = self.client.post('/backend/reimbursement_requests/', {
            'description': 'Acquisto materiale evento',
            'amount': '75.50',
            'date': '2025-01-20'
        })
        
        self.assertEqual(response.status_code, 201)
        
        req = ReimbursementRequest.objects.get(pk=response.data['id'])
        self.assertEqual(req.status, 'pending')
        self.assertEqual(req.user, user)
```

---

### 10. GET `/backend/reimbursement_requests/`
**Descrizione**: Lista richieste rimborso
**Autenticazione**: Sì
**Permessi**: Board vede tutte, altri vedono solo le proprie

#### Scenari di Test

| ID | Scenario | User | Expected | Status |
|----|----------|------|----------|--------|
| T-RRL-001 | Board vede tutte | Board | Tutte le richieste | 200 |
| T-RRL-002 | Aspirante vede solo proprie | Aspirante | Solo sue richieste | 200 |

```python
class ReimbursementRequestListTestCase(BaseTestCase):
    
    def test_board_sees_all_requests(self):
        """T-RRL-001: Board vede tutte le richieste"""
        from treasury.models import ReimbursementRequest
        
        board = self.create_board_user()
        other_user = self.create_base_user()
        
        ReimbursementRequest.objects.create(
            user=board, description='Board req', amount=10, date='2025-01-01'
        )
        ReimbursementRequest.objects.create(
            user=other_user, description='Other req', amount=20, date='2025-01-02'
        )
        
        self.authenticate_user(board)
        response = self.client.get('/backend/reimbursement_requests/')
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), 2)
    
    def test_aspirante_sees_only_own_requests(self):
        """T-RRL-002: Aspirante vede solo proprie richieste"""
        from treasury.models import ReimbursementRequest
        
        aspirante = self.create_base_user()
        other = self.create_base_user(email='other@esnpolimi.it')
        
        ReimbursementRequest.objects.create(
            user=aspirante, description='My req', amount=10, date='2025-01-01'
        )
        ReimbursementRequest.objects.create(
            user=other, description='Other req', amount=20, date='2025-01-02'
        )
        
        self.authenticate_user(aspirante)
        response = self.client.get('/backend/reimbursement_requests/')
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['user'], aspirante.pk)
```

---

### 11. PATCH `/backend/reimbursement_requests/<pk>/`
**Descrizione**: Modifica richiesta (approvazione/rifiuto)
**Autenticazione**: Sì
**Permessi**: Board può cambiare status, owner può modificare solo se pending

#### Scenari di Test

| ID | Scenario | User | Input | Expected | Status |
|----|----------|------|-------|----------|--------|
| T-RRU-001 | Board approva | Board | status=approved | Status aggiornato | 200 |
| T-RRU-002 | Board rifiuta | Board | status=rejected, notes | Status + note | 200 |
| T-RRU-003 | Owner modifica pending | Owner | description | Aggiornato | 200 |
| T-RRU-004 | Owner modifica approved | Owner | - | Errore | 403 |
| T-RRU-005 | Non-owner modifica | Altro | - | Forbidden | 403 |

```python
class ReimbursementRequestUpdateTestCase(BaseTestCase):
    
    def test_board_can_approve_request(self):
        """T-RRU-001: Board può approvare richiesta"""
        from treasury.models import ReimbursementRequest
        
        board = self.create_board_user()
        user = self.create_base_user()
        
        req = ReimbursementRequest.objects.create(
            user=user, description='Test', amount=50, date='2025-01-01'
        )
        
        self.authenticate_user(board)
        response = self.client.patch(f'/backend/reimbursement_requests/{req.pk}/', {
            'status': 'approved'
        })
        
        self.assertEqual(response.status_code, 200)
        
        req.refresh_from_db()
        self.assertEqual(req.status, 'approved')
    
    def test_owner_cannot_modify_approved_request(self):
        """T-RRU-004: Owner non può modificare richiesta approvata"""
        from treasury.models import ReimbursementRequest
        
        user = self.create_base_user()
        
        req = ReimbursementRequest.objects.create(
            user=user, description='Test', amount=50, 
            date='2025-01-01', status='approved'
        )
        
        self.authenticate_user(user)
        response = self.client.patch(f'/backend/reimbursement_requests/{req.pk}/', {
            'description': 'Changed'
        })
        
        self.assertIn(response.status_code, [400, 403])
```

---

### 12. POST `/backend/reimbursement_requests/<pk>/reimburse/`
**Descrizione**: Rimborsa una richiesta approvata
**Autenticazione**: Sì
**Permessi**: `treasury.add_transaction` O Board

#### Request Body
```json
{
    "account_id": 1
}
```

#### Scenari di Test

| ID | Scenario | Preconditions | Expected | Status |
|----|----------|---------------|----------|--------|
| T-RRR-001 | Rimborsa approvata | status=approved | Transaction creata, status=reimbursed | 200 |
| T-RRR-002 | Rimborsa pending | status=pending | Errore | 400 |
| T-RRR-003 | Rimborsa già rimborsata | status=reimbursed | Errore | 400 |
| T-RRR-004 | Decrementa balance conto | - | account.balance -= amount | 200 |

```python
class ReimbursementReimburseTestCase(BaseTestCase):
    
    def test_reimburse_creates_transaction_and_updates_balance(self):
        """T-RRR-001: Rimborsare crea transazione e aggiorna balance"""
        from treasury.models import Account, ReimbursementRequest, Transaction
        
        board = self.create_board_user()
        self.authenticate_user(board)
        
        account = Account.objects.create(name='Cassa', type='cash', balance=500)
        user = self.create_base_user()
        
        req = ReimbursementRequest.objects.create(
            user=user, description='Test', amount=75,
            date='2025-01-01', status='approved'
        )
        
        response = self.client.post(f'/backend/reimbursement_requests/{req.pk}/reimburse/', {
            'account_id': account.pk
        })
        
        self.assertEqual(response.status_code, 200)
        
        # Verifica transazione
        transaction = Transaction.objects.get(reimbursement_request=req)
        self.assertEqual(transaction.type, 'reimbursement')
        self.assertEqual(transaction.amount, Decimal('-75.00'))
        
        # Verifica balance
        account.refresh_from_db()
        self.assertEqual(account.balance, Decimal('425.00'))
        
        # Verifica status
        req.refresh_from_db()
        self.assertEqual(req.status, 'reimbursed')
```

---

### 13. POST `/backend/reimburse_deposit/<subscription_pk>/`
**Descrizione**: Rimborsa deposito di un'iscrizione
**Autenticazione**: Sì
**Permessi**: `treasury.add_transaction` O `can_manage_casse`

#### Scenari di Test

| ID | Scenario | Preconditions | Expected | Status |
|----|----------|---------------|----------|--------|
| T-RD-001 | Rimborsa deposito pagato | deposit_payed=True | Transaction creata | 200 |
| T-RD-002 | Rimborsa deposito non pagato | deposit_payed=False | Errore | 400 |
| T-RD-003 | Già rimborsato | refunded=True | Errore | 400 |

```python
class ReimburseDepositTestCase(BaseTestCase):
    
    def test_reimburse_deposit_creates_transaction(self):
        """T-RD-001: Rimborsare deposito crea transazione"""
        from events.models import Event, EventList, Subscription
        from treasury.models import Account, Transaction
        
        board = self.create_board_user()
        self.authenticate_user(board)
        
        account = Account.objects.create(name='Cassa', type='cash', balance=500)
        
        event = Event.objects.create(name='Trip', date='2025-06-01')
        event_list = EventList.objects.create(
            name='Main', capacity=50, deposit=100, price=200
        )
        event_list.events.add(event)
        
        profile = self.create_profile('test@test.com', is_esner=False)
        subscription = Subscription.objects.create(
            profile=profile, event=event, list=event_list,
            deposit_payed=True
        )
        
        response = self.client.post(f'/backend/reimburse_deposit/{subscription.pk}/', {
            'account_id': account.pk
        })
        
        self.assertEqual(response.status_code, 200)
        
        # Verifica transazione
        transaction = Transaction.objects.filter(
            subscription=subscription, type='deposit_reimbursement'
        ).first()
        self.assertIsNotNone(transaction)
        
        # Verifica subscription
        subscription.refresh_from_db()
        self.assertTrue(subscription.refunded)
```

---

### 14. POST `/backend/reimburse_quota/<profile_pk>/`
**Descrizione**: Rimborsa quota associativa
**Autenticazione**: Sì
**Permessi**: Board

#### Scenari di Test

| ID | Scenario | Expected | Status |
|----|----------|----------|--------|
| T-RQ-001 | Rimborsa quota pagata quest'anno | Transaction creata | 200 |
| T-RQ-002 | Quota non pagata | Errore | 400 |

---

### 15. GET `/backend/export/transactions/`
**Descrizione**: Esporta transazioni in CSV/Excel
**Autenticazione**: Sì
**Permessi**: Board

#### Parametri Query
- `format`: csv/xlsx
- `account`: filtro conto
- `date_from`, `date_to`: range date

```python
class ExportTransactionsTestCase(BaseTestCase):
    
    def test_export_csv_returns_file(self):
        """Test export CSV"""
        from treasury.models import Account, Transaction
        
        board = self.create_board_user()
        self.authenticate_user(board)
        
        account = Account.objects.create(name='Cassa', type='cash')
        Transaction.objects.create(account=account, type='other', amount=100)
        
        response = self.client.get('/backend/export/transactions/?format=csv')
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'text/csv')
```

---

### 16. GET `/backend/settings/`
**Descrizione**: Ottiene settings tesoreria
**Autenticazione**: Sì

### PATCH `/backend/settings/`
**Descrizione**: Modifica settings
**Permessi**: Board

```python
class SettingsTestCase(BaseTestCase):
    
    def test_board_can_update_settings(self):
        """Test Board può modificare settings"""
        from treasury.models import Settings
        
        Settings.objects.create(membership_fee=5, esncard_price=10)
        
        board = self.create_board_user()
        self.authenticate_user(board)
        
        response = self.client.patch('/backend/settings/', {
            'esncard_price': '12.00'
        })
        
        self.assertEqual(response.status_code, 200)
        
        settings = Settings.objects.first()
        self.assertEqual(settings.esncard_price, Decimal('12.00'))
```

---

## Integration Tests

### Test Flusso ESNcard Completo
```python
class ESNcardFullFlowTestCase(BaseTestCase):
    """Test flusso: registrazione -> ESNcard -> transazioni"""
    
    def test_complete_esncard_flow(self):
        """Test flusso completo emissione ESNcard"""
        from treasury.models import Account, ESNcard, Transaction, Settings
        
        # Setup settings
        Settings.objects.create(membership_fee=5, esncard_price=10)
        
        board = self.create_board_user()
        self.authenticate_user(board)
        
        # 1. Crea conto
        account = Account.objects.create(name='Cassa', type='cash', balance=0)
        
        # 2. Crea profilo Erasmus
        profile = self.create_profile('erasmus@test.com', is_esner=False)
        
        # 3. Emetti ESNcard
        response = self.client.post('/backend/esncard/emit/', {
            'profile_id': profile.pk,
            'card_number': 'IT-POL-TEST123',
            'account_id': account.pk
        })
        
        self.assertEqual(response.status_code, 201)
        
        # 4. Verifica
        card = ESNcard.objects.get(profile=profile)
        transactions = Transaction.objects.filter(esncard=card)
        
        # Dovrebbero esserci 2 transazioni: card (10€) + quota (5€)
        self.assertEqual(transactions.count(), 2)
        
        # Balance = 10 + 5 = 15€
        account.refresh_from_db()
        self.assertEqual(account.balance, Decimal('15.00'))
```

### Test Flusso Rimborso Completo
```python
class ReimbursementFullFlowTestCase(BaseTestCase):
    """Test flusso: richiesta -> approvazione -> rimborso"""
    
    def test_complete_reimbursement_flow(self):
        """Test flusso completo rimborso"""
        from treasury.models import Account, ReimbursementRequest
        
        account = Account.objects.create(name='Cassa', type='cash', balance=1000)
        
        # 1. Utente crea richiesta
        user = self.create_base_user()
        self.authenticate_user(user)
        
        response = self.client.post('/backend/reimbursement_requests/', {
            'description': 'Spese evento',
            'amount': '150.00',
            'date': '2025-01-15'
        })
        req_id = response.data['id']
        
        # 2. Board approva
        board = self.create_board_user()
        self.authenticate_user(board)
        
        response = self.client.patch(f'/backend/reimbursement_requests/{req_id}/', {
            'status': 'approved'
        })
        self.assertEqual(response.status_code, 200)
        
        # 3. Board rimborsa
        response = self.client.post(f'/backend/reimbursement_requests/{req_id}/reimburse/', {
            'account_id': account.pk
        })
        self.assertEqual(response.status_code, 200)
        
        # 4. Verifica
        req = ReimbursementRequest.objects.get(pk=req_id)
        self.assertEqual(req.status, 'reimbursed')
        
        account.refresh_from_db()
        self.assertEqual(account.balance, Decimal('850.00'))  # 1000 - 150
```

---

## Checklist Test Coverage

### Conti
- [ ] CRUD conti con permessi
- [ ] Permessi custom (can_view_casse_import)
- [ ] Balance aggiornato da transazioni

### Transazioni
- [ ] CRUD transazioni con permessi
- [ ] Filtri per conto/tipo/profilo/date
- [ ] Balance aggiornato create/delete
- [ ] Permessi custom (can_manage_casse)

### ESNcard
- [ ] Emissione con transazione
- [ ] Validazione numero duplicato
- [x] Validazione card già valida
- [x] Rinnovo card scaduta
- [x] Quota associativa automatica
- [x] Duplicate number validation
- [x] Multiple cards per profile
- [x] Patch to duplicate number rejected

### Rimborsi
- [x] CRUD richieste
- [x] Visibilità Board vs owner
- [x] Flusso approvazione
- [x] Esecuzione rimborso
- [x] Rimborso deposito iscrizione
- [x] Rimborso quota associativa
- [x] Zero/negative amount validation
- [x] Insufficient balance handling
- [x] Closed account handling
- [x] Duplicate reimbursement prevention
- [x] Bulk deposit reimbursement

### Export
- [x] Export CSV
- [x] Export Excel
- [x] Filtri export

### Settings
- [x] GET settings
- [x] PATCH settings (Board only)

### Account Balance Edge Cases
- [x] Multiple transactions sum
- [x] Decimal precision
- [x] Negative balance prevention
- [x] Balance after transaction deletion
- [x] Closed account transaction rejection
- [x] Transaction move between accounts
- [x] Transaction amount change

### Account Visibility
- [x] Visible to all (no groups)
- [x] Restricted to specific group
- [x] Visible to multiple groups

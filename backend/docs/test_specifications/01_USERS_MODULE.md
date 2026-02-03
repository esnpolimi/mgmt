# 01 - Users Module Test Specifications

## Panoramica Modulo

Il modulo `users` gestisce:
- Autenticazione (login/logout)
- Gestione token JWT
- Gestione utenti
- Reset password
- Permessi finanziari (can_manage_casse, can_view_casse_import)
- Gruppi

---

## File del Modulo

| File | Descrizione |
|------|-------------|
| `models.py` | Model User con campi custom |
| `managers.py` | UserManager per creazione utenti |
| `views.py` | Endpoint autenticazione e CRUD utenti |
| `serializers.py` | Serializers per User e Token |
| `urls.py` | Route del modulo |

---

## Modello User

```python
class User(AbstractBaseUser, PermissionsMixin):
    profile = models.OneToOneField(Profile, primary_key=True)  # FK a Profile.email
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)
    last_login = models.DateTimeField(null=True)
    can_manage_casse = models.BooleanField(default=False)
    can_view_casse_import = models.BooleanField(default=False)
```

---

## Endpoints

### 1. POST `/backend/login/`
**Descrizione**: Login utente ESNer
**Autenticazione**: No
**Permessi**: Pubblico

#### Scenari di Test

| ID | Scenario | Input | Expected | Status |
|----|----------|-------|----------|--------|
| U-L-001 | Login con credenziali valide | email @esnpolimi.it, password corretta | access token, refresh token | 200 |
| U-L-002 | Login con email non @esnpolimi.it | email @gmail.com | "Solo email @esnpolimi.it sono ammesse" | 403 |
| U-L-003 | Login con password errata | email corretta, password sbagliata | "Credenziali invalide" | 403 |
| U-L-004 | Login con email non verificata | email non verificata | "Email non verificata" | 403 |
| U-L-005 | Login con utente inesistente | email non registrata | "Credenziali invalide" | 403 |
| U-L-006 | Login primo accesso | utente che non ha mai fatto login | first_login flag, last_login null | 200 |
| U-L-007 | Login secondo accesso | utente con last_login esistente | last_login popolato | 200 |
| U-L-008 | Login con email vuota | email mancante | Errore validazione | 400 |
| U-L-009 | Login con password vuota | password mancante | Errore validazione | 400 |

```python
class LoginTestCase(BaseTestCase):
    
    def test_login_with_valid_credentials_returns_tokens(self):
        """U-L-001: Login con credenziali valide ritorna tokens"""
        profile = self.create_profile('test@esnpolimi.it', is_esner=True)
        user = self.create_user(profile, password='testpass123')
        
        response = self.client.post('/backend/login/', {
            'email': 'test@esnpolimi.it',
            'password': 'testpass123'
        })
        
        self.assertEqual(response.status_code, 200)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
    
    def test_login_with_non_esn_email_returns_403(self):
        """U-L-002: Login con email non @esnpolimi.it ritorna 403"""
        response = self.client.post('/backend/login/', {
            'email': 'test@gmail.com',
            'password': 'testpass123'
        })
        
        self.assertEqual(response.status_code, 403)
        self.assertIn('Solo email @esnpolimi.it', response.data['detail'])
    
    def test_login_with_wrong_password_returns_403(self):
        """U-L-003: Login con password errata ritorna 403"""
        profile = self.create_profile('test@esnpolimi.it', is_esner=True)
        self.create_user(profile, password='correctpass')
        
        response = self.client.post('/backend/login/', {
            'email': 'test@esnpolimi.it',
            'password': 'wrongpass'
        })
        
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['detail'], 'Credenziali invalide')
    
    def test_login_with_unverified_email_returns_403(self):
        """U-L-004: Login con email non verificata ritorna 403"""
        profile = self.create_profile('test@esnpolimi.it', is_esner=True)
        profile.email_is_verified = False
        profile.save()
        self.create_user(profile, password='testpass123')
        
        response = self.client.post('/backend/login/', {
            'email': 'test@esnpolimi.it',
            'password': 'testpass123'
        })
        
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['detail'], 'Email non verificata')
    
    def test_login_first_time_sets_first_login_flag(self):
        """U-L-006: Primo login imposta first_login flag"""
        profile = self.create_profile('test@esnpolimi.it', is_esner=True)
        user = self.create_user(profile, password='testpass123')
        
        self.assertIsNone(user.last_login)
        
        response = self.client.post('/backend/login/', {
            'email': 'test@esnpolimi.it',
            'password': 'testpass123'
        })
        
        self.assertEqual(response.status_code, 200)
        # Il token contiene user con last_login null per indicare primo login
```

---

### 2. POST `/backend/logout/`
**Descrizione**: Logout utente
**Autenticazione**: No (ma accetta refresh token)
**Permessi**: Pubblico

#### Scenari di Test

| ID | Scenario | Input | Expected | Status |
|----|----------|-------|----------|--------|
| U-LO-001 | Logout con refresh token valido | refresh token | "Log out avvenuto con successo" | 200 |
| U-LO-002 | Logout senza refresh token | nessun token | Successo (graceful) | 200 |
| U-LO-003 | Logout con refresh token invalido | token malformato | Successo (graceful) | 200 |

```python
class LogoutTestCase(BaseTestCase):
    
    def test_logout_with_valid_token_succeeds(self):
        """U-LO-001: Logout con token valido ha successo"""
        profile = self.create_profile('test@esnpolimi.it', is_esner=True)
        user = self.create_user(profile)
        refresh = self.authenticate_user(user)
        
        response = self.client.post('/backend/logout/', {
            'refresh': str(refresh)
        })
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['detail'], 'Log out avvenuto con successo')
    
    def test_logout_without_token_succeeds_gracefully(self):
        """U-LO-002: Logout senza token ha successo (graceful)"""
        response = self.client.post('/backend/logout/', {})
        
        self.assertEqual(response.status_code, 200)
```

---

### 3. POST `/backend/api/token/refresh/`
**Descrizione**: Refresh del token JWT
**Autenticazione**: No (richiede cookie refresh_token)
**Permessi**: Pubblico

#### Scenari di Test

| ID | Scenario | Input | Expected | Status |
|----|----------|-------|----------|--------|
| U-TR-001 | Refresh con token valido | refresh token in cookie | Nuovo access token | 200 |
| U-TR-002 | Refresh senza cookie | nessun cookie | "Token di refresh non trovato" | 400 |
| U-TR-003 | Refresh con token scaduto | token expired | Errore token | 401 |
| U-TR-004 | Refresh con token blacklisted | token invalidato | Errore token | 401 |

```python
class TokenRefreshTestCase(BaseTestCase):
    
    def test_refresh_without_cookie_returns_400(self):
        """U-TR-002: Refresh senza cookie ritorna 400"""
        response = self.client.post('/backend/api/token/refresh/', {
            'email': 'test@esnpolimi.it'
        })
        
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['detail'], 'Token di refresh non trovato')
```

---

### 4. GET/POST `/backend/users/`
**Descrizione**: Lista utenti / Creazione utente
**Autenticazione**: Sì
**Permessi**: GET tutti, POST richiede `users.add_user`

#### Scenari di Test - GET

| ID | Scenario | User | Expected | Status |
|----|----------|------|----------|--------|
| U-UL-001 | Lista utenti come utente autenticato | Aspirante | Lista utenti | 200 |
| U-UL-002 | Lista utenti non autenticato | - | Unauthorized | 401 |

#### Scenari di Test - POST

| ID | Scenario | User | Input | Expected | Status |
|----|----------|------|-------|----------|--------|
| U-UC-001 | Crea utente con permesso | Board | dati validi | Utente creato | 201 |
| U-UC-002 | Crea utente senza permesso | Aspirante | dati validi | "Non autorizzato" | 401 |
| U-UC-003 | Crea utente con dati invalidi | Board | dati mancanti | Errori validazione | 400 |

```python
class UserListTestCase(BaseTestCase):
    
    def test_get_users_authenticated_returns_list(self):
        """U-UL-001: GET users autenticato ritorna lista"""
        user = self.create_base_user()
        self.authenticate_user(user)
        
        response = self.client.get('/backend/users/')
        
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.data, list)
    
    def test_get_users_unauthenticated_returns_401(self):
        """U-UL-002: GET users non autenticato ritorna 401"""
        response = self.client.get('/backend/users/')
        
        self.assertEqual(response.status_code, 401)
    
    def test_create_user_without_permission_returns_401(self):
        """U-UC-002: POST users senza permesso ritorna 401"""
        user = self.create_base_user()
        self.authenticate_user(user)
        
        new_profile = self.create_profile('new@esnpolimi.it', is_esner=True)
        
        response = self.client.post('/backend/users/', {
            'profile': new_profile.email,
            'password': 'newpass123'
        })
        
        self.assertEqual(response.status_code, 401)
```

---

### 5. GET/PATCH/DELETE `/backend/users/<pk>/`
**Descrizione**: Dettaglio/Modifica/Elimina utente
**Autenticazione**: Sì
**Permessi**: GET tutti, PATCH richiede `users.change_user`, DELETE solo Board

#### Scenari di Test

| ID | Scenario | User | Expected | Status |
|----|----------|------|----------|--------|
| U-UD-001 | GET utente esistente | Autenticato | Dettagli utente | 200 |
| U-UD-002 | GET utente inesistente | Autenticato | "Utente non trovato" | 404 |
| U-UD-003 | PATCH utente con permesso | Board | Utente aggiornato | 200 |
| U-UD-004 | PATCH utente senza permesso | Aspirante | "Non autorizzato" | 401 |
| U-UD-005 | DELETE utente come Board | Board | Utente eliminato | 204 |
| U-UD-006 | DELETE utente come Attivi | Attivi | "Non autorizzato" | 401 |

```python
class UserDetailTestCase(BaseTestCase):
    
    def test_get_user_detail_returns_user_data(self):
        """U-UD-001: GET user detail ritorna dati utente"""
        user = self.create_base_user()
        self.authenticate_user(user)
        
        response = self.client.get(f'/backend/users/{user.profile.email}/')
        
        self.assertEqual(response.status_code, 200)
    
    def test_get_nonexistent_user_returns_404(self):
        """U-UD-002: GET utente inesistente ritorna 404"""
        user = self.create_base_user()
        self.authenticate_user(user)
        
        response = self.client.get('/backend/users/nonexistent@esnpolimi.it/')
        
        self.assertEqual(response.status_code, 404)
    
    def test_delete_user_as_board_succeeds(self):
        """U-UD-005: DELETE user come Board ha successo"""
        board_user = self.create_board_user()
        self.authenticate_user(board_user)
        
        target_profile = self.create_profile('target@esnpolimi.it', is_esner=True)
        target_user = self.create_user(target_profile, self.aspiranti_group)
        
        response = self.client.delete(f'/backend/users/{target_user.profile.email}/')
        
        self.assertEqual(response.status_code, 204)
    
    def test_delete_user_as_non_board_returns_401(self):
        """U-UD-006: DELETE user come non-Board ritorna 401"""
        attivi_profile = self.create_profile('attivi@esnpolimi.it', is_esner=True)
        attivi_user = self.create_user(attivi_profile, self.attivi_group)
        self.authenticate_user(attivi_user)
        
        target_profile = self.create_profile('target@esnpolimi.it', is_esner=True)
        target_user = self.create_user(target_profile, self.aspiranti_group)
        
        response = self.client.delete(f'/backend/users/{target_user.profile.email}/')
        
        self.assertEqual(response.status_code, 401)
```

---

### 6. POST `/backend/api/forgot-password/`
**Descrizione**: Richiesta reset password
**Autenticazione**: No
**Permessi**: Pubblico

#### Scenari di Test

| ID | Scenario | Input | Expected | Status |
|----|----------|-------|----------|--------|
| U-FP-001 | Reset con email esistente | email registrata | Email inviata + messaggio generico | 200 |
| U-FP-002 | Reset con email inesistente | email non registrata | Messaggio generico (no info leak) | 200 |
| U-FP-003 | Reset senza email | email mancante | "L'indirizzo email è obbligatorio" | 400 |

```python
class ForgotPasswordTestCase(BaseTestCase):
    
    def test_forgot_password_with_existing_email_sends_email(self):
        """U-FP-001: Forgot password con email esistente invia email"""
        from django.core import mail
        
        profile = self.create_profile('test@esnpolimi.it', is_esner=True)
        self.create_user(profile)
        
        response = self.client.post('/backend/api/forgot-password/', {
            'email': 'test@esnpolimi.it'
        })
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('Reimposta la tua password', mail.outbox[0].subject)
    
    def test_forgot_password_with_nonexistent_email_returns_generic_message(self):
        """U-FP-002: Forgot password con email inesistente ritorna messaggio generico"""
        response = self.client.post('/backend/api/forgot-password/', {
            'email': 'nonexistent@esnpolimi.it'
        })
        
        self.assertEqual(response.status_code, 200)
        # Messaggio generico per non rivelare se email esiste
        self.assertIn('message', response.data)
    
    def test_forgot_password_without_email_returns_400(self):
        """U-FP-003: Forgot password senza email ritorna 400"""
        response = self.client.post('/backend/api/forgot-password/', {})
        
        self.assertEqual(response.status_code, 400)
```

---

### 7. POST `/backend/api/reset-password/<uid>/<token>/`
**Descrizione**: Esegue reset password
**Autenticazione**: No
**Permessi**: Pubblico (richiede token valido)

#### Scenari di Test

| ID | Scenario | Input | Expected | Status |
|----|----------|-------|----------|--------|
| U-RP-001 | Reset con token valido | uid, token, password, confirm | Password aggiornata | 200 |
| U-RP-002 | Reset con token invalido | uid corretto, token sbagliato | "Link non valido o scaduto" | 400 |
| U-RP-003 | Reset con uid invalido | uid sbagliato | "Link non valido" | 400 |
| U-RP-004 | Reset con password mismatch | password != confirm_password | "Le password non corrispondono" | 400 |
| U-RP-005 | Reset senza password | password mancante | Errore validazione | 400 |

```python
class ResetPasswordTestCase(BaseTestCase):
    
    def test_reset_password_with_valid_token_succeeds(self):
        """U-RP-001: Reset password con token valido ha successo"""
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.encoding import force_bytes
        from django.utils.http import urlsafe_base64_encode
        
        profile = self.create_profile('test@esnpolimi.it', is_esner=True)
        user = self.create_user(profile, password='oldpass')
        
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        
        response = self.client.post(f'/backend/api/reset-password/{uid}/{token}/', {
            'password': 'newpassword123',
            'confirm_password': 'newpassword123'
        })
        
        self.assertEqual(response.status_code, 200)
        
        # Verifica che la nuova password funzioni
        user.refresh_from_db()
        self.assertTrue(user.check_password('newpassword123'))
    
    def test_reset_password_with_mismatched_passwords_returns_400(self):
        """U-RP-004: Reset con password diverse ritorna 400"""
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.encoding import force_bytes
        from django.utils.http import urlsafe_base64_encode
        
        profile = self.create_profile('test@esnpolimi.it', is_esner=True)
        user = self.create_user(profile)
        
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        
        response = self.client.post(f'/backend/api/reset-password/{uid}/{token}/', {
            'password': 'password1',
            'confirm_password': 'password2'
        })
        
        self.assertEqual(response.status_code, 400)
        self.assertIn('Le password non corrispondono', response.data['error'])
```

---

### 8. GET `/backend/groups/`
**Descrizione**: Lista gruppi disponibili
**Autenticazione**: Sì
**Permessi**: Tutti gli utenti autenticati

#### Scenari di Test

| ID | Scenario | User | Expected | Status |
|----|----------|------|----------|--------|
| U-GL-001 | Lista gruppi autenticato | Qualsiasi | Lista gruppi | 200 |
| U-GL-002 | Lista gruppi non autenticato | - | Unauthorized | 401 |

```python
class GroupListTestCase(BaseTestCase):
    
    def test_get_groups_authenticated_returns_list(self):
        """U-GL-001: GET groups autenticato ritorna lista"""
        user = self.create_base_user()
        self.authenticate_user(user)
        
        response = self.client.get('/backend/groups/')
        
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.data, list)
        # Verifica che i gruppi creati siano presenti
        group_names = [g['name'] for g in response.data]
        self.assertIn('Board', group_names)
        self.assertIn('Attivi', group_names)
        self.assertIn('Aspiranti', group_names)
```

---

### 9. GET/PATCH `/backend/users/finance-permissions/`
**Descrizione**: Gestione permessi finanziari per Aspiranti
**Autenticazione**: Sì
**Permessi**: GET tutti, PATCH solo Board

#### Scenari di Test

| ID | Scenario | User | Query Param | Expected | Status |
|----|----------|------|-------------|----------|--------|
| U-FIN-001 | GET permessi utente | Autenticato | email=target | Permessi raw + effective | 200 |
| U-FIN-002 | GET senza email param | Autenticato | - | "Missing 'email' parameter" | 400 |
| U-FIN-003 | GET utente inesistente | Autenticato | email=nonexistent | "Utente non trovato" | 404 |
| U-FIN-004 | PATCH permessi come Board | Board | email=aspirante | Permessi aggiornati | 200 |
| U-FIN-005 | PATCH permessi come non-Board | Attivi | email=aspirante | "Solo Board può modificare" | 403 |
| U-FIN-006 | PATCH permessi a non-Aspirante | Board | email=attivi | "Solo applicabili agli Aspiranti" | 400 |
| U-FIN-007 | PATCH permessi a non-ESNer | Board | email=erasmus | "Il profilo non è un ESNer" | 400 |

```python
class FinancePermissionsTestCase(BaseTestCase):
    
    def test_get_finance_permissions_returns_raw_and_effective(self):
        """U-FIN-001: GET permessi ritorna valori raw ed effective"""
        board_user = self.create_board_user()
        self.authenticate_user(board_user)
        
        aspirante_profile = self.create_profile('aspirante@esnpolimi.it', is_esner=True)
        aspirante = self.create_user(aspirante_profile, self.aspiranti_group)
        
        response = self.client.get('/backend/users/finance-permissions/', {
            'email': 'aspirante@esnpolimi.it'
        })
        
        self.assertEqual(response.status_code, 200)
        self.assertIn('can_manage_casse', response.data)
        self.assertIn('can_view_casse_import', response.data)
        self.assertIn('effective_can_manage_casse', response.data)
        self.assertIn('effective_can_view_casse_import', response.data)
    
    def test_patch_finance_permissions_as_board_succeeds(self):
        """U-FIN-004: PATCH permessi come Board ha successo"""
        board_user = self.create_board_user()
        self.authenticate_user(board_user)
        
        aspirante_profile = self.create_profile('aspirante@esnpolimi.it', is_esner=True)
        aspirante = self.create_user(aspirante_profile, self.aspiranti_group)
        
        response = self.client.patch('/backend/users/finance-permissions/?email=aspirante@esnpolimi.it', {
            'can_manage_casse': True,
            'can_view_casse_import': True
        })
        
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['can_manage_casse'])
        self.assertTrue(response.data['effective_can_manage_casse'])
    
    def test_patch_finance_permissions_to_attivi_returns_400(self):
        """U-FIN-006: PATCH permessi a Attivi ritorna 400"""
        board_user = self.create_board_user()
        self.authenticate_user(board_user)
        
        attivi_profile = self.create_profile('attivi@esnpolimi.it', is_esner=True)
        attivi = self.create_user(attivi_profile, self.attivi_group)
        
        response = self.client.patch('/backend/users/finance-permissions/?email=attivi@esnpolimi.it', {
            'can_manage_casse': True
        })
        
        self.assertEqual(response.status_code, 400)
        self.assertIn('Solo applicabili agli Aspiranti', response.data['error'])
```

---

## 🔧 UserManager Tests

```python
class UserManagerTestCase(TestCase):
    
    def test_create_user_without_profile_raises_error(self):
        """Test che create_user senza profile solleva errore"""
        from users.models import User
        
        with self.assertRaises(ValueError) as context:
            User.objects.create_user(profile=None, password='test')
        
        self.assertIn('profile must be set', str(context.exception))
    
    def test_create_superuser_sets_required_flags(self):
        """Test che create_superuser imposta is_staff e is_superuser"""
        from users.models import User
        from profiles.models import Profile
        
        profile = Profile.objects.create(
            email='super@esnpolimi.it',
            name='Super',
            surname='User',
            email_is_verified=True,
            enabled=True
        )
        
        user = User.objects.create_superuser(profile=profile, password='test')
        
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)
        self.assertTrue(user.is_active)
    
    def test_make_random_password_returns_correct_length(self):
        """Test che make_random_password genera password della lunghezza corretta"""
        from users.models import User
        
        password = User.objects.make_random_password(length=15)
        
        self.assertEqual(len(password), 15)
```

---

## 📊 Serializers Tests

```python
class UserSerializerTestCase(TestCase):
    
    def test_user_serializer_excludes_password(self):
        """Test che UserSerializer esclude il campo password"""
        from users.serializers import UserSerializer
        from profiles.models import Profile
        from users.models import User
        
        profile = Profile.objects.create(
            email='test@esnpolimi.it',
            name='Test',
            surname='User',
            email_is_verified=True,
            enabled=True
        )
        user = User.objects.create_user(profile=profile, password='secret')
        
        serializer = UserSerializer(user)
        
        self.assertNotIn('password', serializer.data)


class UserReactSerializerTestCase(BaseTestCase):
    
    def test_effective_can_manage_casse_for_board(self):
        """Test che Board ha sempre effective_can_manage_casse True"""
        from users.serializers import UserReactSerializer
        
        board_user = self.create_board_user()
        
        serializer = UserReactSerializer(board_user)
        
        self.assertTrue(serializer.data['effective_can_manage_casse'])
    
    def test_effective_can_manage_casse_for_aspirante_with_flag(self):
        """Test che Aspirante con flag ha effective_can_manage_casse True"""
        from users.serializers import UserReactSerializer
        
        aspirante_profile = self.create_profile('asp@esnpolimi.it', is_esner=True)
        aspirante = self.create_user(aspirante_profile, self.aspiranti_group)
        aspirante.can_manage_casse = True
        aspirante.save()
        
        serializer = UserReactSerializer(aspirante)
        
        self.assertTrue(serializer.data['effective_can_manage_casse'])
    
    def test_restricted_accounts_for_attivi(self):
        """Test che Attivi ha SumUp in restricted_accounts"""
        from users.serializers import UserReactSerializer
        
        attivi_profile = self.create_profile('attivi@esnpolimi.it', is_esner=True)
        attivi = self.create_user(attivi_profile, self.attivi_group)
        
        serializer = UserReactSerializer(attivi)
        
        self.assertIn('SumUp', serializer.data['restricted_accounts'])
    
    def test_restricted_accounts_for_board_is_empty(self):
        """Test che Board non ha restricted_accounts"""
        from users.serializers import UserReactSerializer
        
        board_user = self.create_board_user()
        
        serializer = UserReactSerializer(board_user)
        
        self.assertEqual(serializer.data['restricted_accounts'], [])
```

---

## Checklist Test Coverage

- [ ] Login con tutte le casistiche email
- [ ] Login primo accesso vs accessi successivi
- [ ] Logout con/senza token
- [ ] Token refresh da cookie
- [ ] CRUD utenti con permessi
- [ ] Reset password flow completo
- [ ] Finance permissions per ogni gruppo
- [ ] UserManager edge cases
- [ ] Serializers con dati corretti

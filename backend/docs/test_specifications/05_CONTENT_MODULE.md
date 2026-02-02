# 05 - Content Module Test Specifications

## Panoramica Modulo

Il modulo `content` gestisce:
- Sezioni di contenuto per homepage/pagine
- Link associati alle sezioni
- Contenuti pubblici e gestiti

---

## File del Modulo

| File | Descrizione |
|------|-------------|
| `models.py` | Models ContentSection, ContentLink |
| `views.py` | ViewSets CRUD |
| `serializers.py` | Serializers per contenuti |
| `urls.py` | Route del modulo |

---

## Modelli

### ContentSection
```python
class ContentSection(models.Model):
    id = AutoField(primary_key=True)
    title = CharField(max_length=200, choices=CATEGORY_CHOICES, unique=True)
    # Only two valid categories: 'LINK_UTILI' and 'WIKI_TUTORIAL'
    order = IntegerField(default=0)
    is_active = BooleanField(default=True)  # Filtra le sezioni visibili
    created_at = DateTimeField(auto_now_add=True)
    updated_at = DateTimeField(auto_now=True)
    created_by = ForeignKey(User, on_delete=SET_NULL, null=True)
    
    # Note: title is unique and limited to 2 choices only
```

### ContentLink
```python
class ContentLink(models.Model):
    id = AutoField(primary_key=True)
    section = ForeignKey(ContentSection, on_delete=CASCADE, related_name='links')
    name = CharField(max_length=200)  # Not 'title' - this is the link name
    url = URLField()
    color = CharField(max_length=20, default="#1976d2")  # Default blue color
    order = IntegerField(default=0)
    created_at = DateTimeField(auto_now_add=True)
    updated_at = DateTimeField(auto_now=True)
    created_by = ForeignKey(User, on_delete=SET_NULL, null=True)
```

---

## Endpoints

### 1. GET `/backend/content/sections/`
**Descrizione**: Lista sezioni contenuto
**Autenticazione**: No (pubblico)

#### Scenari di Test

| ID | Scenario | Expected | Status |
|----|----------|----------|--------|
| C-SL-001 | Lista sezioni | Solo enabled=True | 200 |
| C-SL-002 | Ordine corretto | Ordinate per campo order | 200 |
| C-SL-003 | Include links | Links nested nella risposta | 200 |

```python
class ContentSectionListTestCase(TestCase):
    
    def test_list_returns_only_enabled_sections(self):
        """C-SL-001: Lista ritorna solo sezioni enabled"""
        from content.models import ContentSection
        
        ContentSection.objects.create(title='Active', enabled=True, order=1)
        ContentSection.objects.create(title='Disabled', enabled=False, order=2)
        
        response = self.client.get('/backend/content/sections/')
        
        self.assertEqual(response.status_code, 200)
        titles = [s['title'] for s in response.data]
        self.assertIn('Active', titles)
        self.assertNotIn('Disabled', titles)
    
    def test_list_returns_ordered_by_order_field(self):
        """C-SL-002: Lista ordinata per campo order"""
        from content.models import ContentSection
        
        ContentSection.objects.create(title='Third', order=3)
        ContentSection.objects.create(title='First', order=1)
        ContentSection.objects.create(title='Second', order=2)
        
        response = self.client.get('/backend/content/sections/')
        
        self.assertEqual(response.status_code, 200)
        titles = [s['title'] for s in response.data]
        self.assertEqual(titles, ['First', 'Second', 'Third'])
    
    def test_list_includes_nested_links(self):
        """C-SL-003: Lista include links nested"""
        from content.models import ContentSection, ContentLink
        
        section = ContentSection.objects.create(title='Links Section', order=1)
        ContentLink.objects.create(
            section=section, title='Link 1', url='https://example.com/1'
        )
        ContentLink.objects.create(
            section=section, title='Link 2', url='https://example.com/2'
        )
        
        response = self.client.get('/backend/content/sections/')
        
        self.assertEqual(response.status_code, 200)
        section_data = response.data[0]
        self.assertIn('links', section_data)
        self.assertEqual(len(section_data['links']), 2)
```

---

### 2. POST `/backend/content/sections/`
**Descrizione**: Crea nuova sezione
**Autenticazione**: Sì
**Permessi**: `content.add_contentsection`

#### Scenari di Test

| ID | Scenario | User | Input | Expected | Status |
|----|----------|------|-------|----------|--------|
| C-SC-001 | Crea sezione | Board | title, description, order | Sezione creata | 201 |
| C-SC-002 | Crea senza titolo | Board | manca title | Errore validazione | 400 |
| C-SC-003 | Crea senza permesso | Aspiranti | - | Forbidden | 403 |
| C-SC-004 | Crea con links | Board | + links array | Sezione + links | 201 |

```python
class ContentSectionCreationTestCase(BaseTestCase):
    
    def test_create_section_with_valid_data(self):
        """C-SC-001: Crea sezione con dati validi"""
        board = self.create_board_user()
        self.authenticate_user(board)
        
        response = self.client.post('/backend/content/sections/', {
            'title': 'New Section',
            'description': 'Description here',
            'order': 5
        })
        
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['title'], 'New Section')
    
    def test_create_section_without_title_returns_400(self):
        """C-SC-002: Crea sezione senza titolo ritorna 400"""
        board = self.create_board_user()
        self.authenticate_user(board)
        
        response = self.client.post('/backend/content/sections/', {
            'description': 'No title',
            'order': 1
        })
        
        self.assertEqual(response.status_code, 400)
        self.assertIn('title', response.data)
    
    def test_aspirante_cannot_create_section(self):
        """C-SC-003: Aspirante non può creare sezioni"""
        aspirante = self.create_base_user()
        self.authenticate_user(aspirante)
        
        response = self.client.post('/backend/content/sections/', {
            'title': 'Test',
            'order': 1
        })
        
        self.assertEqual(response.status_code, 403)
```

---

### 3. GET `/backend/content/sections/<pk>/`
**Descrizione**: Dettaglio sezione
**Autenticazione**: No (pubblico)

#### Scenari di Test

| ID | Scenario | Expected | Status |
|----|----------|----------|--------|
| C-SD-001 | GET sezione esistente | Dettagli + links | 200 |
| C-SD-002 | GET sezione inesistente | Not found | 404 |
| C-SD-003 | GET sezione disabled | Not found (o enabled) | 404 |

```python
class ContentSectionDetailTestCase(TestCase):
    
    def test_get_section_returns_details_with_links(self):
        """C-SD-001: GET sezione ritorna dettagli con links"""
        from content.models import ContentSection, ContentLink
        
        section = ContentSection.objects.create(
            title='Test Section',
            description='Test description',
            order=1
        )
        ContentLink.objects.create(
            section=section, title='Link', url='https://example.com'
        )
        
        response = self.client.get(f'/backend/content/sections/{section.pk}/')
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['title'], 'Test Section')
        self.assertEqual(len(response.data['links']), 1)
    
    def test_get_nonexistent_section_returns_404(self):
        """C-SD-002: GET sezione inesistente ritorna 404"""
        response = self.client.get('/backend/content/sections/99999/')
        
        self.assertEqual(response.status_code, 404)
```

---

### 4. PATCH `/backend/content/sections/<pk>/`
**Descrizione**: Modifica sezione
**Autenticazione**: Sì
**Permessi**: `content.change_contentsection`

#### Scenari di Test

| ID | Scenario | Input | Expected | Status |
|----|----------|-------|----------|--------|
| C-SU-001 | Aggiorna titolo | title | Titolo aggiornato | 200 |
| C-SU-002 | Aggiorna order | order | Ordine aggiornato | 200 |
| C-SU-003 | Disabilita sezione | enabled=False | Sezione disabilitata | 200 |
| C-SU-004 | Aggiorna senza permesso | - | Forbidden | 403 |

```python
class ContentSectionUpdateTestCase(BaseTestCase):
    
    def test_update_section_title(self):
        """C-SU-001: Aggiorna titolo sezione"""
        from content.models import ContentSection
        
        board = self.create_board_user()
        self.authenticate_user(board)
        
        section = ContentSection.objects.create(title='Old Title', order=1)
        
        response = self.client.patch(f'/backend/content/sections/{section.pk}/', {
            'title': 'New Title'
        })
        
        self.assertEqual(response.status_code, 200)
        
        section.refresh_from_db()
        self.assertEqual(section.title, 'New Title')
    
    def test_disable_section(self):
        """C-SU-003: Disabilita sezione"""
        from content.models import ContentSection
        
        board = self.create_board_user()
        self.authenticate_user(board)
        
        section = ContentSection.objects.create(title='Test', order=1, enabled=True)
        
        response = self.client.patch(f'/backend/content/sections/{section.pk}/', {
            'enabled': False
        })
        
        self.assertEqual(response.status_code, 200)
        
        section.refresh_from_db()
        self.assertFalse(section.enabled)
```

---

### 5. DELETE `/backend/content/sections/<pk>/`
**Descrizione**: Elimina sezione
**Autenticazione**: Sì
**Permessi**: `content.delete_contentsection`

#### Scenari di Test

| ID | Scenario | Preconditions | Expected | Status |
|----|----------|---------------|----------|--------|
| C-SDE-001 | Elimina sezione | - | Sezione eliminata | 200/204 |
| C-SDE-002 | Elimina cascade links | Sezione con links | Links eliminati | 200/204 |
| C-SDE-003 | Elimina senza permesso | Aspirante | Forbidden | 403 |

```python
class ContentSectionDeleteTestCase(BaseTestCase):
    
    def test_delete_section_cascades_links(self):
        """C-SDE-002: Eliminare sezione elimina anche links"""
        from content.models import ContentSection, ContentLink
        
        board = self.create_board_user()
        self.authenticate_user(board)
        
        section = ContentSection.objects.create(title='Test', order=1)
        link = ContentLink.objects.create(
            section=section, title='Link', url='https://example.com'
        )
        
        response = self.client.delete(f'/backend/content/sections/{section.pk}/')
        
        self.assertIn(response.status_code, [200, 204])
        self.assertFalse(ContentLink.objects.filter(pk=link.pk).exists())
```

---

### 6. GET `/backend/content/links/`
**Descrizione**: Lista links (opzionale, se esposto)
**Autenticazione**: No

```python
class ContentLinkListTestCase(TestCase):
    
    def test_list_links_returns_all_enabled(self):
        """Test lista links ritorna solo enabled"""
        from content.models import ContentSection, ContentLink
        
        section = ContentSection.objects.create(title='Test', order=1)
        ContentLink.objects.create(
            section=section, title='Active', url='https://a.com', enabled=True
        )
        ContentLink.objects.create(
            section=section, title='Disabled', url='https://b.com', enabled=False
        )
        
        response = self.client.get('/backend/content/links/')
        
        if response.status_code == 200:
            titles = [l['title'] for l in response.data]
            self.assertIn('Active', titles)
            self.assertNotIn('Disabled', titles)
```

---

### 7. POST `/backend/content/links/`
**Descrizione**: Crea nuovo link
**Autenticazione**: Sì
**Permessi**: `content.add_contentlink`

#### Scenari di Test

| ID | Scenario | Input | Expected | Status |
|----|----------|-------|----------|--------|
| C-LC-001 | Crea link valido | section, title, url | Link creato | 201 |
| C-LC-002 | Crea con icona | + icon | Icona salvata | 201 |
| C-LC-003 | Crea senza sezione | manca section | Errore | 400 |
| C-LC-004 | Crea con URL invalido | url non valido | Errore | 400 |

```python
class ContentLinkCreationTestCase(BaseTestCase):
    
    def test_create_link_with_valid_data(self):
        """C-LC-001: Crea link con dati validi"""
        from content.models import ContentSection
        
        board = self.create_board_user()
        self.authenticate_user(board)
        
        section = ContentSection.objects.create(title='Test', order=1)
        
        response = self.client.post('/backend/content/links/', {
            'section': section.pk,
            'title': 'New Link',
            'url': 'https://example.com',
            'order': 1
        })
        
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['title'], 'New Link')
    
    def test_create_link_with_icon(self):
        """C-LC-002: Crea link con icona"""
        from content.models import ContentSection
        
        board = self.create_board_user()
        self.authenticate_user(board)
        
        section = ContentSection.objects.create(title='Test', order=1)
        
        response = self.client.post('/backend/content/links/', {
            'section': section.pk,
            'title': 'Instagram',
            'url': 'https://instagram.com/esn',
            'icon': 'instagram',
            'order': 1
        })
        
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['icon'], 'instagram')
    
    def test_create_link_with_invalid_url_returns_400(self):
        """C-LC-004: URL invalido ritorna 400"""
        from content.models import ContentSection
        
        board = self.create_board_user()
        self.authenticate_user(board)
        
        section = ContentSection.objects.create(title='Test', order=1)
        
        response = self.client.post('/backend/content/links/', {
            'section': section.pk,
            'title': 'Bad Link',
            'url': 'not-a-url',
            'order': 1
        })
        
        self.assertEqual(response.status_code, 400)
        self.assertIn('url', response.data)
```

---

### 8. PATCH `/backend/content/links/<pk>/`
**Descrizione**: Modifica link
**Autenticazione**: Sì
**Permessi**: `content.change_contentlink`

#### Scenari di Test

| ID | Scenario | Input | Expected | Status |
|----|----------|-------|----------|--------|
| C-LU-001 | Aggiorna titolo | title | Titolo aggiornato | 200 |
| C-LU-002 | Aggiorna URL | url | URL aggiornato | 200 |
| C-LU-003 | Cambia sezione | section | Sezione cambiata | 200 |
| C-LU-004 | Disabilita link | enabled=False | Link disabilitato | 200 |

```python
class ContentLinkUpdateTestCase(BaseTestCase):
    
    def test_update_link_url(self):
        """C-LU-002: Aggiorna URL link"""
        from content.models import ContentSection, ContentLink
        
        board = self.create_board_user()
        self.authenticate_user(board)
        
        section = ContentSection.objects.create(title='Test', order=1)
        link = ContentLink.objects.create(
            section=section, title='Link', url='https://old.com'
        )
        
        response = self.client.patch(f'/backend/content/links/{link.pk}/', {
            'url': 'https://new.com'
        })
        
        self.assertEqual(response.status_code, 200)
        
        link.refresh_from_db()
        self.assertEqual(link.url, 'https://new.com')
    
    def test_move_link_to_different_section(self):
        """C-LU-003: Sposta link in altra sezione"""
        from content.models import ContentSection, ContentLink
        
        board = self.create_board_user()
        self.authenticate_user(board)
        
        section1 = ContentSection.objects.create(title='Section 1', order=1)
        section2 = ContentSection.objects.create(title='Section 2', order=2)
        link = ContentLink.objects.create(
            section=section1, title='Link', url='https://example.com'
        )
        
        response = self.client.patch(f'/backend/content/links/{link.pk}/', {
            'section': section2.pk
        })
        
        self.assertEqual(response.status_code, 200)
        
        link.refresh_from_db()
        self.assertEqual(link.section, section2)
```

---

### 9. DELETE `/backend/content/links/<pk>/`
**Descrizione**: Elimina link
**Autenticazione**: Sì
**Permessi**: `content.delete_contentlink`

#### Scenari di Test

| ID | Scenario | Expected | Status |
|----|----------|----------|--------|
| C-LDE-001 | Elimina link | Link eliminato | 200/204 |
| C-LDE-002 | Elimina inesistente | Not found | 404 |
| C-LDE-003 | Elimina senza permesso | Forbidden | 403 |

```python
class ContentLinkDeleteTestCase(BaseTestCase):
    
    def test_delete_link(self):
        """C-LDE-001: Elimina link"""
        from content.models import ContentSection, ContentLink
        
        board = self.create_board_user()
        self.authenticate_user(board)
        
        section = ContentSection.objects.create(title='Test', order=1)
        link = ContentLink.objects.create(
            section=section, title='Link', url='https://example.com'
        )
        
        response = self.client.delete(f'/backend/content/links/{link.pk}/')
        
        self.assertIn(response.status_code, [200, 204])
        self.assertFalse(ContentLink.objects.filter(pk=link.pk).exists())
```

---

## Integration Tests

### Test Gestione Contenuti Homepage
```python
class HomepageContentTestCase(BaseTestCase):
    """Test gestione completa contenuti homepage"""
    
    def test_create_complete_homepage_structure(self):
        """Test creazione struttura completa homepage"""
        from content.models import ContentSection, ContentLink
        
        board = self.create_board_user()
        self.authenticate_user(board)
        
        # 1. Crea sezioni
        response = self.client.post('/backend/content/sections/', {
            'title': 'Social Media',
            'description': 'Follow us!',
            'order': 1
        })
        section1_id = response.data['id']
        
        response = self.client.post('/backend/content/sections/', {
            'title': 'Useful Links',
            'description': 'Important resources',
            'order': 2
        })
        section2_id = response.data['id']
        
        # 2. Aggiungi links
        self.client.post('/backend/content/links/', {
            'section': section1_id,
            'title': 'Instagram',
            'url': 'https://instagram.com/esn',
            'icon': 'instagram',
            'order': 1
        })
        self.client.post('/backend/content/links/', {
            'section': section1_id,
            'title': 'Facebook',
            'url': 'https://facebook.com/esn',
            'icon': 'facebook',
            'order': 2
        })
        self.client.post('/backend/content/links/', {
            'section': section2_id,
            'title': 'ESN International',
            'url': 'https://esn.org',
            'order': 1
        })
        
        # 3. Verifica struttura
        response = self.client.get('/backend/content/sections/')
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)
        
        # Prima sezione (order=1) dovrebbe essere Social Media
        self.assertEqual(response.data[0]['title'], 'Social Media')
        self.assertEqual(len(response.data[0]['links']), 2)
```

### Test Riordino Sezioni
```python
class ReorderSectionsTestCase(BaseTestCase):
    """Test riordino sezioni"""
    
    def test_reorder_sections_by_updating_order(self):
        """Test riordino sezioni aggiornando campo order"""
        from content.models import ContentSection
        
        board = self.create_board_user()
        self.authenticate_user(board)
        
        section1 = ContentSection.objects.create(title='First', order=1)
        section2 = ContentSection.objects.create(title='Second', order=2)
        section3 = ContentSection.objects.create(title='Third', order=3)
        
        # Sposta Third in prima posizione
        self.client.patch(f'/backend/content/sections/{section3.pk}/', {'order': 0})
        
        # Verifica nuovo ordine
        response = self.client.get('/backend/content/sections/')
        
        titles = [s['title'] for s in response.data]
        self.assertEqual(titles[0], 'Third')
```

---

## Model Tests

```python
class ContentSectionModelTestCase(TestCase):
    
    def test_section_default_values(self):
        """Test valori default sezione"""
        from content.models import ContentSection
        
        section = ContentSection.objects.create(title='Test')
        
        self.assertEqual(section.order, 0)
        self.assertTrue(section.enabled)
        self.assertIsNone(section.description)
    
    def test_section_str_representation(self):
        """Test __str__ sezione"""
        from content.models import ContentSection
        
        section = ContentSection.objects.create(title='My Section')
        
        self.assertEqual(str(section), 'My Section')


class ContentLinkModelTestCase(TestCase):
    
    def test_link_default_values(self):
        """Test valori default link"""
        from content.models import ContentSection, ContentLink
        
        section = ContentSection.objects.create(title='Test')
        link = ContentLink.objects.create(
            section=section, title='Link', url='https://example.com'
        )
        
        self.assertEqual(link.order, 0)
        self.assertTrue(link.enabled)
        self.assertIsNone(link.icon)
    
    def test_link_cascade_on_section_delete(self):
        """Test cascade delete link quando elimini sezione"""
        from content.models import ContentSection, ContentLink
        
        section = ContentSection.objects.create(title='Test')
        link = ContentLink.objects.create(
            section=section, title='Link', url='https://example.com'
        )
        link_pk = link.pk
        
        section.delete()
        
        self.assertFalse(ContentLink.objects.filter(pk=link_pk).exists())
```

---

## Checklist Test Coverage

### Sezioni
- [ ] Lista sezioni pubbliche
- [ ] Filtro enabled
- [ ] Ordinamento per order
- [ ] Include links nested
- [ ] CRUD con permessi
- [ ] Cascade delete links

### Links
- [ ] Lista links
- [ ] CRUD con permessi
- [ ] Validazione URL
- [ ] Gestione icone
- [ ] Spostamento tra sezioni

### Integrazioni
- [ ] Struttura homepage completa
- [ ] Riordino sezioni
- [ ] Riordino links

### Model Properties
- [ ] Valori default
- [ ] String representation
- [ ] Cascade relationships

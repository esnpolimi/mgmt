"""Tests for content module endpoints and behaviors."""

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from rest_framework.test import APITestCase

from content.models import ContentSection, ContentLink
from profiles.models import Profile


User = get_user_model()


def _create_profile(email, *, is_esner=True, verified=True, enabled=True, name="Mario", surname="Rossi"):
	"""Create and return a Profile with minimal required fields."""
	return Profile.objects.create(
		email=email,
		name=name,
		surname=surname,
		email_is_verified=verified,
		enabled=enabled,
		is_esner=is_esner,
		birthdate="1995-01-15",
	)


def _create_user(profile, *, password="SecurePass123!"):
	"""Create and return a User bound to the given profile."""
	user = User.objects.create(profile=profile)
	user.set_password(password)
	user.save(update_fields=["password"])
	return user


class ContentBaseTestCase(APITestCase):
	"""Base setup with groups for content tests."""

	@classmethod
	def setUpTestData(cls):
		cls.group_board = Group.objects.create(name="Board")
		cls.group_attivi = Group.objects.create(name="Attivi")
		cls.group_aspiranti = Group.objects.create(name="Aspiranti")

	def setUp(self):
		"""Clean up content data before each test to ensure isolation."""
		super().setUp()
		# Delete in correct order due to foreign key constraint
		ContentLink.objects.all().delete()
		ContentSection.objects.all().delete()
		# Also clean up profiles and users to avoid conflicts
		User.objects.all().delete()
		Profile.objects.all().delete()

	def authenticate(self, user):
		"""Force authenticate the API client with the given user."""
		self.client.force_authenticate(user=user)


class ContentSectionTests(ContentBaseTestCase):
	"""Tests for content sections endpoints."""

	def test_sections_list_requires_auth(self):
		"""GET sections should require authentication."""
		response = self.client.get("/backend/content/sections/")
		self.assertEqual(response.status_code, 401)

	def test_sections_list_returns_only_active(self):
		"""GET sections should return only active sections."""
		profile = _create_profile("viewer@esnpolimi.it")
		user = _create_user(profile)
		self.authenticate(user)

		ContentSection.objects.create(title="LINK_UTILI", is_active=True)
		ContentSection.objects.create(title="WIKI_TUTORIAL", is_active=False)

		response = self.client.get("/backend/content/sections/")

		self.assertEqual(response.status_code, 200)
		# Response is paginated
		results = response.data.get('results', response.data)
		self.assertEqual(len(results), 1)
		self.assertEqual(results[0]["title"], "LINK_UTILI")

	def test_section_create_requires_finance_permission(self):
		"""POST section should require finance permissions."""
		profile = _create_profile("aspirante@esnpolimi.it")
		user = _create_user(profile)
		user.groups.add(self.group_aspiranti)
		self.authenticate(user)

		response = self.client.post("/backend/content/sections/", {
			"title": "LINK_UTILI",
		})

		self.assertEqual(response.status_code, 403)

	def test_section_create_as_board(self):
		"""Board can create sections."""
		profile = _create_profile("board@esnpolimi.it")
		user = _create_user(profile)
		user.groups.add(self.group_board)
		self.authenticate(user)

		response = self.client.post("/backend/content/sections/", {
			"title": "LINK_UTILI",
			"order": 1,
		})

		self.assertEqual(response.status_code, 201)
		self.assertTrue(ContentSection.objects.filter(title="LINK_UTILI").exists())

	def test_section_create_as_attivi(self):
		"""Attivi can create sections (finance permission)."""
		profile = _create_profile("attivo@esnpolimi.it")
		user = _create_user(profile)
		user.groups.add(self.group_attivi)
		self.authenticate(user)

		response = self.client.post("/backend/content/sections/", {
			"title": "WIKI_TUTORIAL",
		})

		self.assertEqual(response.status_code, 201)

	def test_section_create_as_aspirante_with_flag(self):
		"""Aspiranti with can_manage_casse can create sections."""
		profile = _create_profile("aspirante@esnpolimi.it")
		user = _create_user(profile)
		user.groups.add(self.group_aspiranti)
		user.can_manage_casse = True
		user.save(update_fields=["can_manage_casse"])
		self.authenticate(user)

		response = self.client.post("/backend/content/sections/", {
			"title": "LINK_UTILI",
		})

		self.assertEqual(response.status_code, 201)

	def test_section_update_requires_permission(self):
		"""PATCH section should require finance permission."""
		profile = _create_profile("aspirante@esnpolimi.it")
		user = _create_user(profile)
		user.groups.add(self.group_aspiranti)
		self.authenticate(user)

		section = ContentSection.objects.create(title="LINK_UTILI", is_active=True)
		response = self.client.patch(f"/backend/content/sections/{section.pk}/", {
			"title": "Updated",
		})

		self.assertEqual(response.status_code, 403)

	def test_section_update_success(self):
		"""PATCH section should update fields with permission."""
		profile = _create_profile("board@esnpolimi.it")
		user = _create_user(profile)
		user.groups.add(self.group_board)
		self.authenticate(user)

		section = ContentSection.objects.create(title="LINK_UTILI", is_active=True, order=1)
		response = self.client.patch(f"/backend/content/sections/{section.pk}/", {
			"order": 5,
		})

		self.assertEqual(response.status_code, 200)
		section.refresh_from_db()
		self.assertEqual(section.order, 5)

	def test_section_delete_requires_permission(self):
		"""DELETE section should require finance permission."""
		profile = _create_profile("aspirante@esnpolimi.it")
		user = _create_user(profile)
		user.groups.add(self.group_aspiranti)
		self.authenticate(user)

		section = ContentSection.objects.create(title="LINK_UTILI", is_active=True)
		response = self.client.delete(f"/backend/content/sections/{section.pk}/")

		self.assertEqual(response.status_code, 403)

	def test_section_delete_success(self):
		"""DELETE section should remove section and related links."""
		profile = _create_profile("board@esnpolimi.it")
		user = _create_user(profile)
		user.groups.add(self.group_board)
		self.authenticate(user)

		section = ContentSection.objects.create(title="LINK_UTILI", is_active=True)
		link = ContentLink.objects.create(section=section, name="Link", url="https://example.com")

		response = self.client.delete(f"/backend/content/sections/{section.pk}/")

		self.assertIn(response.status_code, [200, 204])
		self.assertFalse(ContentSection.objects.filter(pk=section.pk).exists())
		self.assertFalse(ContentLink.objects.filter(pk=link.pk).exists())

	def test_active_sections_action(self):
		"""Custom active_sections action returns active sections."""
		profile = _create_profile("viewer@esnpolimi.it")
		user = _create_user(profile)
		self.authenticate(user)

		ContentSection.objects.create(title="Active", is_active=True)
		ContentSection.objects.create(title="Inactive", is_active=False)

		response = self.client.get("/backend/content/sections/active_sections/")

		self.assertEqual(response.status_code, 200)
		titles = [s["title"] for s in response.data]
		self.assertIn("Active", titles)
		self.assertNotIn("Inactive", titles)


class ContentLinkTests(ContentBaseTestCase):
	"""Tests for content links endpoints."""

	def test_links_list_requires_auth(self):
		"""GET links should require authentication."""
		response = self.client.get("/backend/content/links/")
		self.assertEqual(response.status_code, 401)

	def test_links_list_filter_by_section(self):
		"""Filter links by section query param."""
		profile = _create_profile("viewer@esnpolimi.it")
		user = _create_user(profile)
		self.authenticate(user)

		section_a = ContentSection.objects.create(title="LINK_UTILI", is_active=True)
		section_b = ContentSection.objects.create(title="WIKI_TUTORIAL", is_active=True)
		ContentLink.objects.create(section=section_a, name="Link A", url="https://a.com")
		ContentLink.objects.create(section=section_b, name="Link B", url="https://b.com")

		response = self.client.get(f"/backend/content/links/?section={section_a.pk}")

		self.assertEqual(response.status_code, 200)
		results = response.data.get('results', response.data)
		self.assertTrue(all(l["section"] == section_a.pk for l in results))

	def test_link_create_requires_permission(self):
		"""POST link should require finance permission."""
		profile = _create_profile("aspirante@esnpolimi.it")
		user = _create_user(profile)
		user.groups.add(self.group_aspiranti)
		self.authenticate(user)

		section = ContentSection.objects.create(title="LINK_UTILI", is_active=True)
		response = self.client.post("/backend/content/links/", {
			"section": section.pk,
			"name": "New Link",
			"url": "https://example.com",
		})

		self.assertEqual(response.status_code, 403)

	def test_link_create_success(self):
		"""Board can create links."""
		profile = _create_profile("board@esnpolimi.it")
		user = _create_user(profile)
		user.groups.add(self.group_board)
		self.authenticate(user)

		section = ContentSection.objects.create(title="LINK_UTILI", is_active=True)
		response = self.client.post("/backend/content/links/", {
			"section": section.pk,
			"name": "New Link",
			"url": "https://example.com",
		}, format="json")

		self.assertEqual(response.status_code, 201)
		self.assertTrue(ContentLink.objects.filter(name="New Link").exists())

	def test_link_update_requires_permission(self):
		"""PATCH link should require finance permission."""
		profile = _create_profile("aspirante@esnpolimi.it")
		user = _create_user(profile)
		user.groups.add(self.group_aspiranti)
		self.authenticate(user)

		section = ContentSection.objects.create(title="LINK_UTILI", is_active=True)
		link = ContentLink.objects.create(section=section, name="Link", url="https://example.com")
		response = self.client.patch(f"/backend/content/links/{link.pk}/", {
			"name": "Updated",
		})

		self.assertEqual(response.status_code, 403)

	def test_link_update_success(self):
		"""PATCH link should update fields with permission."""
		profile = _create_profile("board@esnpolimi.it")
		user = _create_user(profile)
		user.groups.add(self.group_board)
		self.authenticate(user)

		section = ContentSection.objects.create(title="LINK_UTILI", is_active=True)
		link = ContentLink.objects.create(section=section, name="Link", url="https://example.com")
		response = self.client.patch(f"/backend/content/links/{link.pk}/", {
			"name": "Updated",
		})

		self.assertEqual(response.status_code, 200)
		link.refresh_from_db()
		self.assertEqual(link.name, "Updated")

	def test_link_delete_requires_permission(self):
		"""DELETE link should require finance permission."""
		profile = _create_profile("aspirante@esnpolimi.it")
		user = _create_user(profile)
		user.groups.add(self.group_aspiranti)
		self.authenticate(user)

		section = ContentSection.objects.create(title="LINK_UTILI", is_active=True)
		link = ContentLink.objects.create(section=section, name="Link", url="https://example.com")
		response = self.client.delete(f"/backend/content/links/{link.pk}/")

		self.assertEqual(response.status_code, 403)

	def test_link_delete_success(self):
		"""DELETE link should remove it with permission."""
		profile = _create_profile("board@esnpolimi.it")
		user = _create_user(profile)
		user.groups.add(self.group_board)
		self.authenticate(user)

		section = ContentSection.objects.create(title="LINK_UTILI", is_active=True)
		link = ContentLink.objects.create(section=section, name="Link", url="https://example.com")
		response = self.client.delete(f"/backend/content/links/{link.pk}/")

		self.assertIn(response.status_code, [200, 204])
		self.assertFalse(ContentLink.objects.filter(pk=link.pk).exists())


class ContentEdgeCasesTests(ContentBaseTestCase):
	"""Additional edge-case tests for content module."""

	def test_section_create_missing_title(self):
		"""Missing title should return 400."""
		profile = _create_profile("board@esnpolimi.it")
		user = _create_user(profile)
		user.groups.add(self.group_board)
		self.authenticate(user)

		response = self.client.post("/backend/content/sections/", {
			"order": 1,
		})

		self.assertEqual(response.status_code, 400)
		self.assertIn("title", response.data)

	def test_link_create_invalid_url(self):
		"""Invalid URL should return 400."""
		profile = _create_profile("board@esnpolimi.it")
		user = _create_user(profile)
		user.groups.add(self.group_board)
		self.authenticate(user)

		section = ContentSection.objects.create(title="LINK_UTILI", is_active=True)
		response = self.client.post("/backend/content/links/", {
			"section": section.pk,
			"name": "Bad Link",
			"url": "not-a-url",
		}, format="json")

		self.assertEqual(response.status_code, 400)
		self.assertIn("url", response.data)


class ContentModelTests(ContentBaseTestCase):
	"""Tests for Content model properties."""

	def test_section_str_representation(self):
		"""Section str should return title."""
		section = ContentSection.objects.create(title="LINK_UTILI")

		self.assertIn("LINK", str(section))

	def test_link_str_representation(self):
		"""Link str should return name."""
		section = ContentSection.objects.create(title="LINK_UTILI")
		link = ContentLink.objects.create(
			section=section,
			name="Test Link",
			url="https://example.com",
		)

		self.assertIn("Test Link", str(link))

	def test_section_default_values(self):
		"""Section should have correct default values."""
		section = ContentSection.objects.create(title="WIKI_TUTORIAL")

		self.assertTrue(section.is_active)
		self.assertEqual(section.order, 0)

	def test_link_default_values(self):
		"""Link should have correct default values."""
		section = ContentSection.objects.create(title="LINK_UTILI")
		link = ContentLink.objects.create(
			section=section,
			name="Default Link",
			url="https://example.com",
		)

		self.assertEqual(link.color, "#1976d2")
		self.assertEqual(link.order, 0)


class ContentSectionDetailEdgeCaseTests(ContentBaseTestCase):
	"""Edge case tests for section detail operations."""

	def test_get_nonexistent_section_returns_404(self):
		"""GET on nonexistent section should return 404."""
		profile = _create_profile("viewer@esnpolimi.it")
		user = _create_user(profile)
		self.authenticate(user)

		response = self.client.get("/backend/content/sections/99999/")

		self.assertEqual(response.status_code, 404)

	def test_delete_nonexistent_section_returns_404(self):
		"""DELETE on nonexistent section should return 404."""
		profile = _create_profile("board@esnpolimi.it")
		user = _create_user(profile)
		user.groups.add(self.group_board)
		self.authenticate(user)

		response = self.client.delete("/backend/content/sections/99999/")

		self.assertEqual(response.status_code, 404)

	def test_patch_section_partial_update(self):
		"""PATCH should update only specified fields."""
		profile = _create_profile("board@esnpolimi.it")
		user = _create_user(profile)
		user.groups.add(self.group_board)
		self.authenticate(user)

		section = ContentSection.objects.create(
			title="LINK_UTILI",
			is_active=True,
			order=5,
		)

		response = self.client.patch(f"/backend/content/sections/{section.pk}/", {
			"order": 10,
		})

		self.assertEqual(response.status_code, 200)
		section.refresh_from_db()
		self.assertEqual(section.order, 10)
		self.assertTrue(section.is_active)  # Unchanged
		self.assertEqual(section.title, "LINK_UTILI")  # Unchanged


class ContentLinkDetailEdgeCaseTests(ContentBaseTestCase):
	"""Edge case tests for link detail operations."""

	def test_get_nonexistent_link_returns_404(self):
		"""GET on nonexistent link should return 404."""
		profile = _create_profile("viewer@esnpolimi.it")
		user = _create_user(profile)
		self.authenticate(user)

		response = self.client.get("/backend/content/links/99999/")

		self.assertEqual(response.status_code, 404)

	def test_delete_nonexistent_link_returns_404(self):
		"""DELETE on nonexistent link should return 404."""
		profile = _create_profile("board@esnpolimi.it")
		user = _create_user(profile)
		user.groups.add(self.group_board)
		self.authenticate(user)

		response = self.client.delete("/backend/content/links/99999/")

		self.assertEqual(response.status_code, 404)

	def test_create_link_with_missing_section_returns_400(self):
		"""Creating link without section should return 400."""
		profile = _create_profile("board@esnpolimi.it")
		user = _create_user(profile)
		user.groups.add(self.group_board)
		self.authenticate(user)

		response = self.client.post("/backend/content/links/", {
			"name": "Orphan Link",
			"url": "https://example.com",
		}, format="json")

		self.assertEqual(response.status_code, 400)

	def test_create_link_with_nonexistent_section_returns_400(self):
		"""Creating link with nonexistent section should return 400."""
		profile = _create_profile("board@esnpolimi.it")
		user = _create_user(profile)
		user.groups.add(self.group_board)
		self.authenticate(user)

		response = self.client.post("/backend/content/links/", {
			"section": 99999,
			"name": "Bad Section Link",
			"url": "https://example.com",
		}, format="json")

		self.assertEqual(response.status_code, 400)


class ContentOrderingTests(ContentBaseTestCase):
	"""Tests for content ordering functionality."""

	def test_sections_ordered_by_order_field(self):
		"""Sections should be returned ordered by order field."""
		profile = _create_profile("viewer@esnpolimi.it")
		user = _create_user(profile)
		self.authenticate(user)

		# Only two valid categories exist
		ContentSection.objects.create(title="LINK_UTILI", order=2, is_active=True)
		ContentSection.objects.create(title="WIKI_TUTORIAL", order=1, is_active=True)

		response = self.client.get("/backend/content/sections/")

		self.assertEqual(response.status_code, 200)
		# Response is paginated
		results = response.data.get('results', response.data)
		# Should be ordered by order field
		self.assertEqual(results[0]["order"], 1)
		self.assertEqual(results[1]["order"], 2)

	def test_links_ordered_by_order_field(self):
		"""Links should be returned ordered by order field."""
		profile = _create_profile("viewer@esnpolimi.it")
		user = _create_user(profile)
		self.authenticate(user)

		section = ContentSection.objects.create(title="LINK_UTILI", is_active=True)
		ContentLink.objects.create(section=section, name="C", url="https://c.com", order=3)
		ContentLink.objects.create(section=section, name="A", url="https://a.com", order=1)
		ContentLink.objects.create(section=section, name="B", url="https://b.com", order=2)

		response = self.client.get("/backend/content/links/")

		self.assertEqual(response.status_code, 200)
		results = response.data.get('results', response.data)
		names = [l["name"] for l in results]
		self.assertEqual(names, ["A", "B", "C"])


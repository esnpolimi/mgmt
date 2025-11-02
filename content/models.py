from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class ContentSection(models.Model):
    """
    Represents a section of content on the home page.
    Only two categories: LINK UTILI and WIKI E TUTORIAL
    """
    CATEGORY_CHOICES = [
        ('LINK_UTILI', 'LINK UTILI'),
        ('WIKI_TUTORIAL', 'WIKI E TUTORIAL'),
    ]
    
    title = models.CharField(
        max_length=200, 
        choices=CATEGORY_CHOICES,
        unique=True,
        verbose_name="Categoria"
    )
    order = models.IntegerField(default=0, verbose_name="Ordine")
    is_active = models.BooleanField(default=True, verbose_name="Attivo")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='content_sections_created'
    )

    class Meta:
        ordering = ['order', 'title']
        verbose_name = "Sezione Contenuto"
        verbose_name_plural = "Sezioni Contenuto"

    def __str__(self):
        return self.get_title_display()


class ContentLink(models.Model):
    """
    Represents a link within a content section.
    Required fields: name, url, color. Description is optional.
    """
    section = models.ForeignKey(
        ContentSection,
        on_delete=models.CASCADE,
        related_name='links',
        verbose_name="Sezione"
    )
    name = models.CharField(max_length=200, verbose_name="Titolo")
    description = models.TextField(blank=True, verbose_name="Descrizione", help_text="Descrizione del link (opzionale)")
    url = models.URLField(max_length=500, verbose_name="Link/URL")
    color = models.CharField(max_length=7, default="#1976d2", verbose_name="Colore", help_text="Formato: #RRGGBB")
    order = models.IntegerField(default=0, verbose_name="Ordine")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='content_links_created'
    )

    class Meta:
        ordering = ['order', 'name']
        verbose_name = "Link Contenuto"
        verbose_name_plural = "Link Contenuto"

    def __str__(self):
        return f"{self.section.get_title_display()} - {self.name}"

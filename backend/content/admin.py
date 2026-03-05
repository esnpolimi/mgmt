from django.contrib import admin
from .models import ContentSection, ContentLink, WhatsAppConfig


class ContentLinkInline(admin.TabularInline):
    model = ContentLink
    extra = 1
    fields = ('name', 'description', 'url', 'color', 'order')


@admin.register(ContentSection)
class ContentSectionAdmin(admin.ModelAdmin):
    list_display = ('get_title_display', 'order', 'is_active', 'created_at', 'updated_at')
    list_filter = ('is_active', 'created_at')
    search_fields = ('title',)
    ordering = ('order', 'title')
    inlines = [ContentLinkInline]
    
    def save_model(self, request, obj, form, change):
        if not change:  # If creating new object
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(ContentLink)
class ContentLinkAdmin(admin.ModelAdmin):
    list_display = ('name', 'section', 'url', 'color', 'order')
    list_filter = ('section', 'created_at')
    search_fields = ('name', 'description', 'url')
    ordering = ('section', 'order', 'name')
    
    def save_model(self, request, obj, form, change):
        if not change:  # If creating new object
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(WhatsAppConfig)
class WhatsAppConfigAdmin(admin.ModelAdmin):
    list_display = ('whatsapp_link', 'updated_at', 'updated_by')
    readonly_fields = ('updated_at', 'updated_by')

    def has_add_permission(self, request):
        # Only one instance allowed
        return not WhatsAppConfig.objects.exists()

    def save_model(self, request, obj, form, change):
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)

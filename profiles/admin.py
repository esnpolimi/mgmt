# This file is needed for administrating models from django admin

from django.contrib import admin
from .models import Profile, Document

@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ('number', 'profile', 'type', 'expiration', 'is_valid', 'is_enabled')
    search_fields = ('number', 'profile__name', 'type')
    list_filter = ('type', 'expiration')

    def is_valid(self, obj):
        return obj.is_valid
    is_valid.boolean = True
    is_valid.short_description = 'Is Valid'

    def is_enabled(self, obj):
        return obj.enabled
    is_enabled.boolean = True
    is_enabled.short_description = 'Is Enabled'

@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = [
        'email', 'name', 'birthdate', 'country', 'course', 'created_at', 'is_esner',
        'enabled', 'email_is_verified', 'gender', 'person_code', 'phone', 'residency',
        'surname', 'updated_at', 'whatsapp', 'matricola_number', 'matricola_expiration'
    ]
    search_fields = ('email', 'name', 'surname', 'person_code')
    list_filter = ('is_esner', 'enabled', 'country', 'created_at')
    ordering = ('-created_at',)

    fields = [
        'email', 'name', 'birthdate', 'country', 'course', 'is_esner',
        'enabled', 'email_is_verified', 'gender', 'person_code', 'phone', 'residency',
        'surname', 'whatsapp', 'matricola_number', 'matricola_expiration', 'created_at', 'updated_at'
    ]  # Ensure all fields are included here

    readonly_fields = ('created_at', 'updated_at')  # Make only certain fields read-only

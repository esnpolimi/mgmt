# This file is needed for administrating models from django admin

from django.contrib import admin
from .models import Profile


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = [
        'email', 'name', 'birthdate', 'country', 'course', 'created_at', 'is_esner',
        'enabled', 'email_is_verified', 'gender', 'person_code', 'phone', 'residency',
        'surname', 'updated_at', 'whatsapp'
    ]
    search_fields = ('email', 'name', 'surname', 'person_code')
    list_filter = ('is_esner', 'enabled', 'country', 'created_at')
    ordering = ('-created_at',)

    fields = [
        'email', 'name', 'birthdate', 'country', 'course', 'is_esner',
        'enabled', 'email_is_verified', 'gender', 'person_code', 'phone', 'residency',
        'surname', 'whatsapp', 'created_at', 'updated_at'
    ]  # Ensure all fields are included here

    readonly_fields = ('created_at', 'updated_at')  # Make only certain fields read-only

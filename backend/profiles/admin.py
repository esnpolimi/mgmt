# This file is needed for administrating models from django admin

from django.contrib import admin
from django import forms

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


class ProfileAdminForm(forms.ModelForm):
    class Meta:
        model = Profile
        fields = '__all__'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Make fields optional in the form
        optional_fields = [
            'whatsapp_prefix', 'whatsapp_number',
            'phone_prefix', 'phone_number',
            'domicile', 'matricola_number',
            'matricola_expiration', 'course'
        ]

        for field_name in optional_fields:
            if field_name in self.fields:
                self.fields[field_name].required = False


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    form = ProfileAdminForm
    list_display = [
        'email', 'is_esner', 'get_groups',
        'name', 'surname', 'birthdate',
        'phone_prefix', 'phone_number', 'whatsapp_prefix', 'whatsapp_number',
        'country', 'domicile',
        'course', 'person_code', 'matricola_number', 'matricola_expiration',
        'created_at', 'updated_at',
        'enabled', 'email_is_verified'
    ]
    search_fields = ('email', 'name', 'surname', 'birthdate',
                     'phone_number', 'whatsapp_number',
                     'country', 'domicile',
                     'course', 'person_code', 'matricola_number', 'matricola_expiration',
                     'created_at', 'updated_at')
    list_filter = ('is_esner', 'enabled', 'email_is_verified')
    ordering = ('-created_at',)

    fields = [
        'email', 'is_esner',
        'name', 'surname', 'birthdate',
        'phone_prefix', 'phone_number', 'whatsapp_prefix', 'whatsapp_number',
        'country', 'domicile',
        'course', 'person_code', 'matricola_number', 'matricola_expiration',
        'created_at', 'updated_at',
        'enabled', 'email_is_verified'
    ]

    readonly_fields = ('created_at', 'updated_at')

    def get_groups(self, obj):
        if obj.is_esner and hasattr(obj, 'user') and obj.user:
            groups = obj.user.groups.all()
            return ", ".join([group.name for group in groups])
        return "-"

    get_groups.short_description = "Groups"

    def get_queryset(self, request):
        # Prefetch related user for efficiency
        return super().get_queryset(request).select_related('user')

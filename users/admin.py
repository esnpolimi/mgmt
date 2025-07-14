from django.contrib import admin
from .models import User
from .forms import UserForm
from django.contrib.admin import SimpleListFilter
from profiles.models import Profile

class UserProfileNameFilter(SimpleListFilter):
    title = 'Profile Name'
    parameter_name = 'profile__name'

    def lookups(self, request, model_admin):
        user_profiles = Profile.objects.filter(user__isnull=False)
        names = user_profiles.values_list('name', flat=True).distinct()
        return [(name, name) for name in names]

    def queryset(self, request, queryset):
        value = self.value()
        if value:
            return queryset.filter(profile__name=value)
        return queryset

class UserProfileSurnameFilter(SimpleListFilter):
    title = 'Profile Surname'
    parameter_name = 'profile__surname'

    def lookups(self, request, model_admin):
        user_profiles = Profile.objects.filter(user__isnull=False)
        surnames = user_profiles.values_list('surname', flat=True).distinct()
        return [(surname, surname) for surname in surnames]

    def queryset(self, request, queryset):
        value = self.value()
        if value:
            return queryset.filter(profile__surname=value)
        return queryset

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    form = UserForm
    list_display = (
        'profile_id',
        'profile_email',
        'profile_name',
        'profile_surname',
        'is_staff',
        'is_superuser',
        'date_joined',
        'last_login',
    )
    list_filter = (
        'is_staff',
        'is_superuser',
        'date_joined',
        'last_login',
        UserProfileNameFilter,
        UserProfileSurnameFilter,
    )
    search_fields = (
        'profile__email',
        'profile__name',
        'profile__surname',
    )
    readonly_fields = ('date_joined', 'last_login')
    ordering = ('-date_joined',)
    list_per_page = 50

    def profile_id(self, obj):
        return obj.profile.id
    profile_id.short_description = 'Profile ID'

    def profile_email(self, obj):
        return obj.profile.email
    profile_email.short_description = 'Email'

    def profile_name(self, obj):
        return obj.profile.name
    profile_name.short_description = 'Name'

    def profile_surname(self, obj):
        return obj.profile.surname
    profile_surname.short_description = 'Surname'

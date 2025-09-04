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
        'groups_list',
        'date_joined',
        'last_login',
    )
    list_filter = (
        'is_staff',
        'is_superuser',
        'groups',
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

    def get_fieldsets(self, request, obj=None):
        if not obj:  # Adding a new user
            return [
                (None, {'fields': ['profile', 'password', 'is_staff', 'is_superuser', 'groups', 'user_permissions']}),
            ]
        else:  # Editing existing user
            return [
                (None, {'fields': ['profile', 'is_staff', 'is_superuser', 'groups', 'user_permissions']}),
            ]

    def get_readonly_fields(self, request, obj=None):
        readonly = list(self.readonly_fields)
        if obj:  # Editing existing user
            readonly.append('password')  # Make password read-only for existing users
        return readonly

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

    def groups_list(self, obj):
        names = obj.groups.values_list('name', flat=True)
        return ", ".join(names) if names else "-"

    groups_list.short_description = 'Groups'

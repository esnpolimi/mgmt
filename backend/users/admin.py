from django.contrib import admin
from .models import User
from .forms import UserForm

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    form = UserForm
    list_display = ('profile_id', 'profile', 'is_staff', 'date_joined')

    def profile_id(self, obj):
        return obj.profile.id


    profile_id.short_description = 'Profile ID'
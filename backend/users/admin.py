from django.contrib import admin
from .models import User
from .forms import UserForm

# Register your models here.
@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    form = UserForm
from django import forms
from .models import User

class UserForm(forms.ModelForm):
    #birthdate = forms.DateField(widget=forms.TextInput(attrs={'type': 'date'}))
    password = forms.CharField(widget=forms.PasswordInput())

    class Meta:
        model = User
        exclude = ['creation_time','last_modified']
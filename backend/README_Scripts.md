##### Script to change one user's password
```python manage.py shell```
``` python
from users.models import User
from django.contrib.auth.hashers import check_password
u = User.objects.get(profile="matteo.pompilio@esnpolimi.it")
u.set_password('Pollo')
u.save()
print(check_password('Pollo', u.password))
```

##### Script to check all available permissions
```python manage.py shell```
``` python
from django.contrib.auth.models import Permission
permissions = Permission.objects.all()
def a():
    for perm in permissions:
        print(f"App: {perm.content_type.app_label}, Model: {perm.content_type.model}, Permission: {perm.codename}")

a()
```
How to use: `if request.user.has_perm('profiles.change_profile')`
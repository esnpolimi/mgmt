# Setting Environment Variables Before Running Django
To ensure your Django project runs with the correct environment (`development` or `production`), you need to set the environment variable `DJANGO_ENV` **before** running the `python manage.py runserver` command.
## **On macOS/Linux**
You can export the environment variable using the `export` command in your terminal.

### For Development:
``` bash
DJANGO_ENV=development DJANGO_SETTINGS_MODULE=backend.settings.dev python manage.py runserver
```
### For Production:
``` bash
DJANGO_ENV=production DJANGO_SETTINGS_MODULE=backend.settings.prod python manage.py runserver
```

## **On Windows (Command Prompt)**
Use the `set` command to define the environment variable.
### For Development:
``` bash
$set DJANGO_ENV="development" && set DJANGO_SETTINGS_MODULE="backend.settings.dev" && python manage.py runserver
```
### For Production:
``` bash
$set DJANGO_ENV="production" && set DJANGO_SETTINGS_MODULE="backend.settings.prod" && python manage.py runserver
```

## **On Windows (PowerShell)**
In PowerShell, use the `$env:` prefix to set the environment variable.
### For Development:
``` bash
$env:DJANGO_ENV="development"; $env:DJANGO_SETTINGS_MODULE="backend.settings.dev"; python manage.py runserver
```
### For Production:
``` bash
$env:DJANGO_ENV="production"; $env:DJANGO_SETTINGS_MODULE="backend.settings.prod"; python manage.py runserver
```
## Verify the Current Environment
To ensure the environment variable is set correctly, you can temporarily add a print statement to your `manage.py` file:
``` python
import os

print("DJANGO_ENV:", os.getenv("DJANGO_ENV", "Not Set"))
print("DJANGO_SETTINGS_MODULE:", os.getenv("DJANGO_SETTINGS_MODULE"))
```
When you run the `runserver` command, it should output either `development` or `production`.
This approach ensures Django loads the correct settings file (e.g., `backend.settings.dev` or `backend.settings.prod`) based on the value of `DJANGO_ENV`.

# More

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

The combination of App and Permission is sufficient to identify the permission:
```
App: admin, Model: logentry, Permission: add_logentry
App: admin, Model: logentry, Permission: change_logentry
App: admin, Model: logentry, Permission: delete_logentry
App: admin, Model: logentry, Permission: view_logentry
App: auth, Model: group, Permission: add_group
App: auth, Model: group, Permission: change_group
App: auth, Model: group, Permission: delete_group
App: auth, Model: group, Permission: view_group
App: auth, Model: permission, Permission: add_permission
App: auth, Model: permission, Permission: change_permission
App: auth, Model: permission, Permission: delete_permission
App: auth, Model: permission, Permission: view_permission
App: contenttypes, Model: contenttype, Permission: add_contenttype
App: contenttypes, Model: contenttype, Permission: change_contenttype
App: contenttypes, Model: contenttype, Permission: delete_contenttype
App: contenttypes, Model: contenttype, Permission: view_contenttype
App: events, Model: event, Permission: add_event
App: events, Model: event, Permission: change_event
App: events, Model: event, Permission: delete_event
App: events, Model: event, Permission: view_event
App: events, Model: historicalsubscription, Permission: add_historicalsubscription
App: events, Model: historicalsubscription, Permission: change_historicalsubscription
App: events, Model: historicalsubscription, Permission: delete_historicalsubscription
App: events, Model: historicalsubscription, Permission: view_historicalsubscription
App: events, Model: subscription, Permission: add_subscription
App: events, Model: subscription, Permission: change_subscription
App: events, Model: subscription, Permission: delete_subscription
App: events, Model: subscription, Permission: view_subscription
App: profiles, Model: document, Permission: add_document
App: profiles, Model: document, Permission: change_document
App: profiles, Model: document, Permission: delete_document
App: profiles, Model: document, Permission: view_document
App: profiles, Model: historicalprofile, Permission: add_historicalprofile
App: profiles, Model: historicalprofile, Permission: change_historicalprofile
App: profiles, Model: historicalprofile, Permission: delete_historicalprofile
App: profiles, Model: historicalprofile, Permission: view_historicalprofile
App: profiles, Model: matricola, Permission: add_matricola
App: profiles, Model: matricola, Permission: change_matricola
App: profiles, Model: matricola, Permission: delete_matricola
App: profiles, Model: matricola, Permission: view_matricola
App: profiles, Model: profile, Permission: add_profile
App: profiles, Model: profile, Permission: change_profile
App: profiles, Model: profile, Permission: delete_profile
App: profiles, Model: profile, Permission: view_profile
App: sessions, Model: session, Permission: add_session
App: sessions, Model: session, Permission: change_session
App: sessions, Model: session, Permission: delete_session
App: sessions, Model: session, Permission: view_session
App: token_blacklist, Model: blacklistedtoken, Permission: add_blacklistedtoken
App: token_blacklist, Model: blacklistedtoken, Permission: change_blacklistedtoken
App: token_blacklist, Model: blacklistedtoken, Permission: delete_blacklistedtoken
App: token_blacklist, Model: blacklistedtoken, Permission: view_blacklistedtoken
App: token_blacklist, Model: outstandingtoken, Permission: add_outstandingtoken
App: token_blacklist, Model: outstandingtoken, Permission: change_outstandingtoken
App: token_blacklist, Model: outstandingtoken, Permission: delete_outstandingtoken
App: token_blacklist, Model: outstandingtoken, Permission: view_outstandingtoken
App: treasury, Model: account, Permission: add_account
App: treasury, Model: account, Permission: change_account
App: treasury, Model: account, Permission: delete_account
App: treasury, Model: account, Permission: view_account
App: treasury, Model: esncard, Permission: add_esncard
App: treasury, Model: esncard, Permission: change_esncard
App: treasury, Model: esncard, Permission: delete_esncard
App: treasury, Model: esncard, Permission: view_esncard
App: treasury, Model: historicalaccount, Permission: add_historicalaccount
App: treasury, Model: historicalaccount, Permission: change_historicalaccount
App: treasury, Model: historicalaccount, Permission: delete_historicalaccount
App: treasury, Model: historicalaccount, Permission: view_historicalaccount
App: treasury, Model: transaction, Permission: add_transaction
App: treasury, Model: transaction, Permission: change_transaction
App: treasury, Model: transaction, Permission: delete_transaction
App: treasury, Model: transaction, Permission: view_transaction
App: users, Model: user, Permission: add_user
App: users, Model: user, Permission: change_user
App: users, Model: user, Permission: delete_user
App: users, Model: user, Permission: view_user
```
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

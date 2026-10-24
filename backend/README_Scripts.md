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

##### Monthly log archive

Archive all `.log` files to `GOOGLE_DRIVE_FOLDER_ID/Logs/YYYY/MM`:

```bash
python manage.py archive_logs_to_drive
```

On the production server, add this crontab entry to run at 23:30 Europe/Rome
on the last day of every month:

```cron
CRON_TZ=Europe/Rome
30 23 * * * cd /path/to/backend && /path/to/venv/bin/python manage.py archive_logs_to_drive >> /var/log/esn-log-archive.log 2>&1
```

The command copies logs without deleting them. Each execution creates a
timestamped Drive file, so reruns preserve every archive attempt.
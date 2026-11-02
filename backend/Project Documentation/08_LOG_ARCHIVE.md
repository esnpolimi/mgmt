# Log Archive

## Google Drive structure

The monthly archive uses the configured `GOOGLE_DRIVE_FOLDER_ID` as its root
and creates the following folders when needed:

```text
<configured Drive folder>/
└── Logs/
    └── YYYY/
        └── MM/
```

## Scheduled command

Run from the backend directory:

```bash
python manage.py archive_logs_to_drive
```

Production crontab (23:30 Europe/Rome on the last day of every month):

```cron
CRON_TZ=Europe/Rome
30 23 * * * [ "$(date -d tomorrow +\%d)" = 01 ] && cd /path/to/backend && DJANGO_ENV=prod DJANGO_SETTINGS_MODULE=backend.settings.prod /path/to/venv/bin/python manage.py archive_logs_to_drive >> "$HOME/esn-log-archive.log" 2>&1
```

The month-end check uses GNU `date` on the Linux/cPanel server; keep `\%`
escaped because cron treats unescaped percent signs specially. The cron user
must be able to create or append to `$HOME/esn-log-archive.log`; no write access
to `/var/log` is required. Both Django environment variables explicitly select
production settings.

The command uploads every `.log` file below the backend directory and does not
delete or truncate local logs. Uploaded names include the execution timestamp;
rerunning the command therefore creates a separate copy instead of overwriting
an existing archive. Each log is uploaded with resumable 1 MiB chunks.

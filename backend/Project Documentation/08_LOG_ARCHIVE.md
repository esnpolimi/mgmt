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

Production crontab:

```cron
CRON_TZ=Europe/Rome
30 23 * * * cd /path/to/backend && /path/to/venv/bin/python manage.py archive_logs_to_drive >> /var/log/esn-log-archive.log 2>&1
```

The command uploads every `.log` file below the backend directory and does not
delete or truncate local logs. Uploaded names include the execution timestamp;
rerunning the command therefore creates a separate copy instead of overwriting
an existing archive.

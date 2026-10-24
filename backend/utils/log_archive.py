from datetime import datetime
from pathlib import Path

from django.conf import settings
from googleapiclient.http import MediaFileUpload

from utils.google_drive import find_or_create_folder


def archive_logs_to_drive(service, archive_date=None):
    archive_date = archive_date or datetime.now().astimezone()
    root_folder_id = find_or_create_folder(
        service, "Logs", settings.GOOGLE_DRIVE_FOLDER_ID
    )
    year_folder_id = find_or_create_folder(
        service, str(archive_date.year), root_folder_id
    )
    month_folder_id = find_or_create_folder(
        service, f"{archive_date.month:02d}", year_folder_id
    )

    log_paths = sorted(
        path
        for path in settings.BASE_DIR.rglob("*.log")
        if path.is_file() and "node_modules" not in path.parts
    )
    uploaded = []
    timestamp = archive_date.strftime("%Y%m%d-%H%M%S")
    for path in log_paths:
        metadata = {
            "name": f"{path.stem}-{timestamp}{path.suffix}",
            "parents": [month_folder_id],
        }
        uploaded_file = service.files().create(
            body=metadata,
            media_body=MediaFileUpload(str(path), mimetype="text/plain"),
            fields="id,name",
            supportsAllDrives=True,
        ).execute()
        uploaded.append(uploaded_file)
    return uploaded

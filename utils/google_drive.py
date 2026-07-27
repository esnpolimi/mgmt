from django.conf import settings
from google.oauth2 import service_account
from googleapiclient.discovery import build

DRIVE_SCOPE = "https://www.googleapis.com/auth/drive"


def get_drive_service():
    credentials = service_account.Credentials.from_service_account_file(
        settings.GOOGLE_SERVICE_ACCOUNT_FILE,
        scopes=[DRIVE_SCOPE],
    )
    return build("drive", "v3", credentials=credentials)


def find_or_create_folder(service, folder_name, parent_id):
    """Find or create a Drive folder by name under parent_id; returns folder ID."""
    escaped = folder_name.replace("'", "\\'")
    query = (
        f"name='{escaped}' and '{parent_id}' in parents "
        "and mimeType='application/vnd.google-apps.folder' and trashed=false"
    )
    results = service.files().list(
        q=query,
        spaces="drive",
        fields="files(id)",
        supportsAllDrives=True,
        includeItemsFromAllDrives=True,
    ).execute()
    folders = results.get("files", [])
    if folders:
        return folders[0]["id"]
    folder = service.files().create(
        body={
            "name": folder_name,
            "mimeType": "application/vnd.google-apps.folder",
            "parents": [parent_id],
        },
        fields="id",
        supportsAllDrives=True,
    ).execute()
    return folder["id"]

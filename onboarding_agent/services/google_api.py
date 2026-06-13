"""Google Drive and Google Sheets helpers for the onboarding agent.

Authentication uses Application Default Credentials (ADC). Set up ADC with:

    gcloud auth application-default login \
        --scopes=https://www.googleapis.com/auth/drive,https://www.googleapis.com/auth/spreadsheets

or point GOOGLE_APPLICATION_CREDENTIALS at a service-account key file.
"""

import io
import logging

import google.auth
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

from config import GOOGLE_SCOPES

logger = logging.getLogger(__name__)

DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder"
PDF_MIME_TYPE = "application/pdf"


def get_credentials():
    """Load Application Default Credentials with the scopes we need."""
    credentials, _project_id = google.auth.default(scopes=GOOGLE_SCOPES)
    return credentials


def build_drive_service(credentials=None):
    credentials = credentials or get_credentials()
    return build("drive", "v3", credentials=credentials)


def build_sheets_service(credentials=None):
    credentials = credentials or get_credentials()
    return build("sheets", "v4", credentials=credentials)


def find_folder_id_by_name(drive_service, folder_name: str) -> str:
    """Find a Drive folder's ID by its name.

    Raises a ValueError if no folder (or more than one) is found.
    """
    query = (
        f"name = '{folder_name}' "
        f"and mimeType = '{DRIVE_FOLDER_MIME_TYPE}' "
        "and trashed = false"
    )
    response = drive_service.files().list(
        q=query,
        fields="files(id, name)",
        spaces="drive",
    ).execute()

    folders = response.get("files", [])
    if not folders:
        raise ValueError(f"No folder named '{folder_name}' found in Drive.")
    if len(folders) > 1:
        logger.warning(
            "Multiple folders named '%s' found, using the first one (id=%s).",
            folder_name,
            folders[0]["id"],
        )
    return folders[0]["id"]


def list_pdfs_in_folder(drive_service, folder_id: str) -> list[dict]:
    """List all PDF files directly inside the given folder."""
    query = (
        f"'{folder_id}' in parents "
        f"and mimeType = '{PDF_MIME_TYPE}' "
        "and trashed = false"
    )
    files = []
    page_token = None
    while True:
        response = drive_service.files().list(
            q=query,
            fields="nextPageToken, files(id, name, parents)",
            pageToken=page_token,
        ).execute()
        files.extend(response.get("files", []))
        page_token = response.get("nextPageToken")
        if not page_token:
            break
    return files


def download_file(drive_service, file_id: str) -> bytes:
    """Download a file's binary content from Drive."""
    request = drive_service.files().get_media(fileId=file_id)
    buffer = io.BytesIO()
    downloader = MediaIoBaseDownload(buffer, request)
    done = False
    while not done:
        _status, done = downloader.next_chunk()
    return buffer.getvalue()


def move_file(drive_service, file_id: str, new_parent_id: str, old_parent_id: str) -> None:
    """Move a file from one Drive folder to another."""
    drive_service.files().update(
        fileId=file_id,
        addParents=new_parent_id,
        removeParents=old_parent_id,
        fields="id, parents",
    ).execute()


def append_row_to_sheet(sheets_service, spreadsheet_id: str, sheet_name: str, row: list) -> None:
    """Append a single row of values to the given sheet/tab."""
    sheets_service.spreadsheets().values().append(
        spreadsheetId=spreadsheet_id,
        range=f"{sheet_name}!A1",
        valueInputOption="USER_ENTERED",
        insertDataOption="INSERT_ROWS",
        body={"values": [row]},
    ).execute()

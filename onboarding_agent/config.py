"""Configuration for the Phase 0 onboarding agent.

All values can be overridden via environment variables (e.g. in a .env file).
"""

import os

from dotenv import load_dotenv

load_dotenv()

# Google Drive folder names (used for discovery when IDs are not known yet).
DROPZONE_FOLDER_NAME = os.getenv("DROPZONE_FOLDER_NAME", "01_CV_Dropzone")
PROCESSED_FOLDER_NAME = os.getenv("PROCESSED_FOLDER_NAME", "02_Processed_CVs")

# Optional: skip folder discovery if the IDs are already known.
DROPZONE_FOLDER_ID = os.getenv("DROPZONE_FOLDER_ID")
PROCESSED_FOLDER_ID = os.getenv("PROCESSED_FOLDER_ID")

# Google Sheets CRM.
CRM_SPREADSHEET_ID = os.getenv("CRM_SPREADSHEET_ID")
SKILLS_DB_SHEET_NAME = os.getenv("SKILLS_DB_SHEET_NAME", "Skills_DB")

# Gemini.
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

# Scopes required for Drive (read/write/move) and Sheets (append rows).
GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets",
]

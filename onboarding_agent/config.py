"""Configuration for the Phase 0 onboarding agent.

All values can be overridden via environment variables (e.g. in a .env file).
"""

import os
from pathlib import Path

from dotenv import load_dotenv

# Load this package's own .env regardless of the process's current working
# directory (load_dotenv() with no args would otherwise pick up a repo-root
# .env that doesn't have these settings).
load_dotenv(Path(__file__).resolve().parent / ".env")

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
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# Confidence threshold (0-100) above which extracted supplement fields are
# applied directly to an employee profile instead of staged for review.
SUPPLEMENT_AUTO_APPLY_THRESHOLD = float(os.getenv("SUPPLEMENT_AUTO_APPLY_THRESHOLD", "80"))

# Base URL of the Next.js app, used to build magic links.
APP_BASE_URL = os.getenv("APP_BASE_URL", "http://localhost:3000")

# Sender address for magic-link emails (must be the authenticated Gmail account).
GMAIL_SENDER = os.getenv("GMAIL_SENDER")

# Resend (https://resend.com) — preferred email provider when set. Works from
# localhost (outbound HTTPS only). With no verified domain, RESEND_FROM must be
# "onboarding@resend.dev" and you can only send to your own Resend signup email.
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
RESEND_FROM = os.getenv("RESEND_FROM", "onboarding@resend.dev")

# Scopes required for Drive (read/write/move), Sheets (append rows), and
# Gmail (send magic-link emails).
GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/gmail.send",
]

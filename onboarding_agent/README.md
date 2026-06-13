# Phase 0 Onboarding Agent

Watches a Google Drive "dropzone" folder for candidate CVs (PDF), extracts
structured profile data with Gemini, appends it to a `Skills_DB` tab in a
Google Sheet CRM, and moves the processed file to an archive folder.

## Setup

1. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

2. Configure environment variables. Copy `.env.example` to `.env` and fill in:

   - `GEMINI_API_KEY` — from Google AI Studio.
   - `CRM_SPREADSHEET_ID` — the Google Sheet ID containing the `Skills_DB` tab.
   - Folder IDs are optional; if left blank, the agent discovers
     `01_CV_Dropzone` and `02_Processed_CVs` by name.

3. Set up Application Default Credentials for Drive + Sheets access:

   ```bash
   gcloud auth application-default login \
     --scopes=https://www.googleapis.com/auth/drive,https://www.googleapis.com/auth/spreadsheets,https://www.googleapis.com/auth/cloud-platform
   ```

   Alternatively, set `GOOGLE_APPLICATION_CREDENTIALS` to a service-account
   key file that has access to both the Drive folders and the Sheet.

4. Ensure the `Skills_DB` tab has a header row matching:

   ```
   firstName | lastName | email | location | role | level | yearsOfExperience |
   pastIndustryExperience | skills | certifications | linkedin | sourceFile
   ```

## Run

```bash
python main.py
```

Each run processes all PDFs currently in the dropzone folder, one at a time.

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

---

# Profile Completion Service (`server.py`)

A separate FastAPI service that powers the employee-facing profile-completion
flow: it sends magic links and extracts data from employee-uploaded documents
to fill profile gaps. The Next.js app calls it over HTTP.

## Run the service

Start it **from the repository root** so relative imports and the shared
`data/employees.json` store resolve correctly:

```bash
# from the repo root, using the onboarding_agent venv
uvicorn server:app --app-dir onboarding_agent --port 8001
```

Health check: `curl http://localhost:8001/health` → `{"status":"ok"}`.

Endpoints:

- `POST /send-magic-link` — email an employee their profile link.
- `POST /process-supplement` — extract data from an uploaded document
  (PDF / PPTX / DOCX) and fill gaps. Fields scored ≥
  `SUPPLEMENT_AUTO_APPLY_THRESHOLD` (default 80) are applied directly; lower-
  confidence fields are staged in `pendingUpdates` for HR Accept/Reject.

## Email delivery

Email is **best-effort**: the magic link is always generated and returned (and
copied to the clipboard in the UI) even when no provider is configured. To send
real emails, configure **Resend** (preferred) or the Gmail API.

### Testing with Resend

Resend is an HTTP email API — it works fine with a localhost app, since the
server only makes an **outbound** HTTPS call (no public URL or tunnel needed).

1. Create a free account at https://resend.com and copy an API key
   (`re_...`) from the dashboard.

2. Add it to `onboarding_agent/.env`:

   ```bash
   RESEND_API_KEY=re_your_key_here
   RESEND_FROM=onboarding@resend.dev
   ```

   > **Free-tier limits (no verified domain):** `RESEND_FROM` must stay
   > `onboarding@resend.dev`, and you can only send **to the email address you
   > signed up with**. To email arbitrary employees, verify a domain you own in
   > the Resend dashboard (add the DNS records it shows) and set `RESEND_FROM`
   > to an address at that domain.

3. Restart the service (it reads `.env` on startup):

   ```bash
   uvicorn server:app --app-dir onboarding_agent --port 8001
   ```

4. Set a test employee's email to your Resend signup address, then trigger a
   send. Either click **Send Link** in the UI, or hit the endpoint directly:

   ```bash
   # via the onboarding_agent service
   curl -X POST http://localhost:8001/send-magic-link \
     -H "Content-Type: application/json" \
     -d '{"email":"you@example.com","name":"Test","link":"http://localhost:3000/profile/abc"}'
   # -> {"status":"success","provider":"resend"}

   # or end-to-end through the Next.js app (generates + persists the token)
   curl -X POST http://localhost:3000/api/employees/<EMPLOYEE_ID>/send-link
   # -> {"status":"success","data":{"link":"...","emailSent":true}}
   ```

   A `provider: "resend"` response (or `emailSent: true`) means the email was
   accepted by Resend — check the recipient inbox and the Resend dashboard's
   **Logs** tab for delivery status.

When `RESEND_API_KEY` is unset, the service falls back to the Gmail API (which
needs ADC with the `gmail.send` scope); if that also isn't configured, the call
returns an error but the link is still generated for manual sharing.

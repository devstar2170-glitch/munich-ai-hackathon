"""FastAPI service for the onboarding agent.

Run with:  uvicorn server:app --reload --port 8001

Exposes:
  - POST /send-magic-link    Send an employee a link to their profile-completion page.
  - POST /process-supplement Extract data from an uploaded document and fill profile gaps.
"""
from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import config
from services import google_api
from services.extractor import extract_supplement_fields, extract_text_from_docx, extract_text_from_pptx

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Onboarding Agent API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)

EMPLOYEES_FILE = Path(__file__).resolve().parent.parent / "data" / "employees.json"

ARRAY_FIELDS = {"skills", "certifications", "pastIndustryExperience", "futureIndustryWish"}
NUMERIC_FIELDS = {"yearsOfExperience"}

# Fields we consider when looking for gaps to fill from a supplement document.
PROFILE_FIELDS = [
    "email", "location", "role", "level", "yearsOfExperience",
    "pastIndustryExperience", "futureIndustryWish", "skills", "certifications",
    "availabilityStatus", "projectStart", "projectEnd", "linkedin",
]


def _load_employees() -> list[dict]:
    if not EMPLOYEES_FILE.exists():
        return []
    return json.loads(EMPLOYEES_FILE.read_text())


def _save_employees(employees: list[dict]) -> None:
    EMPLOYEES_FILE.write_text(json.dumps(employees, indent=2))


def _is_empty(value) -> bool:
    return value is None or value == "" or value == [] or value == 0


def _gap_fields(employee: dict) -> list[str]:
    return [f for f in PROFILE_FIELDS if _is_empty(employee.get(f))]


class MagicLinkRequest(BaseModel):
    email: str
    name: str
    link: str


def _send_via_resend(to: str, subject: str, html_body: str) -> None:
    """Send an email through the Resend HTTP API (outbound HTTPS, works on localhost)."""
    payload = json.dumps(
        {"from": config.RESEND_FROM, "to": [to], "subject": subject, "html": html_body}
    ).encode("utf-8")
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {config.RESEND_API_KEY}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            resp.read()
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")
        raise RuntimeError(f"Resend API error {e.code}: {detail}") from e


def _send_via_gmail(to: str, subject: str, html_body: str) -> None:
    """Send an email through the Gmail API using Application Default Credentials."""
    try:
        credentials = google_api.get_credentials()
        gmail_service = google_api.build_gmail_service(credentials)
    except Exception as e:
        raise RuntimeError(
            "Failed to authenticate with Google. Make sure ADC includes the gmail.send "
            f"scope (re-run gcloud auth application-default login with config.GOOGLE_SCOPES). {e}"
        ) from e
    google_api.send_email(
        gmail_service, to=to, subject=subject, html_body=html_body, sender=config.GMAIL_SENDER
    )


@app.post("/send-magic-link")
async def send_magic_link(body: MagicLinkRequest):
    """Email an employee a link to their profile-completion page.

    Uses Resend when RESEND_API_KEY is set, otherwise falls back to the Gmail API.
    """
    html_body = f"""
    <p>Hi {body.name},</p>
    <p>We're missing a few details on your staffing profile. You can fill them in
    yourself, or upload a CV, project deck, or certificate and we'll extract the
    details automatically:</p>
    <p><a href="{body.link}">{body.link}</a></p>
    <p>Thanks!</p>
    """
    subject = "Complete your Atira staffing profile"

    try:
        if config.RESEND_API_KEY:
            _send_via_resend(body.email, subject, html_body)
            provider = "resend"
        else:
            _send_via_gmail(body.email, subject, html_body)
            provider = "gmail"
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"status": "success", "provider": provider}


@app.post("/process-supplement")
async def process_supplement(employee_id: str = Form(...), file: UploadFile = File(...)):
    """Extract data from an uploaded supplement document and apply/stage it onto
    the employee's profile based on Gemini's confidence per field."""
    employees = _load_employees()
    employee = next((e for e in employees if e["id"] == employee_id), None)
    if employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")

    gap_fields = _gap_fields(employee)
    if not gap_fields:
        return {"status": "success", "applied": [], "pending": [], "message": "No profile gaps to fill."}

    content = await file.read()
    mime_type = file.content_type or "application/octet-stream"
    name = file.filename or "supplement"
    suffix = Path(name).suffix.lower()

    if suffix == ".pptx":
        text = extract_text_from_pptx(content)
        gemini_bytes, gemini_mime = text.encode("utf-8"), "text/plain"
    elif suffix == ".docx":
        text = extract_text_from_docx(content)
        gemini_bytes, gemini_mime = text.encode("utf-8"), "text/plain"
    else:
        gemini_bytes, gemini_mime = content, mime_type

    try:
        extraction = extract_supplement_fields(gemini_bytes, gemini_mime, name, employee, gap_fields)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract supplement: {e}")

    applied = []
    pending = employee.get("pendingUpdates") or {}

    for field_update in extraction.fields:
        field = field_update.field
        if field not in gap_fields:
            continue

        value: object = field_update.value
        if field in ARRAY_FIELDS:
            value = [v.strip() for v in field_update.value.split(",") if v.strip()]
        elif field in NUMERIC_FIELDS:
            try:
                value = float(field_update.value)
            except ValueError:
                continue

        if field_update.confidence >= config.SUPPLEMENT_AUTO_APPLY_THRESHOLD:
            employee[field] = value
            applied.append({"field": field, "value": value, "confidence": field_update.confidence})
        else:
            pending[field] = {
                "value": value,
                "confidence": field_update.confidence,
                "reasoning": field_update.reasoning,
                "source": name,
            }

    employee["pendingUpdates"] = pending
    _save_employees(employees)

    pending_list = [{"field": f, **v} for f, v in pending.items()]
    return {"status": "success", "applied": applied, "pending": pending_list}


@app.get("/health")
def health():
    return {"status": "ok"}

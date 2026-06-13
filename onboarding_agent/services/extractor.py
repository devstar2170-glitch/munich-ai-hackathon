"""Gemini-based CV data extraction."""

import json
import logging

import google.generativeai as genai

from config import GEMINI_API_KEY, GEMINI_MODEL
from models import CandidateProfile

logger = logging.getLogger(__name__)

SYSTEM_INSTRUCTION = """You are a CV/resume parser for a recruitment CRM.
Given the contents of a candidate's CV (PDF), extract the requested fields.

Rules:
- Respond with ONLY a single valid JSON object. No markdown, no commentary, no code fences.
- If a field cannot be determined from the CV, use null (or an empty list for list fields).
- "level" must be exactly one of: "Junior", "Mid", "Senior", "Lead".
- "yearsOfExperience" must be a number (total years of professional experience).
- "skills" should include technical and relevant soft skills mentioned in the CV.
- "pastIndustryExperience" should list the industries the candidate has worked in.
"""

_model = None


def _get_model() -> genai.GenerativeModel:
    global _model
    if _model is None:
        if not GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY environment variable is not set.")
        genai.configure(api_key=GEMINI_API_KEY)
        _model = genai.GenerativeModel(
            model_name=GEMINI_MODEL,
            system_instruction=SYSTEM_INSTRUCTION,
            generation_config={
                "response_mime_type": "application/json",
                "response_schema": CandidateProfile,
            },
        )
    return _model


def extract_candidate_profile(pdf_bytes: bytes, file_name: str) -> CandidateProfile:
    """Send a CV PDF to Gemini and return a validated CandidateProfile."""
    model = _get_model()

    logger.info("Sending '%s' to Gemini (%s) for extraction...", file_name, GEMINI_MODEL)
    response = model.generate_content(
        [
            {"mime_type": "application/pdf", "data": pdf_bytes},
            "Extract the candidate's profile information from this CV.",
        ]
    )

    raw_text = response.text
    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Gemini did not return valid JSON for '{file_name}': {raw_text!r}") from exc

    return CandidateProfile.model_validate(data)

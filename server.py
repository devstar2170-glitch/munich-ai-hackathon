"""FastAPI server exposing the RFP Analysis Agent as HTTP endpoints.

Run with:  uvicorn server:app --reload --port 8000
The Next.js frontend at localhost:3000 calls this server.
"""
from __future__ import annotations

import asyncio
import json
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from typing import List
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from rfp_agent import RFPAnalysisAgent, RFPAnalysis

app = FastAPI(title="RFP Analysis Agent API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _build_agent() -> RFPAnalysisAgent:
    try:
        return RFPAnalysisAgent()
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))


def _to_frontend_shape(analysis: RFPAnalysis) -> dict:
    """Map RFPAnalysis to the shape the Next.js frontend expects."""
    requirements = [
        f"{r.id} [{r.priority.upper()}{'*' if r.is_mandatory else ''}] {r.title}: {r.description}"
        for r in analysis.requirements
    ]

    ambiguity = (
        analysis.pitfalls[0]
        if analysis.pitfalls
        else (analysis.analysis_notes[0] if analysis.analysis_notes else "No critical ambiguities identified.")
    )

    suggested_skills = [
        f"{s.skill} — {s.proficiency_level} × {s.quantity_needed}"
        for s in analysis.skills_required
    ]

    return {
        "requirements": requirements,
        "ambiguity": ambiguity,
        "suggestedSkills": suggested_skills,
    }


@app.post("/api/analyze")
async def analyze_rfq(file: UploadFile = File(...)):
    """Accept an RFP file, run the analysis agent, return structured results.

    Returns both the frontend-compatible shape and the full rich analysis
    so the UI can display as much detail as it wants.
    """
    suffix = Path(file.filename or "rfp.pdf").suffix or ".pdf"
    content = await file.read()

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        agent = _build_agent()
        analysis = agent.analyze_file(tmp_path)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {e}")
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    frontend = _to_frontend_shape(analysis)

    return {
        # Frontend-compatible fields (what gemini.ts currently expects)
        **frontend,
        # Rich data for enhanced UI display
        "rfp_title": analysis.rfp_title,
        "client_name": analysis.client_name,
        "rfp_summary": analysis.rfp_summary,
        "submission_deadline": analysis.submission_deadline,
        "project_duration": analysis.project_duration,
        "budget_constraints": analysis.budget_constraints,
        "confidence_score": analysis.confidence_score,
        "deadlines": [d.model_dump() for d in analysis.deadlines],
        "risks": [r.model_dump() for r in analysis.risks],
        "dependencies": [d.model_dump() for d in analysis.dependencies],
        "compliance_norms": [c.model_dump() for c in analysis.compliance_norms],
        "key_evaluation_criteria": analysis.key_evaluation_criteria,
        "pitfalls": analysis.pitfalls,
        "planning_payload": agent.to_planning_agent_payload(analysis),
    }


class ExtractedEmployee(BaseModel):
    firstName: str
    lastName: str
    email: str | None = None
    location: str | None = None
    role: str | None = None
    level: str | None = None
    yearsOfExperience: float | None = None
    pastIndustryExperience: list[str] = []
    skills: list[str] = []
    certifications: list[str] = []
    linkedin: str | None = None


@app.post("/api/extract-cv")
async def extract_cv(file: UploadFile = File(...)):
    """Accept a CV PDF, extract a structured candidate profile via Gemini."""
    from google import genai
    from google.genai import types
    import os

    key = os.getenv("GEMINI_API_KEY", "")
    if not key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not set")

    content = await file.read()

    client = genai.Client(api_key=key)
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[
            types.Part.from_bytes(data=content, mime_type=file.content_type or "application/pdf"),
            "Extract the candidate's profile information from this CV.",
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ExtractedEmployee,
            temperature=0.1,
        ),
    )

    try:
        data = json.loads(response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse CV extraction response: {e}")

    return {"status": "success", "data": data}
@app.post("/api/analyze-multi")
async def analyze_rfq_multi(files: List[UploadFile] = File(...)):
    """Accept multiple files belonging to the same RFP, analyze and merge into one result.

    All files are treated as parts of a single RFP document — not separate RFPs.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    agent = _build_agent()
    tmp_paths: list[str] = []
    analyses = []

    try:
        for file in files:
            suffix = Path(file.filename or "rfp.pdf").suffix or ".pdf"
            content = await file.read()
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(content)
                tmp_paths.append(tmp.name)

        try:
            analyses = await asyncio.gather(
                *[asyncio.to_thread(agent.analyze_file, p) for p in tmp_paths]
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Analysis failed: {e}")
    finally:
        for p in tmp_paths:
            Path(p).unlink(missing_ok=True)

    merged = analyses[0] if len(analyses) == 1 else agent._merge_partial_analyses(
        [a.model_dump() for a in analyses]
    )

    frontend = _to_frontend_shape(merged)
    return {
        **frontend,
        "rfp_title": merged.rfp_title,
        "client_name": merged.client_name,
        "rfp_summary": merged.rfp_summary,
        "submission_deadline": merged.submission_deadline,
        "project_duration": merged.project_duration,
        "budget_constraints": merged.budget_constraints,
        "confidence_score": merged.confidence_score,
        "deadlines": [d.model_dump() for d in merged.deadlines],
        "risks": [r.model_dump() for r in merged.risks],
        "dependencies": [d.model_dump() for d in merged.dependencies],
        "compliance_norms": [c.model_dump() for c in merged.compliance_norms],
        "key_evaluation_criteria": merged.key_evaluation_criteria,
        "pitfalls": merged.pitfalls,
        "planning_payload": agent.to_planning_agent_payload(merged),
    }


class ProfileGap(BaseModel):
    field: str
    question: str
    options: list[str] | None = None
    reasoning: str


class ProfileGapsResponse(BaseModel):
    gaps: list[ProfileGap]


@app.post("/api/profile-gaps")
async def profile_gaps(employee: dict):
    """Identify missing or inconsistent fields on an employee profile and
    generate targeted questions a recruiter can answer to fill them in."""
    from google import genai
    from google.genai import types
    import os

    key = os.getenv("GEMINI_API_KEY", "")
    if not key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not set")

    prompt = f"""
You are reviewing an employee profile for completeness before it is used for
project staffing and matchmaking.

Profile:
{json.dumps(employee, indent=2, ensure_ascii=False)}

Identify up to 5 fields that are missing, empty, or inconsistent (e.g. high
years of experience but no seniority level set). For each one, write a short
question a recruiter could answer to fill the gap. If the field has a small
set of natural choices (e.g. "level", "availabilityStatus"), provide those as
"options". Prioritize fields most useful for staffing decisions: skills,
level, yearsOfExperience, availabilityStatus, role, location, before less
critical ones like linkedin or certifications.

Only include fields that are genuinely missing or inconsistent — do not
invent questions for fields that are already filled in reasonably.
"""

    client = genai.Client(api_key=key)
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ProfileGapsResponse,
            temperature=0.1,
        ),
    )

    try:
        data = json.loads(response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse profile gaps response: {e}")

    return data


class MatchRequest(BaseModel):
    requirements: list[str]
    employees: list[dict]
    human_answer: str | None = None


@app.post("/api/match")
async def match_employees(body: MatchRequest):
    """Use Gemini to match employees against RFP requirements.

    Drop-in replacement for the matchEmployees function in gemini.ts.
    """
    from google import genai
    from google.genai import types
    import os

    key = os.getenv("GEMINI_API_KEY", "")
    if not key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not set")

    requirements = body.requirements
    if body.human_answer:
        requirements = requirements + [f"Human clarification: {body.human_answer}"]

    prompt = f"""
Based on these RFP requirements:
{json.dumps(requirements, indent=2, ensure_ascii=False)}

Rank these employees by fit for the project:
{json.dumps(body.employees, indent=2, ensure_ascii=False)}

For each employee return:
- id, name, role
- match: integer 0-100
- reason: one sentence explaining the score
- skills: list of their relevant skills for this project

Return a JSON array sorted by match descending.
"""
    client = genai.Client(api_key=key)
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.2,
        ),
    )

    try:
        matches = json.loads(response.text)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to parse matchmaking response")

    return {"matches": matches}


@app.get("/health")
def health():
    return {"status": "ok"}

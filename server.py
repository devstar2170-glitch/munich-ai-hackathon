"""FastAPI server exposing the RFP Analysis Agent as HTTP endpoints.

Run with:  uvicorn server:app --reload --port 8000
The Next.js frontend at localhost:3000 calls this server.
"""
from __future__ import annotations

import asyncio
import json
import os
import tempfile
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional

import requests as http_requests
from fastapi import FastAPI, File, HTTPException, UploadFile
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


# ---------------------------------------------------------------------------
# Tender Discovery + Agentic Ranking
# ---------------------------------------------------------------------------

TED_SEARCH_URL = "https://api.ted.europa.eu/v3/notices/search"

# Default CPV codes used when org hasn't configured any
_DEFAULT_CPV_CODES = [
    "31214000", "31200000", "31170000", "31110000", "31153000",
    "31154000", "31158000", "42960000", "42961000", "42997000",
    "45315000", "45311200", "45252100", "45232430", "42996000", "48100000",
]

# CPV codes known to be invalid in TED API (excluded from queries)
_INVALID_CPV = {"31614000"}


class OrgSettingsInput(BaseModel):
    companyName: str = ""
    description: str = ""
    coreCompetencies: List[str] = []
    industries: List[str] = []
    geographies: List[str] = []
    certifications: List[str] = []
    languages: List[str] = []
    minContractValue: Optional[float] = None
    maxContractValue: Optional[float] = None
    keywords: List[str] = []
    cpvCodes: List[str] = []
    exclusionCriteria: List[str] = []


class DiscoverRequest(BaseModel):
    org_settings: OrgSettingsInput
    days_back: int = 30
    limit: int = 20


class TenderEvaluation(BaseModel):
    notice_id: str
    title_summary: str
    client_name: str
    hardware_type: str
    estimated_value: str
    score: float
    reasoning: str
    why_bid: str
    why_fits_team: str
    is_excluded: bool
    exclusion_reason: Optional[str] = None


class RankingOutput(BaseModel):
    evaluations: List[TenderEvaluation]


def _ted_search(cpv_codes: List[str], days_back: int, limit: int) -> List[dict]:
    since = (datetime.now() - timedelta(days=days_back)).strftime("%Y%m%d")
    valid = [c for c in cpv_codes if c not in _INVALID_CPV]
    if not valid:
        valid = _DEFAULT_CPV_CODES
    cpv_list = ", ".join(valid)
    query = f"PC IN ({cpv_list}) AND PD >= {since} AND NC IN (works, supplies)"
    payload = {
        "query": query,
        "fields": ["ND", "TI", "PD", "CY", "PC", "NC"],
        "page": 1,
        "limit": limit,
    }
    resp = http_requests.post(TED_SEARCH_URL, json=payload, timeout=30)
    if not resp.ok:
        raise HTTPException(status_code=502, detail=f"TED API error: {resp.text}")
    return resp.json().get("notices", [])


def _notice_to_dict(n: dict) -> dict:
    ti = n.get("TI", {})
    title = ti.get("eng") or ti.get("deu") or next(iter(ti.values()), "")
    links = n.get("links", {})
    html = links.get("htmlDirect", {}).get("ENG") or links.get("html", {}).get("ENG", "")
    xml = links.get("xml", {}).get("MUL", "")
    return {
        "notice_id": n.get("ND", ""),
        "title": title[:300],
        "country": ", ".join(n.get("CY", [])),
        "publication_date": n.get("PD", ""),
        "cpv_codes": list(dict.fromkeys(n.get("PC", [])))[:6],
        "nature_of_contract": list(dict.fromkeys(n.get("NC", [])))[0] if n.get("NC") else "",
        "html_link": html,
        "xml_link": xml,
    }


def _rank_with_gemini(notices: List[dict], org: OrgSettingsInput) -> List[TenderEvaluation]:
    from google import genai
    from google.genai import types as gtypes

    key = os.getenv("GEMINI_API_KEY", "")
    if not key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not set")

    org_profile = (
        f"Company: {org.companyName}\n"
        f"Description: {org.description}\n"
        f"Core competencies: {', '.join(org.coreCompetencies)}\n"
        f"Industries served: {', '.join(org.industries)}\n"
        f"Geographies: {', '.join(org.geographies)}\n"
        f"Certifications: {', '.join(org.certifications)}\n"
        f"Min contract value: {org.minContractValue or 'not set'}\n"
        f"Max contract value: {org.maxContractValue or 'not set'}\n"
        f"Keywords: {', '.join(org.keywords)}\n"
        f"Hard exclusions (auto-score 0): {', '.join(org.exclusionCriteria)}"
    )

    prompt = f"""You are a bid qualification agent for an industrial OEM/EPC company.

Evaluate each of the following EU public tenders and score them against our organization profile.

ORGANIZATION PROFILE:
{org_profile}

For each tender produce:
- notice_id: exact notice ID from input
- title_summary: 1-line plain-English description of what is being procured
- client_name: the contracting authority / buyer (extract from title or infer from context)
- hardware_type: primary equipment or technical domain (e.g. "Medium-voltage switchgear", "SCADA system", "Wastewater automation")
- estimated_value: contract value if mentioned in title, else "Unknown"
- score: float 0.0–10.0 measuring fit with our profile. 10 = perfect EPC/turnkey match with our core competencies. 0 = hard exclusion or zero overlap.
- reasoning: 2–3 sentences explaining the score. Be specific about what matches or misses.
- why_bid: "Why we should bid" — cite our specific competitive advantage for this tender
- why_fits_team: "Why this fits our engineering team" — technical skills overlap
- is_excluded: true if it matches our hard exclusion criteria
- exclusion_reason: brief reason if is_excluded is true, else null

TENDERS TO EVALUATE:
{json.dumps(notices, ensure_ascii=False, indent=2)}

Return ONLY a JSON object with an "evaluations" array. No other text."""

    client = genai.Client(api_key=key)
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=gtypes.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=RankingOutput,
            temperature=0.1,
            thinking_config=gtypes.ThinkingConfig(thinking_budget=0),
        ),
    )
    result = RankingOutput(**json.loads(response.text))
    return result.evaluations


def _fetch_contracting_authority(html_link: str) -> str:
    """Extract the buyer's official name from a TED notice HTML page.

    TED HTML notices contain a section like:
        1.1. Buyer
        Official name: <name>
    """
    if not html_link:
        return ""
    try:
        import re
        import html as html_module
        resp = http_requests.get(html_link, timeout=15)
        if not resp.ok:
            return ""
        # Force UTF-8 — TED pages are UTF-8 but servers often declare wrong charset
        text = resp.content.decode("utf-8", errors="replace")
        # Decode HTML entities (&nbsp; &amp; &Ccaron; etc.) before stripping tags
        text = html_module.unescape(text)
        # Strip tags so we can match plain text regardless of surrounding markup
        text = re.sub(r'<[^>]+>', ' ', text)
        text = re.sub(r'[ \t]+', ' ', text)
        # Look for "Buyer" section followed by "Official name:"
        m = re.search(
            r'Buyer[^\n]*\n.*?Official\s+name\s*:\s*([^\n]{2,200})',
            text,
            re.IGNORECASE | re.DOTALL,
        )
        if m:
            return m.group(1).strip()
        # Fallback: first "Official name:" anywhere on the page
        m = re.search(r'Official\s+name\s*:\s*([^\n]{2,200})', text, re.IGNORECASE)
        if m:
            return m.group(1).strip()
        return ""
    except Exception:
        return ""


def _tavily_buyer_info(client_name: str, country: str) -> dict:
    api_key = os.getenv("TAVILY_API_KEY", "")
    if not api_key or not client_name or client_name.lower() == "unknown":
        return {}
    try:
        from tavily import TavilyClient
        tc = TavilyClient(api_key=api_key)
        query = f"{client_name} {country}: What are the general infos on this company?"
        result = tc.search(query, max_results=3, search_depth="basic")
        snippets = [r.get("content", "") for r in result.get("results", []) if r.get("content")]
        return {
            "summary": " ".join(snippets)[:600] if snippets else "",
            "sources": [r.get("url", "") for r in result.get("results", [])[:3]],
        }
    except Exception:
        return {}


@app.post("/api/discover-and-rank")
async def discover_and_rank(body: DiscoverRequest):
    """Search TED for relevant tenders, rank them with Gemini, enrich top 3 with Tavily."""
    # 1. Determine CPV codes to search
    cpv_codes = body.org_settings.cpvCodes or _DEFAULT_CPV_CODES

    # 2. Fetch notices from TED API
    raw_notices = await asyncio.to_thread(_ted_search, cpv_codes, body.days_back, body.limit)
    if not raw_notices:
        return {"ranked": [], "total_searched": 0}

    notices_for_gemini = [_notice_to_dict(n) for n in raw_notices]

    # 3. Rank with Gemini
    evaluations = await asyncio.to_thread(_rank_with_gemini, notices_for_gemini, body.org_settings)

    # 4. Sort by score descending, excluded tenders go last
    evaluations.sort(key=lambda e: (not e.is_excluded, e.score), reverse=True)

    # 5. Build response — merge eval with original links
    links_map = {n["notice_id"]: n for n in notices_for_gemini}
    ranked = []
    for i, ev in enumerate(evaluations):
        orig = links_map.get(ev.notice_id, {})
        item = ev.model_dump()
        item["rank"] = i + 1
        item["html_link"] = orig.get("html_link", "")
        item["xml_link"] = orig.get("xml_link", "")
        item["country"] = orig.get("country", "")
        item["cpv_codes"] = orig.get("cpv_codes", [])
        item["publication_date"] = orig.get("publication_date", "")
        item["buyer_info"] = None
        ranked.append(item)

    # 6. Resolve real buyer names for top 3 from the actual TED HTML notice
    for i in range(min(3, len(ranked))):
        if not ranked[i].get("client_name") or ranked[i]["client_name"].lower() == "unknown":
            real_name = await asyncio.to_thread(
                _fetch_contracting_authority, ranked[i].get("html_link", "")
            )
            if real_name:
                ranked[i]["client_name"] = real_name

    # 7. Enrich top 3 with Tavily buyer info (sequential — parallel hits dev-tier rate limits)
    for i in range(min(3, len(ranked))):
        info = await asyncio.to_thread(
            _tavily_buyer_info,
            ranked[i].get("client_name", ""),
            ranked[i].get("country", ""),
        )
        ranked[i]["buyer_info"] = info

    return {"ranked": ranked, "total_searched": len(raw_notices)}


class AnalyzeTenderRequest(BaseModel):
    notice_id: str
    title: str = ""
    title_summary: str = ""
    client_name: str = ""
    country: str = ""
    publication_date: str = ""
    cpv_codes: List[str] = []
    nature_of_contract: str = ""
    estimated_value: str = ""
    hardware_type: str = ""
    reasoning: str = ""
    why_bid: str = ""
    why_fits_team: str = ""
    html_link: str = ""


@app.post("/api/analyze-tender-text")
async def analyze_tender_text(body: AnalyzeTenderRequest):
    """Compose a text description of a TED tender and run it through the RFP analysis agent."""
    display_title = body.title_summary or body.title or f"TED Notice {body.notice_id}"
    tender_text = f"""EU PUBLIC TENDER NOTICE — {display_title}

Notice ID: {body.notice_id}
Client / Contracting Authority: {body.client_name}
Country: {body.country}
Publication Date: {body.publication_date}
CPV Codes: {', '.join(body.cpv_codes)}
Nature of Contract: {body.nature_of_contract}
Estimated Contract Value: {body.estimated_value}

TECHNICAL DOMAIN / EQUIPMENT TYPE:
{body.hardware_type}

TENDER SUMMARY (AI-generated from notice metadata):
{body.reasoning}

STRATEGIC BID RATIONALE:
{body.why_bid}

TEAM FIT ASSESSMENT:
{body.why_fits_team}

Original Notice Link: {body.html_link}

NOTE: This analysis is based on the EU TED notice metadata. The full procurement
specifications are available at the link above. Requirements below are inferred from
the notice; a full document review is recommended before final bid decision.
"""

    agent = _build_agent()
    try:
        analysis = await asyncio.to_thread(agent.analyze_text, tender_text)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {e}")

    frontend = _to_frontend_shape(analysis)
    return {
        **frontend,
        "rfp_title": analysis.rfp_title or display_title,
        "client_name": analysis.client_name or body.client_name,
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


@app.get("/health")
def health():
    return {"status": "ok"}

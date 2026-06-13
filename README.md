# Sales Engineering Agentic System

## Quick Start

**Prerequisites:** Python 3.10+, Node.js 18+, a Gemini API key ([get one here](https://aistudio.google.com/apikey))

### 1. Clone & configure

```bash
git clone <repo-url>
cd munich-hackathon

# Create your .env file
cp .env.example .env
# Open .env and set:  GEMINI_API_KEY=your_key_here
```

### 2. Install dependencies

```bash
# Python (RFP agent + API server)
pip3 install -r requirements.txt

# Node.js (Next.js frontend)
npm install
```

### 3. Run — open two terminals

**Terminal 1 — Python API server (port 8000):**
```bash
# macOS / Linux
python3 -m uvicorn server:app --port 8000

# Windows
uvicorn server:app --port 8000
```

**Terminal 2 — Next.js frontend (port 3000):**
```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

> Both servers must be running at the same time. The frontend sends RFP files to the Python server for analysis.

**macOS troubleshooting:**
- Use `python3` and `pip3` instead of `python` / `pip` — macOS ships with Python 2 by default
- If `uvicorn` command is not found, always use `python3 -m uvicorn server:app --port 8000`
- If you get a permissions error on port 8000, try `--port 8001` and set `NEXT_PUBLIC_AGENT_API_URL=http://localhost:8001` in your `.env`

---

## CLI Usage

You can also run the agent directly from the terminal, without the web UI — useful for batch processing or testing.

```bash
# Single document
python3 main.py rfp.pdf

# Multiple documents at once
python3 main.py rfp1.pdf rfp2.docx rfp3.pdf

# Save results to files (one JSON per document)
python3 main.py rfp1.pdf rfp2.pdf --output-dir results/ --planning-dir planning/
# Produces:
#   results/rfp1.json        — full analysis
#   results/rfp2.json
#   planning/rfp1_planning.json  — slim payload for Planning Agent
#   planning/rfp2_planning.json
```

Output includes: summary, requirements table, skills matrix, deadlines, dependencies, risks, compliance norms, and pitfalls — all in a clean terminal format.

---

## System Overview

This repository contains the **RFP Analysis Agent** — the first step in a multi-agent sales engineering pipeline. It reads an RFP/tender document (PDF, DOCX, TXT) and produces structured intelligence for downstream agents.

```
  ┌──────────────────────┐
  │  RFP Document        │   PDF / DOCX / TXT, any language
  └──────────┬───────────┘
             │
  ┌──────────▼───────────┐
  │  RFP Analysis Agent  │   Gemini 2.5 Flash — this repo
  │  (server.py :8000)   │
  └──┬───────────────┬───┘
     │               │
     ▼               ▼
Planning Agent   Response Agent
(skills match)   (proposal draft)
```

The RFP Analysis Agent exposes a **FastAPI server on port 8000**. The Next.js frontend (port 3000) talks to it, and so can any other agent in the system.

---

## For the Planning Agent Developer

This section is for you. Everything below tells you what you get from the RFP Analysis Agent and how to call it.

### What you receive

When the RFP Analysis Agent finishes, it produces a `planning_payload` — a slim, skills-focused object optimized for employee matching. This is the **primary handoff** to your agent.

#### `planning_payload` structure

```json
{
  "rfp_title": "Modernization of Substation Control System",
  "client_name": "Regional Grid Operator",
  "submission_deadline": "2025-06-30",
  "project_duration": "18 months",
  "estimated_team_size": "6-8 engineers",

  "skills_required": [
    {
      "skill": "Siemens TIA Portal v17 PLC programming",
      "category": "technical",
      "proficiency_level": "senior",
      "quantity_needed": 2,
      "context": "Required for automation of the control system per REQ-004 and REQ-007",
      "related_requirement_ids": ["REQ-004", "REQ-007"]
    },
    {
      "skill": "IEC 61850 substation communication",
      "category": "technical",
      "proficiency_level": "expert",
      "quantity_needed": 1,
      "context": "Protocol standard for inter-device communication — explicit compliance requirement",
      "related_requirement_ids": ["REQ-002"]
    }
  ],

  "high_priority_requirements": [
    {
      "id": "REQ-001",
      "category": "technical",
      "title": "SCADA integration",
      "description": "Full integration with existing SCADA system...",
      "priority": "high",
      "is_mandatory": true,
      "skills_needed": ["SCADA", "OPC-UA", "IEC 61850"],
      "section_reference": "Section 3.2"
    }
  ],

  "dependencies": [
    {
      "type": "internal",
      "name": "ISO 9001 certification",
      "category": "certification_body",
      "description": "Bidder must hold active ISO 9001 certification",
      "criticality": "high",
      "notes": null
    }
  ],

  "compliance_norms": [
    {
      "name": "IEC 61850",
      "description": "Communication standard for substation automation",
      "mandatory": true,
      "certification_required": false
    }
  ]
}
```

#### `skill_required` field reference

| Field | Type | Description |
|-------|------|-------------|
| `skill` | string | Exact skill name — granular, not generic (e.g. "OCPP 2.0.1" not "EV charging") |
| `category` | string | `technical` \| `domain` \| `certification` \| `soft_skill` \| `language` |
| `proficiency_level` | string | `junior` \| `mid` \| `senior` \| `expert` |
| `quantity_needed` | int | How many people with this skill the project needs |
| `context` | string | Why this skill is needed and how it will be used on this project |
| `related_requirement_ids` | string[] | Which requirements drive this skill need |

---

### How to get the planning payload

#### Option 1 — Read it from the frontend API response

When the Next.js frontend calls `POST /api/analyze`, the response includes `planning_payload` as a top-level field alongside all other data. Your agent can subscribe to or read from this response.

#### Option 2 — Call the analysis endpoint directly

```bash
curl -X POST http://localhost:8000/api/analyze \
  -F "file=@path/to/rfp.pdf"
```

Response shape:

```json
{
  "requirements": ["REQ-001 [HIGH*] SCADA integration: ..."],
  "ambiguity": "Scope boundary between Phase 1 and Phase 2 is unclear...",
  "suggestedSkills": ["Siemens TIA Portal — senior × 2"],

  "rfp_title": "...",
  "client_name": "...",
  "rfp_summary": "...",
  "submission_deadline": "2025-06-30",
  "project_duration": "18 months",
  "budget_constraints": null,
  "confidence_score": 0.87,

  "deadlines": [...],
  "risks": [...],
  "dependencies": [...],
  "compliance_norms": [...],
  "key_evaluation_criteria": [...],
  "pitfalls": [...],

  "planning_payload": { ... }    ← this is yours
}
```

#### Option 3 — Python (direct import)

```python
from rfp_agent import RFPAnalysisAgent

agent = RFPAnalysisAgent()  # reads GEMINI_API_KEY from env
analysis = agent.analyze_file("rfp.pdf")
payload = agent.to_planning_agent_payload(analysis)
# payload is a plain dict — serialize or pass directly
```

---

### Employee matchmaking endpoint

There is also a matchmaking endpoint you can use or build on:

```bash
POST http://localhost:8000/api/match
Content-Type: application/json

{
  "requirements": ["REQ-001 [HIGH*] SCADA integration: ..."],
  "employees": [
    {
      "id": "emp-1",
      "name": "Anna Schmidt",
      "role": "Automation Engineer",
      "skills": ["Siemens TIA Portal", "SCADA", "IEC 61850"]
    }
  ],
  "human_answer": "optional — clarification from the human if needed"
}
```

Response:

```json
{
  "matches": [
    {
      "id": "emp-1",
      "name": "Anna Schmidt",
      "role": "Automation Engineer",
      "match": 92,
      "reason": "Direct match on all three core technical skills required by the RFP.",
      "skills": ["Siemens TIA Portal", "SCADA", "IEC 61850"]
    }
  ]
}
```

---

## Full data model reference

All fields available on a complete `RFPAnalysis`:

```
RFPAnalysis
├── rfp_title               string
├── client_name             string | null
├── rfp_summary             string          — 2-3 sentence executive summary
├── project_scope           string          — detailed scope of work
├── submission_deadline     string | null
├── project_duration        string | null   — e.g. "18 months"
├── estimated_team_size     string | null
├── budget_constraints      string | null
│
├── requirements[]          Requirement
│   ├── id                  string          — REQ-001, REQ-002, ...
│   ├── category            string          — functional | technical | operational | compliance | financial | resource
│   ├── title               string
│   ├── description         string
│   ├── priority            string          — high | medium | low
│   ├── is_mandatory        bool            — "must/shall" vs "should/may"
│   ├── skills_needed       string[]
│   └── section_reference   string | null
│
├── skills_required[]       SkillRequirement  ← PRIMARY PLANNING AGENT INPUT
│   ├── skill               string
│   ├── category            string
│   ├── proficiency_level   string
│   ├── quantity_needed     int
│   ├── context             string
│   └── related_requirement_ids  string[]
│
├── deadlines[]             Deadline
│   ├── date                string | null
│   ├── milestone           string
│   ├── description         string
│   ├── criticality         string
│   └── consequences        string | null
│
├── dependencies[]          Dependency
│   ├── type                string          — internal | external
│   ├── name                string
│   ├── category            string          — supplier | partner | regulatory_body | internal_team | technology | certification_body
│   ├── description         string
│   ├── criticality         string
│   └── notes               string | null
│
├── risks[]                 Risk
│   ├── title               string
│   ├── description         string
│   ├── impact              string          — high | medium | low
│   ├── category            string          — technical | legal | financial | operational | timeline | compliance | resource
│   └── mitigation_suggestion  string | null
│
├── compliance_norms[]      ComplianceNorm
│   ├── name                string
│   ├── description         string
│   ├── mandatory           bool
│   └── certification_required  bool
│
├── key_evaluation_criteria string[]        — how the client scores proposals
├── pitfalls                string[]        — gotchas, ambiguities, unusual clauses
├── analysis_notes          string[]        — analyst observations, areas needing clarification
└── confidence_score        float           — 0.0–1.0 completeness confidence
```

---

## Internal architecture (RFP agent)

```
RFP File (PDF / DOCX / TXT)
   │
   ▼
Document Loader
   ├── PDF  → Gemini Files API (native, preserves layout/tables)
   │          → pdfplumber fallback (text extraction)
   ├── DOCX → python-docx
   └── TXT  → direct read
   │
   ▼
Chunker  (only if document > ~700K chars)
   └── Overlapping paragraph-boundary chunks → merge pass
   │
   ▼
Gemini 2.5 Flash
   └── Structured output constrained to RFPAnalysis JSON schema
   │
   ▼
RFPAnalysis (Pydantic model, fully validated)
   └── to_planning_agent_payload() → slim dict for Planning Agent
```

## File structure

```
munich-hackathon/
├── rfp_agent/
│   ├── __init__.py
│   ├── agent.py          — RFPAnalysisAgent class
│   ├── models.py         — Pydantic models (RFPAnalysis, Requirement, etc.)
│   ├── prompts.py        — System, analysis, and merge prompts
│   └── document_loader.py — PDF/DOCX/TXT loading
├── server.py             — FastAPI server (port 8000)
├── src/lib/gemini.ts     — Next.js → FastAPI bridge
├── requirements.txt
└── .env                  — GEMINI_API_KEY (never committed)
```

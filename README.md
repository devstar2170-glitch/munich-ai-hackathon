# Sales Engineering Agentic System — RFP Analysis Agent

## High-Level System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   MULTI-AGENT SYSTEM                    │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │          RFP DOCUMENT (PDF / DOCX / TXT)         │   │
│  └───────────────────────┬──────────────────────────┘   │
│                          │                              │
│              ┌───────────▼────────────┐                 │
│              │   RFP ANALYSIS AGENT   │  ← YOU ARE HERE │
│              │   (Gemini 2.5 Flash)   │                 │
│              │                        │                 │
│              │  • Requirements        │                 │
│              │  • Skills Matrix       │                 │
│              │  • Deadlines           │                 │
│              │  • Risks / Pitfalls    │                 │
│              │  • Dependencies        │                 │
│              │  • Compliance Norms    │                 │
│              └───┬──────────┬─────────┘                 │
│                  │          │                           │
│         ┌────────▼──┐  ┌────▼───────────┐              │
│         │ PLANNING  │  │ RESPONSE AGENT │              │
│         │  AGENT    │  │ (Proposal Gen) │              │
│         │           │  └────────────────┘              │
│         │ Receives: │                                   │
│         │ skills_   │  Employee                        │
│         │ required  │◄─ Skills DB                      │
│         │           │                                   │
│         │ Outputs:  │                                   │
│         │ Team plan │                                   │
│         └───────────┘                                   │
└─────────────────────────────────────────────────────────┘
```

## RFP Analysis Agent — Internal Design

```
RFP File
   │
   ▼
Document Loader
   ├── PDF  → Gemini Files API (native, best quality)
   │       → pdfplumber fallback (text extraction)
   ├── DOCX → python-docx (preserves headings + tables)
   └── TXT  → direct read

   │
   ▼
Chunker (if doc > 700K chars)
   └── Overlapping paragraph-boundary chunks → merge pass

   │
   ▼
Gemini 2.5 Flash (structured output, JSON schema constrained)
   │
   ├── Requirements Extractor
   │     → id, category, priority, is_mandatory
   │     → skills_needed per requirement
   │
   ├── Skills Matrix Builder  ──────────► Planning Agent
   │     → skill, proficiency_level
   │     → quantity_needed, context
   │     → related_requirement_ids
   │
   ├── Deadline / Timeline Extractor
   │     → dates, milestones, criticality
   │
   ├── Dependency Detector
   │     → internal | external
   │     → suppliers, vendors, regulatory bodies
   │
   ├── Risk & Pitfall Detector
   │     → technical, legal, financial, timeline risks
   │     → ambiguities, unusual clauses
   │
   └── Compliance Norm Extractor
         → VDE, DIN, IEC, VDI, VOB/A norms

   │
   ▼
RFPAnalysis (Pydantic model)
   │
   ├── Full JSON  →  saved to file / passed to other agents
   └── Planning Agent Payload  →  slim skills-focused dict
```

## Data Flow to Planning Agent

The `skills_required` field is the primary handoff to the Planning Agent:

```json
{
  "skills_required": [
    {
      "skill": "SPS-Programmierung Siemens TIA Portal",
      "category": "technical",
      "proficiency_level": "senior",
      "quantity_needed": 2,
      "context": "Required for Leittechnik automation per REQ-004",
      "related_requirement_ids": ["REQ-004", "REQ-007"]
    }
  ]
}
```

## Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Configure API key
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# Run analysis
python main.py path/to/rfp.pdf

# Save outputs
python main.py rfp.pdf --output analysis.json --planning-output planning_payload.json
```

## Programmatic Usage (for agent integration)

```python
from rfp_agent import RFPAnalysisAgent

agent = RFPAnalysisAgent(api_key="...", model="gemini-2.5-flash")

# Analyze a file
analysis = agent.analyze_file("rfp.pdf")

# Get Planning Agent payload
payload = agent.to_planning_agent_payload(analysis)

# Serialize for inter-agent communication
json_str = analysis.model_dump_json()
```

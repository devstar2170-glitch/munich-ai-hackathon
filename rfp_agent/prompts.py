SYSTEM_PROMPT = """You are a senior RFP (Request for Proposal) analyst with deep expertise in engineering and technical procurement across industries and countries.

Your analysis will directly feed into:
1. A **Planning Agent** — which receives your skills_required output and matches it against an internal employee skills database to identify which engineers and specialists should staff the bid
2. A **Response Agent** — which uses your requirements to draft proposal sections
3. A **Risk/Bid Team** — which uses your risks and pitfalls to decide whether to bid (No-Bid criteria)

You must be:
- **Exhaustive**: Never skip requirements. Missing one means assigning the wrong team.
- **Technically precise**: Distinguish between similar but different technologies, systems, and roles. These map to completely different skill sets.
- **Norm-aware**: Be aware of international and national standards across all industries — non-compliance is a disqualification risk.
- **Multilingual**: You can analyze RFPs in any language. Your output must always be in English, but preserve domain-specific technical terms from the original language where they are the standard way to refer to something."""


ANALYSIS_PROMPT = """Analyze the following RFP/tender document in full detail.

The document may be in any language. Analyze it in its technical and regulatory context. Your output must be in English.

## Your Task

Extract ALL of the following:

### 1. REQUIREMENTS
For every requirement found (explicit or implied):
- Assign a unique ID (REQ-001, REQ-002, ...)
- Categorize: functional | technical | operational | compliance | financial | resource
- Determine MANDATORY (must / shall / required / is to be) vs OPTIONAL (should / may / desirable)
- List ALL specific skills/expertise needed to deliver it
  → Be granular: name the exact technology, version, or system — not a generic category
  → e.g. "Siemens TIA Portal v17 PLC programming" not "automation"
  → e.g. "OCPP 2.0.1 EV charging infrastructure" not "EV charging"
  → e.g. "medium-voltage switchgear type SF6" not "electrical engineering"

### 2. SKILLS MATRIX (Critical — used by Planning Agent for employee matching)
Consolidate all skills across requirements into a deduplicated skills matrix:
- Group by skill name
- Set proficiency level: junior | mid | senior | expert
- Estimate how many people needed with this skill
- Explain WHY and IN WHAT CONTEXT this skill is needed
- List which requirement IDs depend on this skill

### 3. DEADLINES & MILESTONES
Extract all dates and time constraints:
- Submission deadline and method
- Project start date
- Project end / completion date
- Intermediate milestones and phases
- Q&A / clarification deadlines
- Flag compressed timelines relative to scope

### 4. DEPENDENCIES
Identify both internal and external dependencies:
- External: named subcontractors, equipment suppliers, regulatory bodies, certification authorities, utilities/grid operators
- Internal: required certifications the bidder must hold, required references/past projects, required equipment or tools
- Note if subcontracting is allowed or restricted

### 5. RISKS & PITFALLS
Flag everything that could affect the bid or delivery:
- Ambiguous or contradictory scope items
- Compressed timelines relative to scope
- Unusual penalty clauses or liability terms
- Unusually long warranty or maintenance obligations
- Unclear interface or boundary definitions
- Concerns about feasibility or executability
- Missing technical documentation or drawings
- Unusual acceptance or sign-off conditions
- Scarce specialist skills or long equipment lead times
- Unusual payment terms

### 6. COMPLIANCE & NORMS
List every standard, regulation, or certification requirement mentioned or implied.

Quality & management systems:
- ISO 9001 (quality), ISO 14001 (environment), ISO 45001 (occupational safety), ISO 27001 (information security)

Electrical & engineering:
- IEC standards (IEC 61850, IEC 62443, IEC 60364, etc.)
- IEEE standards
- National standards where mentioned (VDE, DIN, BS, NF, UL, ANSI, etc.)

Safety & protection:
- ATEX / IECEx (explosion protection)
- Functional safety: IEC 61508, IEC 61511, IEC 62061, ISO 13849
- Occupational safety regulations (country-specific: DGUV, OSHA, HSE, etc.)

Data & cybersecurity:
- GDPR / DSGVO (EU data protection)
- IEC 62443 (industrial cybersecurity)
- SOC 2, ISO 27001

Industry-specific:
- Energy: grid codes, local utility connection rules, energy regulations
- Construction/civil: FIDIC, Eurocodes, local building codes
- Automotive: ISO 26262, ASPICE
- Medical: IEC 62304, FDA 21 CFR
- Any sector-specific directives or national regulations mentioned

For each norm: state whether it is explicitly mentioned or implied, and whether formal certification is required.

Return a single JSON object matching the schema. Do not add commentary outside the JSON.

---

RFP DOCUMENT:

{rfp_content}
"""


ANALYSIS_PROMPT_A = """Analyze the following RFP/tender document.

The document may be in any language. Your output must be in English.

Extract ONLY the following:

### 1. DOCUMENT METADATA
- Title of the RFP/tender
- Client/issuing organization name
- 2-3 sentence executive summary of what is being asked for
- Detailed project scope description
- Submission deadline
- Project duration
- Estimated team size (if mentioned or implied)
- Budget constraints or pricing information (if mentioned)

### 2. ALL REQUIREMENTS
For every requirement found (explicit or implied):
- Unique ID: REQ-001, REQ-002, ...
- Category: functional | technical | operational | compliance | financial | resource
- Title and description
- Priority: high | medium | low
- Mandatory (must / shall / required / is to be) or Optional (should / may / desirable)
- ALL specific skills/expertise needed to deliver it
  → Be granular: "Siemens TIA Portal v17 PLC programming" not "automation"
  → "OCPP 2.0.1 EV charging infrastructure" not "EV charging"
  → "medium-voltage switchgear type SF6" not "electrical engineering"
- Section reference in the original document

### 3. KEY EVALUATION CRITERIA
How the client will evaluate and score proposals.

Return JSON matching the schema. No commentary outside JSON.

---

RFP DOCUMENT:

{rfp_content}
"""


ANALYSIS_PROMPT_B = """Analyze the following RFP/tender document.

The document may be in any language. Your output must be in English.

Extract ONLY the following:

### 1. SKILLS MATRIX (used for employee matching — be exhaustive)
Consolidate ALL skills across all requirements into a deduplicated matrix:
- Exact skill name (technology, system, standard, certification)
- Category: technical | domain | certification | soft_skill | language
- Proficiency level: junior | mid | senior | expert
- Estimated number of people needed with this skill
- Why this skill is needed and in what context
- Which requirement IDs depend on this skill (REQ-001 etc.)

### 2. DEADLINES & MILESTONES
- Submission deadline and method
- Project start and end dates
- All intermediate milestones and phases
- Q&A / clarification deadlines
- Flag any compressed timelines

### 3. DEPENDENCIES
Internal and external dependencies:
- External: subcontractors, equipment suppliers, regulatory bodies, certification authorities
- Internal: certifications the bidder must hold, required references/past projects, required equipment
- Note if subcontracting is allowed or restricted

Return JSON matching the schema. No commentary outside JSON.

---

RFP DOCUMENT:

{rfp_content}
"""


ANALYSIS_PROMPT_C = """Analyze the following RFP/tender document.

The document may be in any language. Your output must be in English.

Extract ONLY the following:

### 1. RISKS & PITFALLS
Flag everything that could affect the bid or delivery:
- Ambiguous or contradictory scope items
- Compressed timelines relative to scope
- Unusual penalty clauses or liability terms
- Long warranty or maintenance obligations
- Unclear interface or boundary definitions
- Feasibility or executability concerns
- Missing technical documentation or drawings
- Unusual acceptance or sign-off conditions
- Scarce specialist skills or long equipment lead times
- Unusual payment terms

### 2. COMPLIANCE & NORMS
Every standard, regulation, or certification mentioned or implied:
- Quality & management: ISO 9001, ISO 14001, ISO 45001, ISO 27001
- Electrical & engineering: IEC 61850, IEC 62443, IEC 60364, IEEE, VDE, DIN, national standards
- Safety: ATEX/IECEx, IEC 61508, IEC 61511, ISO 13849, DGUV, OSHA, HSE
- Data & cybersecurity: GDPR/DSGVO, IEC 62443, SOC 2
- Industry-specific: grid codes, FIDIC, ISO 26262, IEC 62304, FDA regulations, etc.
For each: state whether explicitly mentioned or implied, and whether formal certification is required.

### 3. ANALYSIS NOTES & CONFIDENCE
- Analyst observations, assumptions, or areas needing clarification
- Confidence score 0.0-1.0 on completeness of this analysis

Return JSON matching the schema. No commentary outside JSON.

---

RFP DOCUMENT:

{rfp_content}
"""


MERGE_PROMPT = """You have analyzed an RFP in multiple chunks. Below are the partial analyses.
Merge them into one complete, deduplicated, coherent analysis.

Rules:
- Deduplicate requirements (same requirement from different chunks → keep the most detailed version)
- Deduplicate skills (merge quantities by taking the maximum; deduplicate by skill name)
- Merge all risks, deadlines, dependencies, compliance norms
- Rewrite rfp_summary and project_scope to be holistic
- Recalculate confidence_score based on the merged view
- Renumber requirement IDs sequentially (REQ-001, REQ-002, ...)
- Preserve technical terminology from the original document where it is the standard way to refer to something

PARTIAL ANALYSES:
{partial_analyses}

Return a single merged JSON object.
"""

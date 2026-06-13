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

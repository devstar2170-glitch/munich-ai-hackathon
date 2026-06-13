from __future__ import annotations
from pydantic import BaseModel, Field
from typing import List, Optional


class Requirement(BaseModel):
    id: str = Field(description="Unique ID like REQ-001")
    category: str = Field(description="functional | technical | operational | compliance | financial | resource")
    title: str
    description: str
    priority: str = Field(description="high | medium | low")
    is_mandatory: bool = Field(description="True if the RFP uses language like 'must', 'shall', 'required'")
    skills_needed: List[str] = Field(description="List of specific skills or expertise required to fulfill this requirement")
    section_reference: Optional[str] = Field(default=None, description="Section or page reference in the original RFP")


class SkillRequirement(BaseModel):
    skill: str = Field(description="Specific skill, technology, or expertise")
    category: str = Field(description="technical | domain | certification | soft_skill | language")
    proficiency_level: str = Field(description="junior | mid | senior | expert")
    quantity_needed: int = Field(description="Estimated number of people with this skill needed")
    context: str = Field(description="Why this skill is needed and how it will be used")
    related_requirement_ids: List[str] = Field(description="IDs of requirements that need this skill")


class Deadline(BaseModel):
    date: Optional[str] = Field(default=None, description="Date string as found in document, e.g. '2025-03-15' or 'Q2 2025'")
    milestone: str = Field(description="Name of the milestone or deliverable")
    description: str
    criticality: str = Field(description="high | medium | low")
    consequences: Optional[str] = Field(default=None, description="What happens if this deadline is missed")


class Dependency(BaseModel):
    type: str = Field(description="internal | external")
    name: str = Field(description="Name of the dependency (company, system, team, standard)")
    category: str = Field(description="supplier | partner | regulatory_body | internal_team | technology | certification_body")
    description: str = Field(description="What role this dependency plays")
    criticality: str = Field(description="high | medium | low — how blocking is this dependency")
    notes: Optional[str] = Field(default=None, description="Any caveats or flags about this dependency")


class Risk(BaseModel):
    title: str
    description: str
    impact: str = Field(description="high | medium | low")
    category: str = Field(description="technical | legal | financial | operational | timeline | compliance | resource")
    mitigation_suggestion: Optional[str] = Field(default=None, description="Suggested way to mitigate or address this risk")


class ComplianceNorm(BaseModel):
    name: str = Field(description="Standard or regulation name, e.g. GDPR, ISO 27001, SOC 2")
    description: str
    mandatory: bool
    certification_required: bool = Field(description="True if a formal certificate/audit is needed")


class RFPAnalysis(BaseModel):
    rfp_title: str
    client_name: Optional[str] = None
    rfp_summary: str = Field(description="2-3 sentence executive summary of what this RFP is asking for")
    project_scope: str = Field(description="Detailed scope of work description")
    submission_deadline: Optional[str] = None
    project_duration: Optional[str] = Field(default=None, description="Expected project length, e.g. '12 months'")
    estimated_team_size: Optional[str] = Field(default=None, description="Estimated team size mentioned or implied")
    budget_constraints: Optional[str] = Field(default=None, description="Budget or pricing information if mentioned")

    requirements: List[Requirement]
    skills_required: List[SkillRequirement] = Field(
        description="Consolidated skills matrix — the primary input for the Planning Agent to match with internal employees"
    )
    deadlines: List[Deadline]
    dependencies: List[Dependency]
    risks: List[Risk]
    compliance_norms: List[ComplianceNorm]

    key_evaluation_criteria: List[str] = Field(description="How the client will evaluate and score proposals")
    pitfalls: List[str] = Field(description="Specific gotchas, ambiguities, or unusual clauses that need attention")
    analysis_notes: List[str] = Field(description="Analyst observations, assumptions made, or areas needing clarification")
    confidence_score: float = Field(description="0.0-1.0 confidence in the completeness of this analysis")

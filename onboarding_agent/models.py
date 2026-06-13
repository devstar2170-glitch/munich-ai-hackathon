"""Pydantic schema for structured CV extraction."""

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class ExperienceLevel(str, Enum):
    JUNIOR = "Junior"
    MID = "Mid"
    SENIOR = "Senior"
    LEAD = "Lead"


class CandidateProfile(BaseModel):
    firstName: str = Field(description="Candidate's first name")
    lastName: str = Field(description="Candidate's last name")
    email: Optional[str] = Field(default=None, description="Candidate's email address")
    location: Optional[str] = Field(default=None, description="City and/or country of the candidate")
    role: Optional[str] = Field(default=None, description="Most recent or target job title")
    level: Optional[ExperienceLevel] = Field(
        default=None, description="Seniority level: Junior, Mid, Senior, or Lead"
    )
    yearsOfExperience: Optional[float] = Field(
        default=None, description="Total years of professional experience"
    )
    pastIndustryExperience: List[str] = Field(
        default_factory=list, description="Industries the candidate has worked in"
    )
    skills: List[str] = Field(default_factory=list, description="Technical and soft skills")
    certifications: List[str] = Field(default_factory=list, description="Certifications held")
    linkedin: Optional[str] = Field(default=None, description="LinkedIn profile URL")

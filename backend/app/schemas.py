from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, EmailStr


# Auth
class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: str = "hr_specialist"


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: str
    password: str


# Vacancy
class VacancyUpload(BaseModel):
    text: str


class VacancyAnalysis(BaseModel):
    position: str
    experience_required: str
    education: str
    hard_skills: list[str]
    soft_skills: list[str]
    required: list[str]
    preferred: list[str]
    location: str
    salary_from: Optional[int]
    salary_to: Optional[int]
    search_synonyms: list[str]


# Search session
class SearchSessionCreate(BaseModel):
    title: str
    vacancy_text: str


class SearchSessionOut(BaseModel):
    id: int
    title: str
    status: str
    vacancy_analysis: Optional[dict]
    total_found: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# Candidate
class CandidateOut(BaseModel):
    id: int
    hh_url: Optional[str]
    full_name: str
    position: Optional[str]
    city: Optional[str]
    experience_years: Optional[float]
    salary_expected: Optional[int]
    education: Optional[str]
    skills: Optional[list]
    match_score: Optional[float]
    experience_score: Optional[float]
    skills_score: Optional[float]
    industry_score: Optional[float]
    education_score: Optional[float]
    pros: Optional[list]
    cons: Optional[list]
    recommendation: Optional[str]
    ai_summary: Optional[str]
    interview_questions: Optional[dict]

    model_config = {"from_attributes": True}


# hh.kz settings
class HHCredentials(BaseModel):
    email: str
    password: str


# Export
class ExportRequest(BaseModel):
    session_id: int
    format: str  # pdf | excel | word

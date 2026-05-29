from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, Float, DateTime, ForeignKey, JSON, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="hr_specialist")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    searches: Mapped[list["SearchSession"]] = relationship("SearchSession", back_populates="user")


class SearchSession(Base):
    __tablename__ = "search_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="draft")
    vacancy_text: Mapped[Optional[str]] = mapped_column(Text)
    vacancy_analysis: Mapped[Optional[dict]] = mapped_column(JSON)
    search_params: Mapped[Optional[dict]] = mapped_column(JSON)
    total_found: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship("User", back_populates="searches")
    candidates: Mapped[list["Candidate"]] = relationship("Candidate", back_populates="session")


class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("search_sessions.id"), nullable=False)
    hh_id: Mapped[Optional[str]] = mapped_column(String(100))
    hh_url: Mapped[Optional[str]] = mapped_column(String(1000))
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    position: Mapped[Optional[str]] = mapped_column(String(500))
    city: Mapped[Optional[str]] = mapped_column(String(255))
    experience_years: Mapped[Optional[float]] = mapped_column(Float)
    salary_expected: Mapped[Optional[int]] = mapped_column(Integer)
    education: Mapped[Optional[str]] = mapped_column(String(500))
    skills: Mapped[Optional[list]] = mapped_column(JSON)
    raw_resume: Mapped[Optional[dict]] = mapped_column(JSON)

    # AI scoring
    match_score: Mapped[Optional[float]] = mapped_column(Float)
    experience_score: Mapped[Optional[float]] = mapped_column(Float)
    skills_score: Mapped[Optional[float]] = mapped_column(Float)
    industry_score: Mapped[Optional[float]] = mapped_column(Float)
    education_score: Mapped[Optional[float]] = mapped_column(Float)
    pros: Mapped[Optional[list]] = mapped_column(JSON)
    cons: Mapped[Optional[list]] = mapped_column(JSON)
    recommendation: Mapped[Optional[str]] = mapped_column(String(50))  # green/yellow/red
    ai_summary: Mapped[Optional[str]] = mapped_column(Text)
    interview_questions: Mapped[Optional[dict]] = mapped_column(JSON)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    session: Mapped["SearchSession"] = relationship("SearchSession", back_populates="candidates")

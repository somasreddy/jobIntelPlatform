import uuid
from datetime import datetime
from sqlalchemy import (
    String, Integer, Boolean, Text, DateTime, ForeignKey, func
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class ResumeHistory(Base):
    __tablename__ = "resume_history"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    job_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("verified_jobs.id"), nullable=True
    )
    job_title: Mapped[str | None] = mapped_column(String(255))
    organization: Mapped[str | None] = mapped_column(String(255))
    ats_score: Mapped[int | None] = mapped_column(Integer)
    summary: Mapped[str | None] = mapped_column(Text)
    bullets: Mapped[list | None] = mapped_column(JSONB, default=list)
    skills_grouped: Mapped[dict | None] = mapped_column(JSONB, default=dict)
    pdf_base64: Mapped[str | None] = mapped_column(Text)
    docx_base64: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class VerifiedJob(Base):
    __tablename__ = "verified_jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    organization: Mapped[str] = mapped_column(String(255), nullable=False)
    location: Mapped[str | None] = mapped_column(String(255))
    work_mode: Mapped[str | None] = mapped_column(String(50))
    salary_min: Mapped[int | None] = mapped_column(Integer)
    salary_max: Mapped[int | None] = mapped_column(Integer)
    currency: Mapped[str | None] = mapped_column(String(10), default="USD")
    experience_required: Mapped[int | None] = mapped_column(Integer)
    description: Mapped[str | None] = mapped_column(Text)
    requirements: Mapped[list | None] = mapped_column(JSONB, default=list)
    technologies: Mapped[list | None] = mapped_column(JSONB, default=list)
    application_link: Mapped[str | None] = mapped_column(Text)
    career_page_link: Mapped[str | None] = mapped_column(Text)
    recruiter_name: Mapped[str | None] = mapped_column(String(255))
    recruiter_linkedin: Mapped[str | None] = mapped_column(Text)
    verification_status: Mapped[str] = mapped_column(
        String(50), default="UNVERIFIED"
    )
    level_up: Mapped[bool] = mapped_column(Boolean, default=False)
    match_score: Mapped[int | None] = mapped_column(Integer)
    posted_date: Mapped[str | None] = mapped_column(String(30))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    applications: Mapped[list["Application"]] = relationship(
        back_populates="job", cascade="all, delete-orphan"
    )


class CandidateProfile(Base):
    __tablename__ = "candidate_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    current_role: Mapped[str | None] = mapped_column(String(255))
    current_salary: Mapped[int | None] = mapped_column(Integer)
    currency: Mapped[str | None] = mapped_column(String(10), default="USD")
    experience_years: Mapped[int | None] = mapped_column(Integer)
    current_location: Mapped[str | None] = mapped_column(String(255))
    preferred_locations: Mapped[list | None] = mapped_column(JSONB, default=list)
    skills: Mapped[list | None] = mapped_column(JSONB, default=list)
    frameworks: Mapped[list | None] = mapped_column(JSONB, default=list)
    languages: Mapped[list | None] = mapped_column(JSONB, default=list)
    cicd_tools: Mapped[list | None] = mapped_column(JSONB, default=list)
    ai_tools: Mapped[list | None] = mapped_column(JSONB, default=list)
    certifications: Mapped[list | None] = mapped_column(JSONB, default=list)
    work_mode: Mapped[str | None] = mapped_column(String(50))
    base_resume_text: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    applications: Mapped[list["Application"]] = relationship(
        back_populates="profile", cascade="all, delete-orphan"
    )


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    job_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("verified_jobs.id"), nullable=True
    )
    profile_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("candidate_profiles.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="Saved")
    date_applied: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    follow_up_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    generated_resume_url: Mapped[str | None] = mapped_column(Text)
    generated_cover_letter_url: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    job: Mapped["VerifiedJob | None"] = relationship(back_populates="applications")
    profile: Mapped["CandidateProfile | None"] = relationship(
        back_populates="applications"
    )

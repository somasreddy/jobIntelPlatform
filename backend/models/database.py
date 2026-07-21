import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import (
    String, Integer, SmallInteger, Float, Numeric, Boolean, Text, DateTime,
    ForeignKey, func, Index, UniqueConstraint
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
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    source_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("source_registry.id")
    )
    external_requisition_id: Mapped[str | None] = mapped_column(Text)
    canonical_url: Mapped[str | None] = mapped_column(Text)
    canonical_fingerprint: Mapped[str | None] = mapped_column(Text)
    normalized_payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    field_provenance: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    extraction_confidence: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    freshness_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    suppressed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    suppression_reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    applications: Mapped[list["Application"]] = relationship(
        back_populates="job", cascade="all, delete-orphan"
    )
    source_registry: Mapped["SourceRegistry | None"] = relationship()


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




class ProfileFact(Base):
    __tablename__ = "profile_facts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("candidate_profiles.id", ondelete="CASCADE"), nullable=False
    )
    fact_type: Mapped[str] = mapped_column(String(80), nullable=False)
    normalized_key: Mapped[str] = mapped_column(String(255), nullable=False)
    value: Mapped[dict] = mapped_column(JSONB, nullable=False)
    trust_state: Mapped[str] = mapped_column(String(30), nullable=False, default="needs_review")
    source_type: Mapped[str] = mapped_column(String(50), nullable=False)
    source_ref: Mapped[str | None] = mapped_column(Text)
    evidence: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    review_status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending")
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("profile_id", "source_type", "fact_type", "normalized_key", name="uq_profile_fact_source_key"),
        Index("idx_profile_facts_review", "user_id", "review_status", "fact_type"),
    )


class ProfileSnapshot(Base):
    __tablename__ = "profile_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("candidate_profiles.id", ondelete="CASCADE"), nullable=False
    )
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    kind: Mapped[str] = mapped_column(String(30), nullable=False, default="base")
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    profile_data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    facts: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("profile_id", "version", name="uq_profile_snapshot_version"),
        Index("idx_profile_snapshots_user_created", "user_id", "created_at"),
    )


class ProfileVariant(Base):
    __tablename__ = "profile_variants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("candidate_profiles.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    target_role: Mapped[str | None] = mapped_column(String(255))
    target_company: Mapped[str | None] = mapped_column(String(255))
    base_snapshot_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profile_snapshots.id")
    )
    overrides: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_profile_variant_user_name"),
        Index("idx_profile_variants_user_status", "user_id", "status"),
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
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="saved", server_default="saved")
    date_applied: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    follow_up_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    evaluation_score: Mapped[float | None] = mapped_column(Float)
    archetype: Mapped[str | None] = mapped_column(String(100))
    evaluation_report: Mapped[dict | None] = mapped_column(JSONB, default=dict)
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
    events: Mapped[list["ApplicationEvent"]] = relationship(
        back_populates="application", cascade="all, delete-orphan"
    )


class MasterStory(Base):
    """Interview Story Bank — STAR+Reflection stories accumulated across evaluations (career-ops)."""
    __tablename__ = "master_stories"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    requirement: Mapped[str] = mapped_column(String(500), nullable=False)
    story_theme: Mapped[str] = mapped_column(Text, nullable=False)
    situation: Mapped[str | None] = mapped_column(Text)
    task: Mapped[str | None] = mapped_column(Text)
    action: Mapped[str | None] = mapped_column(Text)
    result: Mapped[str | None] = mapped_column(Text)
    reflection: Mapped[str | None] = mapped_column(Text)
    archetype_tags: Mapped[list | None] = mapped_column(JSONB, default=list)
    source_job: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


# ─────────────────────────────────────────────────────────────────────────────
# PHASE 1: CAREER GRAPH
# ─────────────────────────────────────────────────────────────────────────────

class CareerGraph(Base):
    """One row per user — the persistent AI model of a user's career DNA."""
    __tablename__ = "career_graphs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, unique=True, index=True)
    health_score: Mapped[int] = mapped_column(Integer, default=0)
    health_breakdown: Mapped[dict | None] = mapped_column(JSONB, default=dict)
    market_position_score: Mapped[int] = mapped_column(Integer, default=0)
    demand_score: Mapped[int] = mapped_column(Integer, default=0)
    rarity_score: Mapped[int] = mapped_column(Integer, default=0)
    percentile_rank: Mapped[int] = mapped_column(Integer, default=0)
    onboarding_complete: Mapped[bool] = mapped_column(Boolean, default=False)
    last_computed: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    skills: Mapped[list["CareerSkill"]] = relationship(back_populates="graph", cascade="all, delete-orphan")
    goals: Mapped[list["CareerGoal"]] = relationship(back_populates="graph", cascade="all, delete-orphan")
    milestones: Mapped[list["CareerMilestone"]] = relationship(back_populates="graph", cascade="all, delete-orphan")


class CareerSkill(Base):
    """Individual skills with proficiency level and market metadata."""
    __tablename__ = "career_skills"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    graph_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("career_graphs.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    skill_name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str | None] = mapped_column(String(100))          # Frontend, Backend, DevOps, etc.
    level: Mapped[int] = mapped_column(Integer, default=1)             # 1=Beginner … 5=Expert
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    last_used_year: Mapped[int | None] = mapped_column(Integer)
    trending_score: Mapped[float] = mapped_column(Float, default=0.0)  # 0-1 market demand signal
    years_experience: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    graph: Mapped["CareerGraph"] = relationship(back_populates="skills")

    __table_args__ = (Index("ix_career_skills_user_skill", "user_id", "skill_name"),)


class CareerGoal(Base):
    """What the user is targeting — role, company, salary, timeline."""
    __tablename__ = "career_goals"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    graph_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("career_graphs.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    target_role: Mapped[str | None] = mapped_column(String(255))
    target_company: Mapped[str | None] = mapped_column(String(255))
    target_salary_min: Mapped[int | None] = mapped_column(Integer)
    target_salary_max: Mapped[int | None] = mapped_column(Integer)
    target_location: Mapped[str | None] = mapped_column(String(255))
    timeline_months: Mapped[int | None] = mapped_column(Integer)
    work_mode: Mapped[str | None] = mapped_column(String(50))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    graph: Mapped["CareerGraph"] = relationship(back_populates="goals")


class CareerMilestone(Base):
    """Key career events — promotions, certifications, projects, pivots."""
    __tablename__ = "career_milestones"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    graph_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("career_graphs.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(50), nullable=False)       # job_change, promotion, cert, project, education
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    company: Mapped[str | None] = mapped_column(String(255))
    milestone_date: Mapped[str | None] = mapped_column(String(20))     # YYYY-MM
    impact_statement: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    graph: Mapped["CareerGraph"] = relationship(back_populates="milestones")


# ─────────────────────────────────────────────────────────────────────────────
# PHASE 2: COMPANY INTELLIGENCE
# ─────────────────────────────────────────────────────────────────────────────

class Company(Base):
    """Company intelligence database — enriched company profiles."""
    __tablename__ = "companies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    domain: Mapped[str | None] = mapped_column(String(255), unique=True)
    industry: Mapped[str | None] = mapped_column(String(100))
    size_range: Mapped[str | None] = mapped_column(String(50))          # 1-10, 11-50, 51-200, 201-1000, 1000+
    founded_year: Mapped[int | None] = mapped_column(Integer)
    hq_location: Mapped[str | None] = mapped_column(String(255))
    remote_policy: Mapped[str | None] = mapped_column(String(50))       # Remote, Hybrid, On-site, Flexible
    description: Mapped[str | None] = mapped_column(Text)
    website: Mapped[str | None] = mapped_column(Text)
    linkedin_url: Mapped[str | None] = mapped_column(Text)

    # Funding & financials
    funding_stage: Mapped[str | None] = mapped_column(String(50))       # Seed, Series A-E, Public, PE, Bootstrapped
    last_funding_amount: Mapped[int | None] = mapped_column(Integer)    # USD thousands
    last_funding_date: Mapped[str | None] = mapped_column(String(20))

    # Scores (0-100)
    glassdoor_rating: Mapped[float | None] = mapped_column(Float)
    glassdoor_review_count: Mapped[int | None] = mapped_column(Integer)
    culture_score: Mapped[int | None] = mapped_column(Integer)
    growth_score: Mapped[int | None] = mapped_column(Integer)
    layoff_risk_score: Mapped[int | None] = mapped_column(Integer)      # 0=low risk, 100=high risk
    interview_difficulty_avg: Mapped[float | None] = mapped_column(Float)  # 1-5

    # Rich data as JSONB
    tech_stack: Mapped[list | None] = mapped_column(JSONB, default=list)
    salary_ranges: Mapped[dict | None] = mapped_column(JSONB, default=dict)  # {role: {min, max, currency}}
    interview_process: Mapped[dict | None] = mapped_column(JSONB, default=dict)
    insider_report: Mapped[str | None] = mapped_column(Text)            # AI-synthesised brief

    last_updated: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    interview_reports: Mapped[list["CompanyInterviewReport"]] = relationship(
        back_populates="company", cascade="all, delete-orphan"
    )


class CompanyInterviewReport(Base):
    """Crowdsourced interview experience reports."""
    __tablename__ = "company_interview_reports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False)
    submitted_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    role: Mapped[str] = mapped_column(String(255), nullable=False)
    interview_rounds: Mapped[int | None] = mapped_column(Integer)
    difficulty: Mapped[int | None] = mapped_column(Integer)            # 1-5
    outcome: Mapped[str | None] = mapped_column(String(50))            # Offer, Rejected, Withdrew, Pending
    questions: Mapped[list | None] = mapped_column(JSONB, default=list)
    process_description: Mapped[str | None] = mapped_column(Text)
    tips: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    company: Mapped["Company"] = relationship(back_populates="interview_reports")


# ─────────────────────────────────────────────────────────────────────────────
# PHASE 3: LEARNING ENGINE
# ─────────────────────────────────────────────────────────────────────────────

class LearningPath(Base):
    """A structured learning path generated for a user to close a skill gap."""
    __tablename__ = "learning_paths"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    skill_name: Mapped[str] = mapped_column(String(255), nullable=False)
    target_level: Mapped[int] = mapped_column(Integer, default=3)       # 1-5
    current_level: Mapped[int] = mapped_column(Integer, default=0)
    estimated_hours: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(50), default="active")   # active, paused, completed
    progress_pct: Mapped[int] = mapped_column(Integer, default=0)
    resources: Mapped[list | None] = mapped_column(JSONB, default=list) # ordered list of resource IDs/URLs
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    completions: Mapped[list["LearningCompletion"]] = relationship(
        back_populates="path", cascade="all, delete-orphan"
    )


class LearningResource(Base):
    """Curated learning resource catalogue (courses, articles, videos, projects)."""
    __tablename__ = "learning_resources"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    skill_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    provider: Mapped[str | None] = mapped_column(String(100))           # Coursera, Udemy, YouTube, etc.
    url: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(String(50), default="course")     # video, article, course, project, book
    duration_minutes: Mapped[int | None] = mapped_column(Integer)
    difficulty: Mapped[str | None] = mapped_column(String(50))         # Beginner, Intermediate, Advanced
    is_free: Mapped[bool] = mapped_column(Boolean, default=False)
    rating: Mapped[float | None] = mapped_column(Float)
    tags: Mapped[list | None] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LearningCompletion(Base):
    """Tracks which resources a user has completed."""
    __tablename__ = "learning_completions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    path_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("learning_paths.id"))
    resource_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("learning_resources.id"))
    resource_url: Mapped[str | None] = mapped_column(Text)              # fallback if resource not in catalogue
    skill_name: Mapped[str] = mapped_column(String(255), nullable=False)
    rating_given: Mapped[int | None] = mapped_column(Integer)           # 1-5 user rating
    notes: Mapped[str | None] = mapped_column(Text)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    path: Mapped["LearningPath | None"] = relationship(back_populates="completions")


# ─────────────────────────────────────────────────────────────────────────────
# PHASE 7: NOTIFICATIONS
# ─────────────────────────────────────────────────────────────────────────────

class Notification(Base):
    """In-app notification system."""
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    # new_job_match | interview_reminder | application_followup |
    # skill_completed | health_score_change | autopilot_approval
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    action_url: Mapped[str | None] = mapped_column(Text)
    extra_data: Mapped[dict | None] = mapped_column(JSONB, default=dict)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ─────────────────────────────────────────────────────────────────────────────
# PHASE 6: PORTFOLIO
# ─────────────────────────────────────────────────────────────────────────────

class Portfolio(Base):
    """Public portfolio — one per user."""
    __tablename__ = "portfolios"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, unique=True, index=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    headline: Mapped[str | None] = mapped_column(String(255))
    bio: Mapped[str | None] = mapped_column(Text)
    ai_bio: Mapped[str | None] = mapped_column(Text)
    avatar_url: Mapped[str | None] = mapped_column(Text)
    linkedin_url: Mapped[str | None] = mapped_column(Text)
    github_url: Mapped[str | None] = mapped_column(Text)
    website_url: Mapped[str | None] = mapped_column(Text)
    theme: Mapped[str] = mapped_column(String(50), default="dark")
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    view_count: Mapped[int] = mapped_column(Integer, default=0)
    skills: Mapped[list | None] = mapped_column(JSONB, default=list)
    certifications: Mapped[list | None] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    projects: Mapped[list["PortfolioProject"]] = relationship(
        back_populates="portfolio", cascade="all, delete-orphan"
    )


class PortfolioProject(Base):
    """A project entry in the portfolio."""
    __tablename__ = "portfolio_projects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    portfolio_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("portfolios.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    ai_impact: Mapped[str | None] = mapped_column(Text)       # AI-rewritten impact statement
    tech_stack: Mapped[list | None] = mapped_column(JSONB, default=list)
    demo_url: Mapped[str | None] = mapped_column(Text)
    github_url: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(Text)
    featured: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    portfolio: Mapped["Portfolio"] = relationship(back_populates="projects")


# ─────────────────────────────────────────────────────────────────────────────
# PHASE 5: AUTOPILOT
# ─────────────────────────────────────────────────────────────────────────────

class AutopilotSettings(Base):
    """Per-user autopilot configuration."""
    __tablename__ = "autopilot_settings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, unique=True, index=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    min_fit_score: Mapped[int] = mapped_column(Integer, default=75)
    max_per_day: Mapped[int] = mapped_column(Integer, default=5)
    exclude_companies: Mapped[list | None] = mapped_column(JSONB, default=list)
    require_approval: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class AutopilotQueueItem(Base):
    """A job queued for autopilot application (pending approval or already sent)."""
    __tablename__ = "autopilot_queue"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    job_title: Mapped[str] = mapped_column(String(255), nullable=False)
    job_org: Mapped[str | None] = mapped_column(String(255))
    job_location: Mapped[str | None] = mapped_column(String(255))
    fit_score: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    # pending | approved | skipped | applied | failed
    generated_resume: Mapped[str | None] = mapped_column(Text)
    generated_cover_letter: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    actioned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

# Enterprise v2 persistence models. These tables are created by
# database/enterprise_v2.sql and remain additive to the legacy schema.
class SourceRegistry(Base):
    __tablename__ = "source_registry"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    name: Mapped[str] = mapped_column(Text, nullable=False)
    source_type: Mapped[str] = mapped_column(Text, nullable=False)
    base_url: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=50)
    crawl_frequency_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=360)
    parser_name: Mapped[str] = mapped_column(Text, nullable=False)
    parser_version: Mapped[str] = mapped_column(Text, nullable=False)
    dedupe_rules: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    compliance_policy: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    adapter_config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    health_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=100)
    failure_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_success_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_failure_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    ingestion_runs: Mapped[list["IngestionRun"]] = relationship(back_populates="source")

    __table_args__ = (UniqueConstraint("tenant_id", "base_url"),)


class IngestionRun(Base):
    __tablename__ = "ingestion_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("source_registry.id"), nullable=False)
    parser_version: Mapped[str] = mapped_column(Text, nullable=False)
    correlation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    counters: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    error_code: Mapped[str | None] = mapped_column(Text)
    error_detail: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    source: Mapped["SourceRegistry"] = relationship(back_populates="ingestion_runs")


class MatchPolicy(Base):
    __tablename__ = "match_policies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    name: Mapped[str] = mapped_column(Text, nullable=False)
    version: Mapped[str] = mapped_column(Text, nullable=False)
    rules: Mapped[dict] = mapped_column(JSONB, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    assessments: Mapped[list["MatchAssessment"]] = relationship(back_populates="policy")

    __table_args__ = (UniqueConstraint("tenant_id", "name", "version"),)


class MatchAssessment(Base):
    __tablename__ = "match_assessments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("verified_jobs.id"), nullable=False)
    profile_snapshot_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    scoring_version: Mapped[str] = mapped_column(Text, nullable=False)
    policy_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("match_policies.id"))
    overall_score: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    eligibility_score: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    relevance_score: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    competitiveness_score: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    completeness_score: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    confidence_score: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    fit_label: Mapped[str] = mapped_column(Text, nullable=False)
    reason_trace: Mapped[dict] = mapped_column(JSONB, nullable=False)
    input_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    policy: Mapped["MatchPolicy | None"] = relationship(back_populates="assessments")

    __table_args__ = (Index("idx_match_user_job", "user_id", "job_id", created_at.desc()),)


class ApplicationEvent(Base):
    __tablename__ = "application_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    application_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False)
    actor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    event_type: Mapped[str] = mapped_column(Text, nullable=False)
    from_status: Mapped[str | None] = mapped_column(Text)
    to_status: Mapped[str | None] = mapped_column(Text)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    application: Mapped["Application"] = relationship(back_populates="events")

    __table_args__ = (Index("idx_application_timeline", "application_id", occurred_at.desc()),)


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    actor_type: Mapped[str] = mapped_column(Text, nullable=False)
    action: Mapped[str] = mapped_column(Text, nullable=False)
    resource_type: Mapped[str] = mapped_column(Text, nullable=False)
    resource_id: Mapped[str] = mapped_column(Text, nullable=False)
    request_id: Mapped[str | None] = mapped_column(Text)
    before_state: Mapped[dict | None] = mapped_column(JSONB)
    after_state: Mapped[dict | None] = mapped_column(JSONB)
    audit_metadata: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False, default=dict)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (Index("idx_audit_resource", "tenant_id", "resource_type", "resource_id", occurred_at.desc()),)

class SourceCandidate(Base):
    __tablename__ = "source_candidates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    discovered_url: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    discovery_method: Mapped[str] = mapped_column(Text, nullable=False)
    validation_status: Mapped[str] = mapped_column(Text, nullable=False, default="pending")
    detected_source_type: Mapped[str | None] = mapped_column(Text)
    evidence: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())



class OutboxEvent(Base):
    __tablename__ = "outbox_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    aggregate_type: Mapped[str] = mapped_column(Text, nullable=False)
    aggregate_id: Mapped[str] = mapped_column(Text, nullable=False)
    event_type: Mapped[str] = mapped_column(Text, nullable=False)
    event_version: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_error: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        Index("idx_outbox_unpublished", "occurred_at", postgresql_where=published_at.is_(None)),
        Index("idx_outbox_aggregate", "aggregate_type", "aggregate_id", "occurred_at"),
    )

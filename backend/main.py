import time
import logging
from collections import defaultdict
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from core.config import settings
from core.database import engine
from models import database as _models   # noqa: F401 — ensures all models are registered
from models.database import Base
from api import (
    jobs, resume, applications, skill_gap, salary,
    recruiter, interview, profile, negotiation, stream,
    intelligence_tools, auth, evaluate, apply, campaign,
    career_graph, company, learning, notifications, market,
    insights, interview_analytics, portfolio, autopilot, digest,
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create all SQLAlchemy-managed tables on startup (idempotent)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables ensured.")
    yield


app = FastAPI(
    title="Job Intelligence Platform API",
    description="AI-powered career strategy, job discovery, and resume optimization.",
    version="3.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-process rate limiter ───────────────────────────────────────────────────
# LLM-heavy: 10 req/min | General: 60 req/min
_rate_store: dict[str, list[float]] = defaultdict(list)
_LLM_PATHS = {
    "/api/resume/generate-ats",
    "/api/resume/generate-cover-letter",
    "/api/resume/generate-master",
    "/api/resume/generate-pdf",
    "/api/interview/questions",
    "/api/interview/mock-chat",
    "/api/recruiter/outreach-message",
    "/api/negotiation/strategize",
    "/api/stream/cover-letter",
    "/api/stream/resume-bullets",
    "/api/stream/hiring-decoder",
    "/api/stream/resume-surgeon",
    "/api/stream/linkedin-infiltrator",
    "/api/stream/interview-trap-detector",
    "/api/stream/cold-email-weapon",
    "/api/stream/offer-negotiator",
    "/api/stream/gap-killer",
    "/api/stream/attack-plan",
    "/api/stream/deep-research",
    "/api/skill-gap/analyze",
    "/api/intelligence-tools/hiring-decoder",
    "/api/intelligence-tools/resume-surgeon",
    "/api/intelligence-tools/linkedin-infiltrator",
    "/api/intelligence-tools/interview-trap-detector",
    "/api/intelligence-tools/cold-email-weapon",
    "/api/intelligence-tools/offer-negotiator",
    "/api/intelligence-tools/gap-killer",
    "/api/intelligence-tools/attack-plan",
    "/api/intelligence-tools/job-evaluator",
    "/api/evaluate/compare",
    "/api/evaluate/course",
    "/api/evaluate/project",
    "/api/apply/generate-answers",
    "/api/apply/voice-note-script",
    "/api/campaign/daily-todos",
    "/api/career-graph/compute-health",
    "/api/career-graph/fit-score",
    "/api/market/radar",
    "/api/market/salary-benchmark",
    "/api/market/trending-skills",
    "/api/market/role-demand",
    "/api/company/enrich",
    "/api/insights/rejection-analysis",
    "/api/interview-analytics/mock-feedback",
    "/api/interview-analytics/shadow-review",
    "/api/learning/paths/generate",
    "/api/portfolio/generate-bio",
    "/api/autopilot/scan",
    "/api/interview-analytics/mock-feedback",
    "/api/interview-analytics/shadow-review",
}


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    # Use X-Forwarded-For if behind a proxy; fall back to direct IP
    forwarded = request.headers.get("X-Forwarded-For")
    client_ip = forwarded.split(",")[0].strip() if forwarded else (
        request.client.host if request.client else "unknown"
    )
    path  = request.url.path
    now   = time.time()
    limit = 10 if path in _LLM_PATHS else 60

    _rate_store[client_ip] = [t for t in _rate_store[client_ip] if now - t < 60]
    if len(_rate_store[client_ip]) >= limit:
        return JSONResponse(
            status_code=429,
            content={"detail": f"Rate limit: max {limit} req/min for this endpoint."},
        )
    _rate_store[client_ip].append(now)
    return await call_next(request)


# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router,              prefix="/api/auth",              tags=["Auth"])
app.include_router(jobs.router,              prefix="/api/jobs",              tags=["Jobs"])
app.include_router(resume.router,            prefix="/api/resume",            tags=["Resume"])
app.include_router(applications.router,      prefix="/api/applications",      tags=["Applications"])
app.include_router(evaluate.router,          prefix="/api/evaluate",          tags=["Evaluate"])
app.include_router(apply.router,             prefix="/api/apply",             tags=["Apply"])
app.include_router(campaign.router,          prefix="/api/campaign",          tags=["Campaign"])
app.include_router(skill_gap.router,         prefix="/api/skill-gap",         tags=["Skill Gap"])
app.include_router(salary.router,            prefix="/api/salary",            tags=["Salary"])
app.include_router(recruiter.router,         prefix="/api/recruiter",         tags=["Recruiter"])
app.include_router(interview.router,         prefix="/api/interview",         tags=["Interview"])
app.include_router(profile.router,           prefix="/api/profile",           tags=["Profile"])
app.include_router(negotiation.router,       prefix="/api/negotiation",       tags=["Negotiation"])
app.include_router(stream.router,            prefix="/api/stream",            tags=["Streaming"])
app.include_router(intelligence_tools.router, prefix="/api/intelligence-tools", tags=["Intelligence Tools"])
app.include_router(career_graph.router,       prefix="/api/career-graph",       tags=["Career Graph"])
app.include_router(company.router,            prefix="/api/company",            tags=["Company Intelligence"])
app.include_router(learning.router,           prefix="/api/learning",           tags=["Learning Engine"])
app.include_router(notifications.router,      prefix="/api/notifications",      tags=["Notifications"])
app.include_router(market.router,               prefix="/api/market",               tags=["Market Radar"])
app.include_router(insights.router,             prefix="/api/insights",             tags=["Insights"])
app.include_router(interview_analytics.router,  prefix="/api/interview-analytics",  tags=["Interview Analytics"])
app.include_router(portfolio.router,            prefix="/api/portfolio",            tags=["Portfolio"])
app.include_router(autopilot.router,            prefix="/api/autopilot",            tags=["Autopilot"])
app.include_router(digest.router,               prefix="/api/digest",               tags=["Digest"])


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy", "version": "3.0.0"}

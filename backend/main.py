import time
import logging
from collections import defaultdict
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from core.config import settings
from core.database import database_url, engine
from models import database as _models   # noqa: F401 - ensures all models are registered
from models.database import Base
from api import (
    jobs, resume, applications, skill_gap, salary,
    recruiter, interview, profile, negotiation, stream,
    intelligence_tools, auth, evaluate, apply, campaign,
    career_graph, company, learning, notifications, market,
    insights, interview_analytics, portfolio, autopilot, digest,
)

logger = logging.getLogger(__name__)

def _allowed_cors_origin(origin: str | None) -> str | None:
    if not origin:
        return None
    allowed = settings.CORS_ORIGINS
    if isinstance(allowed, str):
        allowed = [allowed]
    if "*" in allowed or origin in allowed:
        return origin
    return None


def _apply_cors_headers(response: Response, origin: str | None) -> Response:
    allowed_origin = _allowed_cors_origin(origin)
    if allowed_origin:
        response.headers["Access-Control-Allow-Origin"] = allowed_origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Vary"] = "Origin"
    response.headers.setdefault("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
    response.headers.setdefault("Access-Control-Allow-Headers", "Authorization,Content-Type,Accept,Origin,X-Requested-With")
    response.headers.setdefault("Access-Control-Max-Age", "600")
    return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create all SQLAlchemy-managed tables on startup (idempotent)."""
    db_url: str = database_url
    is_local_dev = "localhost" in db_url or "127.0.0.1" in db_url
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables ensured.")
    except Exception as exc:
        if is_local_dev:
            # Local dev without PostgreSQL running - start in degraded mode
            logger.warning(
                f"No local database - starting in degraded mode: {exc}\n"
                "DB-backed endpoints will fail. Run PostgreSQL locally or point "
                "DATABASE_URL at a cloud DB (e.g. Neon.tech)."
            )
        else:
            # Production: fail fast so the host (Render, Railway, etc.) knows
            # the deployment is broken and won't route traffic to this instance.
            logger.error(f"Database connection failed on startup: {exc}")
            raise
    yield


app = FastAPI(
    title="Job Intelligence Platform API",
    description="AI-powered career strategy, job discovery, and resume optimization.",
    version="3.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-process rate limiter
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

    bucket_key = f"{client_ip}:{path}"
    _rate_store[bucket_key] = [t for t in _rate_store[bucket_key] if now - t < 60]
    if len(_rate_store[bucket_key]) >= limit:
        return JSONResponse(
            status_code=429,
            headers={"Retry-After": "60"},
            content={"detail": f"Rate limit: max {limit} req/min for this endpoint."},
        )
    _rate_store[bucket_key].append(now)
    return await call_next(request)


# Routers
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


# Health check
@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy", "version": "3.0.0"}

@app.middleware("http")
async def browser_cors_middleware(request: Request, call_next):
    origin = request.headers.get("origin")
    if request.method == "OPTIONS":
        return _apply_cors_headers(Response(status_code=204), origin)
    try:
        response = await call_next(request)
    except Exception as exc:
        logger.exception("Unhandled API error while processing %s %s", request.method, request.url.path)
        response = JSONResponse(status_code=500, content={"detail": "Internal server error"})
    return _apply_cors_headers(response, origin)

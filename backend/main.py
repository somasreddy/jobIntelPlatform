import time
import logging
from collections import defaultdict
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from core.config import settings
from api import jobs, resume, applications, skill_gap, salary, recruiter, interview
from api import profile, negotiation, stream, intelligence_tools

logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Job Intelligence API",
    description="Backend API for the Job Intelligence & Career Optimization Platform",
    version="2.0.0",
)

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Simple In-Process Rate Limiter ---
# LLM-heavy endpoints: 10 req/min | General endpoints: 60 req/min
_rate_store: dict[str, list[float]] = defaultdict(list)
_LLM_PATHS = {
    "/api/resume/generate-ats",
    "/api/resume/generate-cover-letter",
    "/api/interview/questions",
    "/api/interview/mock-chat",
    "/api/recruiter/outreach-message",
    "/api/negotiation/strategize",
    "/api/stream/cover-letter",
    "/api/stream/resume-bullets",
    "/api/skill-gap/analyze",
    "/api/intelligence-tools/hiring-decoder",
    "/api/intelligence-tools/resume-surgeon",
    "/api/intelligence-tools/linkedin-infiltrator",
    "/api/intelligence-tools/interview-trap-detector",
    "/api/intelligence-tools/cold-email-weapon",
    "/api/intelligence-tools/offer-negotiator",
    "/api/intelligence-tools/gap-killer",
    "/api/intelligence-tools/attack-plan",
}


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    client_ip = request.client.host if request.client else "unknown"
    path = request.url.path
    now = time.time()
    window = 60  # seconds
    limit = 10 if path in _LLM_PATHS else 60

    _rate_store[client_ip] = [t for t in _rate_store[client_ip] if now - t < window]

    if len(_rate_store[client_ip]) >= limit:
        return JSONResponse(
            status_code=429,
            content={"detail": f"Rate limit exceeded. Max {limit} requests/minute for this endpoint."},
        )

    _rate_store[client_ip].append(now)
    return await call_next(request)


# --- Routers ---
app.include_router(jobs.router, prefix="/api/jobs", tags=["Jobs"])
app.include_router(resume.router, prefix="/api/resume", tags=["Resume"])
app.include_router(applications.router, prefix="/api/applications", tags=["Applications"])
app.include_router(skill_gap.router, prefix="/api/skill-gap", tags=["Skill Gap"])
app.include_router(salary.router, prefix="/api/salary", tags=["Salary & Insights"])
app.include_router(recruiter.router, prefix="/api/recruiter", tags=["Recruiter Outreach"])
app.include_router(interview.router, prefix="/api/interview", tags=["Interview Coach"])
app.include_router(profile.router, prefix="/api/profile", tags=["Profile"])
app.include_router(negotiation.router, prefix="/api/negotiation", tags=["Salary Negotiation"])
app.include_router(stream.router, prefix="/api/stream", tags=["Streaming"])
app.include_router(intelligence_tools.router, prefix="/api/intelligence-tools", tags=["Intelligence Tools"])


@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "2.0.0"}

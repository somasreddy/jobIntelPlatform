from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import settings
from api import jobs, resume, applications, skill_gap, salary, recruiter

app = FastAPI(
    title="AI Job Intelligence API",
    description="Backend API for the Job Intelligence & Career Optimization Platform",
    version="1.0.0",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(jobs.router, prefix="/api/jobs", tags=["Jobs"])
app.include_router(resume.router, prefix="/api/resume", tags=["Resume"])
app.include_router(applications.router, prefix="/api/applications", tags=["Applications"])
app.include_router(skill_gap.router, prefix="/api/skill-gap", tags=["Skill Gap"])
app.include_router(salary.router, prefix="/api/salary", tags=["Salary & Insights"])
app.include_router(recruiter.router, prefix="/api/recruiter", tags=["Recruiter Outreach"])

@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "1.0.0"}

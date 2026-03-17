from pydantic import BaseModel, UUID4, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class JobBase(BaseModel):
    title: str
    organization: str
    location: Optional[str] = None
    work_mode: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    currency: str = "USD"
    experience_required: Optional[int] = None
    description: Optional[str] = None
    technologies: List[str] = []
    application_link: Optional[str] = None
    career_page_link: Optional[str] = None
    verification_status: str = "UNVERIFIED"

class JobCreate(JobBase):
    pass

class Job(JobBase):
    id: UUID4
    match_score: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

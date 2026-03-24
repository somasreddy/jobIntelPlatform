from fastapi import APIRouter, Body, HTTPException
from typing import Dict, Any, Optional, List
from pydantic import BaseModel

from negotiation_coach.coach import NegotiationCoach

router = APIRouter()
_coach = NegotiationCoach()


class NegotiationRequest(BaseModel):
    offered_salary: int
    currency: str = "USD"
    role: str
    company: str
    location: str
    experience_years: int
    current_salary: Optional[int] = None
    competing_offers: Optional[List[Dict[str, Any]]] = None
    skills: Optional[List[str]] = None
    notes: Optional[str] = ""


@router.post("/strategize")
async def get_negotiation_strategy(payload: NegotiationRequest):
    """
    Generate a complete salary negotiation strategy with counter-offer,
    talking points, negotiation script, and email template.
    """
    if payload.offered_salary <= 0:
        raise HTTPException(status_code=400, detail="offered_salary must be positive")

    result = await _coach.strategize(
        offered_salary=payload.offered_salary,
        currency=payload.currency,
        role=payload.role,
        company=payload.company,
        location=payload.location,
        experience_years=payload.experience_years,
        current_salary=payload.current_salary,
        competing_offers=payload.competing_offers,
        skills=payload.skills,
        notes=payload.notes or "",
    )
    return result

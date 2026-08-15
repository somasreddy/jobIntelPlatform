from fastapi import APIRouter, Body
from salary_prediction.predictor import SalaryPredictor

router = APIRouter()
_predictor = SalaryPredictor()

# Honest, accurate description of what salary_prediction/predictor.py actually
# does — a static, hand-curated lookup table (location band x experience
# tier), adjusted by a role-keyword multiplier and a FAANG-company override.
# It is NOT queried against any live compensation feed and is NOT an LLM
# guess: every number is a deterministic function of the inputs below, so the
# same (role, experience_years, location, company) always returns the same
# figures. Surfaced in the response so any UI showing this can cite it
# accurately instead of implying a live/sourced number.
_METHODOLOGY_NOTE = (
    "Rule-based estimate: a static salary-band table keyed by location band "
    "and experience tier, adjusted by a role-keyword multiplier (e.g. "
    "\"principal\", \"AI engineer\") and a FAANG-company override. Not "
    "sourced from a live market feed and not an AI/LLM guess — every figure "
    "is a deterministic table lookup, last curated for 2025 "
    "(salary_prediction/predictor.py)."
)


@router.post("/predict")
async def predict_salary(payload: dict = Body(...)):
    """
    Predict salary range based on role, experience, location, and (optionally)
    company. This is a deterministic, rule-based estimate — see
    `_METHODOLOGY_NOTE` / salary_prediction/predictor.py for exactly how the
    band lookup works. It is not sourced from a live market feed and not an
    LLM guess.

    Body: { role: str, experience_years: int, location: str, company?: str }
    """
    role = payload.get("role", "QA Automation Engineer")
    experience_years = int(payload.get("experience_years", 5))
    location = payload.get("location", "United States (Remote)")
    company = payload.get("company", "")
    result = await _predictor.predict(role, experience_years, location, company)
    result["source"] = "computed"
    result["methodology"] = _METHODOLOGY_NOTE
    return result

from fastapi import APIRouter, Body
from salary_prediction.predictor import SalaryPredictor

router = APIRouter()
_predictor = SalaryPredictor()


@router.post("/predict")
async def predict_salary(payload: dict = Body(...)):
    """
    Predict salary range based on role, experience, and location.
    Body: { role: str, experience_years: int, location: str }
    """
    role = payload.get("role", "QA Automation Engineer")
    experience_years = int(payload.get("experience_years", 5))
    location = payload.get("location", "United States (Remote)")
    result = await _predictor.predict(role, experience_years, location)
    return result

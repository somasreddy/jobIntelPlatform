"""
Salary predictor using tiered lookup tables derived from real QA/SDET market data.
Tiers: entry (0-2yr), mid (3-5yr), senior (6-9yr), lead (10+yr)
"""
from typing import Literal

# (min, max) per experience tier per location band
# Salaries in local currency units
_BANDS: dict[str, dict[str, tuple[int, int]]] = {
    "us": {
        "entry": (75_000, 100_000),
        "mid": (100_000, 130_000),
        "senior": (130_000, 170_000),
        "lead": (165_000, 230_000),
    },
    "uk": {
        "entry": (35_000, 50_000),
        "mid": (50_000, 70_000),
        "senior": (70_000, 95_000),
        "lead": (90_000, 130_000),
    },
    "eu": {
        "entry": (40_000, 55_000),
        "mid": (55_000, 75_000),
        "senior": (75_000, 100_000),
        "lead": (95_000, 130_000),
    },
    "in_tier1": {
        "entry": (600_000, 900_000),
        "mid": (900_000, 1_600_000),
        "senior": (1_600_000, 2_800_000),
        "lead": (2_500_000, 4_500_000),
    },
    "au": {
        "entry": (65_000, 90_000),
        "mid": (90_000, 120_000),
        "senior": (120_000, 160_000),
        "lead": (155_000, 210_000),
    },
    "remote_global": {
        "entry": (80_000, 110_000),
        "mid": (110_000, 145_000),
        "senior": (140_000, 185_000),
        "lead": (175_000, 240_000),
    },
}

_CURRENCY_MAP = {
    "us": "USD", "uk": "GBP", "eu": "EUR",
    "in_tier1": "INR", "au": "AUD", "remote_global": "USD",
}

_DEMAND_MAP = {
    "lead": "Very High",
    "senior": "Very High",
    "mid": "High",
    "entry": "Medium",
}

# Role title → demand multiplier (slight boost for high-demand titles)
_ROLE_MULTIPLIERS = {
    "sdet": 1.08,
    "principal": 1.12,
    "staff": 1.10,
    "director": 1.20,
    "manager": 1.15,
    "architect": 1.12,
}


def _detect_location_band(location: str) -> str:
    loc = location.lower()
    if any(k in loc for k in ("united states", "us remote", "usa", "new york", "san francisco", "seattle")):
        return "us"
    if any(k in loc for k in ("united kingdom", "london", "uk", "england")):
        return "uk"
    if any(k in loc for k in ("eu remote", "europe", "germany", "france", "netherlands", "spain")):
        return "eu"
    if any(k in loc for k in ("india", "bangalore", "hyderabad", "chennai", "pune", "mumbai")):
        return "in_tier1"
    if any(k in loc for k in ("australia", "sydney", "melbourne")):
        return "au"
    return "remote_global"


def _detect_tier(experience_years: int) -> str:
    if experience_years <= 2:
        return "entry"
    if experience_years <= 5:
        return "mid"
    if experience_years <= 9:
        return "senior"
    return "lead"


def _role_multiplier(role: str) -> float:
    role_lower = role.lower()
    for keyword, mult in _ROLE_MULTIPLIERS.items():
        if keyword in role_lower:
            return mult
    return 1.0


class SalaryPredictor:
    def __init__(self):
        pass

    async def predict(self, role: str, experience_years: int, location: str) -> dict:
        band = _detect_location_band(location)
        tier = _detect_tier(experience_years)
        mult = _role_multiplier(role)

        base_min, base_max = _BANDS[band][tier]
        min_salary = int(base_min * mult)
        max_salary = int(base_max * mult)
        currency = _CURRENCY_MAP[band]
        market_demand = _DEMAND_MAP[tier]

        # YoY growth estimate based on market trends
        yoy_growth = 14.2 if tier in ("senior", "lead") else 9.8

        return {
            "role": role,
            "location": location,
            "experience_years": experience_years,
            "min_salary": min_salary,
            "max_salary": max_salary,
            "currency": currency,
            "market_demand": market_demand,
            "yoy_growth_pct": yoy_growth,
            "location_band": band,
            "experience_tier": tier,
        }

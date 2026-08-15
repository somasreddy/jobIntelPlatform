"""
Tests for SalaryPredictor in salary_prediction/predictor.py.

`predict()` is declared `async def` but does no I/O at all - no DB, no
LLM, no network - it is pure lookup/arithmetic over a static table. We
still `await` it (via pytest-asyncio) to exercise the real coroutine
rather than reaching into private helpers only.
"""
from __future__ import annotations

import pytest

from salary_prediction.predictor import SalaryPredictor

pytestmark = pytest.mark.asyncio


@pytest.fixture
def predictor() -> SalaryPredictor:
    return SalaryPredictor()


async def test_predict_detects_location_band_and_experience_tier(predictor):
    result = await predictor.predict(
        role="Backend Engineer", experience_years=7, location="Berlin, Germany"
    )

    assert result["location_band"] == "dach"
    assert result["experience_tier"] == "senior"
    assert result["currency"] == "EUR"
    assert result["min_salary"] < result["mid_salary"] < result["max_salary"]


async def test_predict_applies_faang_override_only_for_us_companies(predictor):
    us_faang = await predictor.predict(
        role="Software Engineer", experience_years=5, location="San Francisco", company="Google"
    )
    us_non_faang = await predictor.predict(
        role="Software Engineer", experience_years=5, location="San Francisco", company="Local Startup Inc"
    )

    assert us_faang["is_faang_band"] is True
    assert us_non_faang["is_faang_band"] is False
    # Same tier/role, but FAANG band pays strictly more.
    assert us_faang["min_salary"] > us_non_faang["min_salary"]


async def test_predict_faang_override_does_not_apply_outside_us_band(predictor):
    # "Google" in Berlin should NOT trigger the US-only FAANG override,
    # since the override is only defined for band == "us".
    result = await predictor.predict(
        role="Software Engineer", experience_years=5, location="Berlin, Germany", company="Google"
    )
    assert result["location_band"] == "dach"
    assert result["is_faang_band"] is False


async def test_predict_applies_role_multiplier_for_premium_titles(predictor):
    baseline = await predictor.predict(
        role="Software Engineer", experience_years=5, location="United States"
    )
    premium = await predictor.predict(
        role="LLM Engineer", experience_years=5, location="United States"
    )

    assert premium["min_salary"] > baseline["min_salary"]
    assert premium["max_salary"] > baseline["max_salary"]


@pytest.mark.parametrize(
    "years,expected_tier",
    [(0, "entry"), (2, "entry"), (3, "mid"), (5, "mid"), (6, "senior"),
     (9, "senior"), (10, "lead"), (14, "lead"), (15, "principal")],
)
async def test_predict_experience_tier_boundaries(predictor, years, expected_tier):
    result = await predictor.predict(role="Engineer", experience_years=years, location="Remote")
    assert result["experience_tier"] == expected_tier


async def test_predict_defaults_unrecognized_location_to_remote_global(predictor):
    result = await predictor.predict(role="Engineer", experience_years=3, location="Made Up Place")
    assert result["location_band"] == "remote_global"
    assert result["currency"] == "USD"


async def test_predict_percentiles_are_monotonic_and_negotiation_tip_present(predictor):
    result = await predictor.predict(role="Engineer", experience_years=8, location="India, Bangalore")

    assert result["percentile_50"] <= result["percentile_75"] <= result["percentile_90"]
    assert f"{result['percentile_90']:,}" in result["negotiation_tip"]

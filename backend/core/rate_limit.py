from __future__ import annotations

import logging

from core.config import settings

logger = logging.getLogger(__name__)

# --- Redis client singleton (same convention as core/llm.py) ---
_redis_client = None


def get_redis_client():
    global _redis_client
    if _redis_client is None:
        try:
            import redis.asyncio as aioredis
            _redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        except Exception as e:
            logger.warning(f"Redis client init failed: {e}")
    return _redis_client


# LLM-heavy: 10 req/min | General: 60 req/min
LLM_PATHS = {
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
}

LLM_RATE_LIMIT = 10
DEFAULT_RATE_LIMIT = 60
WINDOW_SECONDS = 60


async def check_rate_limit(client_ip: str, path: str) -> tuple[bool, int]:
    """
    Redis-backed fixed-window rate limiter (INCR + EXPIRE), keyed per
    client IP + path, matching the LLM-heavy (10/min) vs general (60/min)
    policy previously enforced in-process in main.py.

    Returns (allowed, limit). If Redis is unavailable for any reason this
    fails open (allowed=True) and logs a warning - it is a safety net, not
    something that should take the API down.
    """
    limit = LLM_RATE_LIMIT if path in LLM_PATHS else DEFAULT_RATE_LIMIT

    client = get_redis_client()
    if client is None:
        return True, limit

    key = f"ratelimit:{client_ip}:{path}"
    try:
        count = await client.incr(key)
        if count == 1:
            # First hit in this window - (re)start the TTL.
            await client.expire(key, WINDOW_SECONDS)
        if count > limit:
            return False, limit
        return True, limit
    except Exception as e:
        logger.warning(f"Redis rate limit check failed, failing open: {e}")
        return True, limit

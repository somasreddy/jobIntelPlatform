"""
Verification Engine — checks whether a job's application link is still live
by issuing an HTTP HEAD/GET request and inspecting the response.
"""
import logging
import httpx

logger = logging.getLogger(__name__)

_TIMEOUT = 10.0
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    )
}
# Status codes that mean the link is still live
_LIVE_CODES = {200, 201, 301, 302, 303, 307, 308}
# Phrases in page body that indicate a job is no longer listed
_DEAD_PHRASES = [
    "no longer accepting",
    "job has been filled",
    "position has been filled",
    "this job is no longer",
    "expired",
    "job not found",
    "404",
]


async def _check_url(url: str) -> str:
    """Returns 'VERIFIED', 'EXPIRED', or 'UNVERIFIED'."""
    if not url or not url.startswith("http"):
        return "UNVERIFIED"
    try:
        async with httpx.AsyncClient(
            timeout=_TIMEOUT, follow_redirects=True, headers=_HEADERS
        ) as client:
            # First try HEAD (fast, no body)
            try:
                resp = await client.head(url)
            except Exception:
                resp = await client.get(url)

            if resp.status_code not in _LIVE_CODES:
                return "EXPIRED"

            # For GET responses, check body for dead phrases
            if hasattr(resp, "text") and resp.text:
                body_lower = resp.text[:3000].lower()
                if any(phrase in body_lower for phrase in _DEAD_PHRASES):
                    return "EXPIRED"

            return "VERIFIED"
    except httpx.TimeoutException:
        logger.debug(f"Timeout verifying {url}")
        return "UNVERIFIED"
    except Exception as e:
        logger.debug(f"Verification error for {url}: {e}")
        return "UNVERIFIED"


class VerificationEngine:
    def __init__(self):
        pass

    async def verify_job(self, job: dict) -> dict:
        """
        Verifies a job by checking its application_link and career_page_link.
        Returns updated dict with verification_status.
        """
        app_link = job.get("application_link", "")
        career_link = job.get("career_page_link", "")

        logger.info(f"Verifying: {job.get('title')} @ {job.get('organization')}")

        # Check application link first; fall back to career page
        status = await _check_url(app_link)
        if status == "UNVERIFIED" and career_link and career_link != app_link:
            status = await _check_url(career_link)

        return {
            **job,
            "verification_status": status,
        }

    async def verify_job_on_career_portal(
        self, organization: str, title: str, url: str = ""
    ) -> dict:
        """Legacy method: verifies by URL."""
        status = await _check_url(url)
        return {"status": status, "career_page_link": url or None}

"""
Job Discovery Service — fetches QA/SDET jobs from:
1. Remotive.com public API (free, no auth)
2. Arbeitnow.com public API (free, no auth)
Falls back to an empty list on error.
"""
import logging
import re
from typing import Optional
import httpx

logger = logging.getLogger(__name__)

_TIMEOUT = 15.0

_QA_KEYWORDS = {
    "qa", "quality assurance", "sdet", "test automation", "automation engineer",
    "qa engineer", "qa lead", "test engineer", "quality engineer",
}

_TECH_TOKENS = {
    "selenium", "playwright", "cypress", "appium", "webdriverio",
    "testng", "junit", "pytest", "cucumber", "robot framework",
    "rest assured", "postman", "jmeter", "k6", "gatling",
    "java", "python", "javascript", "typescript", "kotlin",
    "jenkins", "github actions", "gitlab ci", "azure devops",
    "docker", "kubernetes", "aws", "azure", "gcp", "terraform",
}


def _extract_technologies(text: str) -> list:
    text_lower = text.lower()
    found = []
    for tech in _TECH_TOKENS:
        if tech in text_lower:
            found.append(tech.title())
    return list(dict.fromkeys(found))[:12]


def _is_qa_role(title: str) -> bool:
    title_lower = title.lower()
    return any(kw in title_lower for kw in _QA_KEYWORDS)


def _detect_work_mode(text: str) -> str:
    t = text.lower()
    if "remote" in t:
        return "Remote"
    if "hybrid" in t:
        return "Hybrid"
    return "On-site"


def _parse_salary(salary_str: Optional[str]) -> tuple:
    if not salary_str:
        return None, None, "USD"
    currency = "USD"
    if "£" in salary_str or "gbp" in salary_str.lower():
        currency = "GBP"
    elif "€" in salary_str or "eur" in salary_str.lower():
        currency = "EUR"
    elif "₹" in salary_str or "inr" in salary_str.lower():
        currency = "INR"
    clean = salary_str.replace(",", "")
    nums = [int(n) for n in re.findall(r"\d+", clean) if int(n) > 1000]
    if len(nums) >= 2:
        return nums[0], nums[1], currency
    if len(nums) == 1:
        return nums[0], int(nums[0] * 1.3), currency
    return None, None, currency


async def _fetch_remotive() -> list:
    url = "https://remotive.com/api/remote-jobs"
    params = {"category": "qa", "limit": 40}
    jobs = []
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
            for item in data.get("jobs", []):
                title = item.get("title", "")
                if not _is_qa_role(title):
                    continue
                desc = item.get("description", "")
                sal_min, sal_max, currency = _parse_salary(item.get("salary", ""))
                techs = _extract_technologies(
                    desc + " " + " ".join(item.get("tags") or [])
                )
                jobs.append({
                    "title": title,
                    "organization": item.get("company_name", ""),
                    "location": item.get("candidate_required_location") or "Remote",
                    "work_mode": "Remote",
                    "salary_min": sal_min,
                    "salary_max": sal_max,
                    "currency": currency,
                    "description": re.sub(r"<[^>]+>", "", desc)[:2000],
                    "technologies": techs,
                    "application_link": item.get("url", ""),
                    "career_page_link": item.get("url", ""),
                    "posted_date": (item.get("publication_date") or "")[:10],
                    "verification_status": "UNVERIFIED",
                })
    except Exception as e:
        logger.warning(f"Remotive fetch failed: {e}")
    return jobs


async def _fetch_arbeitnow() -> list:
    url = "https://www.arbeitnow.com/api/job-board-api"
    params = {"search": "QA automation", "remote": "true"}
    jobs = []
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
            for item in data.get("data", []):
                title = item.get("title", "")
                if not _is_qa_role(title):
                    continue
                desc = item.get("description", "")
                techs = _extract_technologies(desc)
                jobs.append({
                    "title": title,
                    "organization": item.get("company_name", ""),
                    "location": item.get("location", "Remote"),
                    "work_mode": _detect_work_mode(
                        (item.get("location") or "") + " " + desc
                    ),
                    "salary_min": None,
                    "salary_max": None,
                    "currency": "EUR",
                    "description": re.sub(r"<[^>]+>", "", desc)[:2000],
                    "technologies": techs,
                    "application_link": item.get("url", ""),
                    "career_page_link": item.get("url", ""),
                    "posted_date": (item.get("created_at") or "")[:10],
                    "verification_status": "UNVERIFIED",
                })
    except Exception as e:
        logger.warning(f"Arbeitnow fetch failed: {e}")
    return jobs


class JobDiscoveryService:
    def __init__(self):
        pass

    async def discover_jobs(
        self, query: str = "QA Automation", location: str = "Remote"
    ) -> list:
        """
        Fetch QA/SDET jobs from multiple free public APIs.
        Returns normalized job dicts ready for DB insertion.
        """
        logger.info(f"Discovering jobs for '{query}' in '{location}'")
        remotive = await _fetch_remotive()
        arbeitnow = await _fetch_arbeitnow()
        all_jobs = remotive + arbeitnow
        logger.info(f"Discovered {len(all_jobs)} QA jobs total")
        return all_jobs

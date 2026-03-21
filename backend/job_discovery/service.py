"""
Job Discovery Service — aggregates jobs from multiple portals:

Free / no-auth:
  1. Remotive.com API      — remote roles
  2. Arbeitnow.com API     — global roles
  3. The Muse API          — engineering / tech roles
  4. RemoteOK API          — remote tech roles (no auth)
  5. Jobicy API            — remote jobs worldwide (no auth)

Free with registration:
  6. Adzuna API            — India / UK / USA / AU (needs ADZUNA_APP_ID + ADZUNA_APP_KEY)

Optional paid key:
  7. JSearch (RapidAPI)    — aggregates LinkedIn / Indeed / Glassdoor / Naukri (needs RAPID_API_KEY)

Verification:
  - HEAD-pings every application_link; marks VERIFIED if response < 400.

Role-aware:
  - Search terms are derived from the candidate role so results are not QA-biased.
  - Uses multiple search terms per role for broader coverage.
"""
import logging
import re
import asyncio
from typing import Optional
import httpx

logger = logging.getLogger(__name__)

_TIMEOUT = 15.0
_VERIFY_TIMEOUT = 8.0

# ─── Role → search keywords ───────────────────────────────────────────────────
_ROLE_SEARCH_TERMS: dict[str, list[str]] = {
    "frontend":     ["frontend engineer", "react developer", "ui engineer"],
    "backend":      ["backend engineer", "python developer", "java developer"],
    "fullstack":    ["full stack engineer", "fullstack developer"],
    "mobile":       ["mobile engineer", "ios developer", "android developer", "flutter developer"],
    "data":         ["data engineer", "data scientist", "ml engineer", "machine learning engineer"],
    "devops":       ["devops engineer", "site reliability engineer", "platform engineer"],
    "cloud":        ["cloud engineer", "aws engineer", "azure engineer", "gcp engineer"],
    "qa":           ["qa automation engineer", "sdet", "test automation engineer"],
    "security":     ["security engineer", "appsec engineer", "devsecops"],
    "product":      ["product manager", "technical product manager"],
    "architect":    ["software architect", "principal engineer", "staff engineer"],
    "manager":      ["engineering manager", "tech lead"],
    "android":      ["android developer", "android engineer", "kotlin developer"],
    "ios":          ["ios developer", "swift developer", "ios engineer"],
    "flutter":      ["flutter developer", "dart developer"],
    "react":        ["react developer", "react engineer", "frontend react"],
    "ml":           ["machine learning engineer", "ml engineer", "ai engineer"],
    "sre":          ["site reliability engineer", "sre", "infrastructure engineer"],
    "embedded":     ["embedded engineer", "firmware engineer", "iot developer"],
    "blockchain":   ["blockchain developer", "web3 engineer", "smart contract developer"],
}
_DEFAULT_TERMS = ["software engineer"]


def _get_search_terms(role: str) -> list[str]:
    role_lower = role.lower()
    for key, terms in _ROLE_SEARCH_TERMS.items():
        if key in role_lower:
            return terms
    clean = re.sub(r"[^a-z0-9 ]", "", role_lower).strip()
    return [clean] if clean else _DEFAULT_TERMS


# ─── Tech extraction ──────────────────────────────────────────────────────────
_TECH_TOKENS = {
    "python", "java", "javascript", "typescript", "go", "golang", "rust", "kotlin",
    "swift", "c++", "c#", "scala", "ruby", "php", "elixir", "dart",
    "react", "next.js", "vue", "angular", "svelte", "tailwind",
    "node.js", "fastapi", "django", "flask", "spring boot", "express", "nest.js",
    "flutter", "react native", "swiftui", "jetpack compose",
    "tensorflow", "pytorch", "scikit-learn", "pandas", "spark", "kafka", "airflow",
    "dbt", "langchain", "llm", "rag", "machine learning", "deep learning",
    "selenium", "playwright", "cypress", "appium", "webdriverio",
    "pytest", "junit", "testng", "cucumber", "robot framework",
    "rest assured", "postman", "jmeter", "k6", "gatling",
    "docker", "kubernetes", "aws", "azure", "gcp", "terraform", "ansible",
    "jenkins", "github actions", "gitlab ci", "azure devops", "argocd",
    "postgresql", "mysql", "mongodb", "redis", "elasticsearch", "cassandra",
    "microservices", "graphql", "grpc", "rest api",
}


def _extract_technologies(text: str) -> list[str]:
    text_lower = text.lower()
    found = [tech.title() for tech in _TECH_TOKENS if tech in text_lower]
    return list(dict.fromkeys(found))[:12]


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
    s = salary_str.lower()
    if "£" in salary_str or "gbp" in s:
        currency = "GBP"
    elif "€" in salary_str or "eur" in s:
        currency = "EUR"
    elif "₹" in salary_str or "inr" in s or "lpa" in s:
        currency = "INR"
    clean = salary_str.replace(",", "")
    nums = [int(n) for n in re.findall(r"\d+", clean) if int(n) > 1000]
    if len(nums) >= 2:
        return nums[0], nums[1], currency
    if len(nums) == 1:
        return nums[0], int(nums[0] * 1.3), currency
    return None, None, currency


def _strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text or "")


# ─── URL verification ─────────────────────────────────────────────────────────
async def _verify_url(url: str) -> str:
    if not url or not url.startswith("http"):
        return "UNVERIFIED"
    try:
        async with httpx.AsyncClient(timeout=_VERIFY_TIMEOUT, follow_redirects=True) as c:
            r = await c.head(url, headers={"User-Agent": "Mozilla/5.0"})
            return "VERIFIED" if r.status_code < 400 else "UNVERIFIED"
    except Exception:
        return "UNVERIFIED"


async def _verify_batch(jobs: list[dict]) -> list[dict]:
    urls = [j.get("application_link", "") for j in jobs[:30]]
    statuses = await asyncio.gather(*[_verify_url(u) for u in urls])
    for i, s in enumerate(statuses):
        jobs[i]["verification_status"] = s
    return jobs


# ─── Portal fetchers ──────────────────────────────────────────────────────────

async def _fetch_remotive(query: str) -> list[dict]:
    cat_map = {
        "frontend": "software-dev", "backend": "software-dev", "fullstack": "software-dev",
        "data": "data", "devops": "devops-sysadmin", "qa": "qa", "product": "product",
    }
    cat = next((v for k, v in cat_map.items() if k in query.lower()), "software-dev")
    jobs: list[dict] = []
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
            r = await c.get("https://remotive.com/api/remote-jobs", params={"category": cat, "limit": 25})
            r.raise_for_status()
            for item in r.json().get("jobs", []):
                desc = _strip_html(item.get("description", ""))
                sal_min, sal_max, currency = _parse_salary(item.get("salary"))
                jobs.append({
                    "title": item.get("title", ""),
                    "organization": item.get("company_name", ""),
                    "location": item.get("candidate_required_location") or "Remote",
                    "work_mode": "Remote",
                    "salary_min": sal_min, "salary_max": sal_max, "currency": currency,
                    "description": desc[:2000],
                    "technologies": _extract_technologies(desc + " " + " ".join(item.get("tags") or [])),
                    "application_link": item.get("url", ""),
                    "career_page_link": item.get("url", ""),
                    "posted_date": (item.get("publication_date") or "")[:10],
                    "verification_status": "UNVERIFIED",
                    "source": "Remotive",
                    "experience_required": 0,
                })
    except Exception as e:
        logger.warning(f"Remotive: {e}")
    return jobs


async def _fetch_arbeitnow(query: str) -> list[dict]:
    jobs: list[dict] = []
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
            r = await c.get(
                "https://www.arbeitnow.com/api/job-board-api",
                params={"search": query, "remote": "true"},
            )
            r.raise_for_status()
            for item in r.json().get("data", []):
                desc = _strip_html(item.get("description", ""))
                jobs.append({
                    "title": item.get("title", ""),
                    "organization": item.get("company_name", ""),
                    "location": item.get("location", "Remote"),
                    "work_mode": _detect_work_mode((item.get("location") or "") + " " + desc),
                    "salary_min": None, "salary_max": None, "currency": "EUR",
                    "description": desc[:2000],
                    "technologies": _extract_technologies(desc),
                    "application_link": item.get("url", ""),
                    "career_page_link": item.get("url", ""),
                    "posted_date": (item.get("created_at") or "")[:10],
                    "verification_status": "UNVERIFIED",
                    "source": "Arbeitnow",
                    "experience_required": 0,
                })
    except Exception as e:
        logger.warning(f"Arbeitnow: {e}")
    return jobs


async def _fetch_the_muse(query: str) -> list[dict]:
    jobs: list[dict] = []
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
            r = await c.get(
                "https://www.themuse.com/api/public/jobs",
                params={"category": "Engineering", "level": "Mid Level", "page": 0, "descending": "true"},
            )
            r.raise_for_status()
            q_words = [w for w in query.lower().split() if len(w) > 2]
            for item in r.json().get("results", []):
                title = item.get("name", "")
                contents = _strip_html(item.get("contents", ""))
                combined = (title + " " + contents).lower()
                if q_words and not any(w in combined for w in q_words):
                    continue
                loc_list = item.get("locations") or [{}]
                location_str = loc_list[0].get("name", "USA") if loc_list else "USA"
                company = (item.get("company") or {}).get("name", "")
                app_link = (item.get("refs") or {}).get("landing_page", "")
                jobs.append({
                    "title": title,
                    "organization": company,
                    "location": location_str,
                    "work_mode": _detect_work_mode(location_str + " " + contents),
                    "salary_min": None, "salary_max": None, "currency": "USD",
                    "description": contents[:2000],
                    "technologies": _extract_technologies(contents),
                    "application_link": app_link,
                    "career_page_link": app_link,
                    "posted_date": (item.get("publication_date") or "")[:10],
                    "verification_status": "UNVERIFIED",
                    "source": "TheMuse",
                    "experience_required": 0,
                })
    except Exception as e:
        logger.warning(f"TheMuse: {e}")
    return jobs


async def _fetch_remoteok(query: str) -> list[dict]:
    jobs: list[dict] = []
    try:
        async with httpx.AsyncClient(
            timeout=_TIMEOUT,
            headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"},
        ) as c:
            r = await c.get("https://remoteok.com/api")
            r.raise_for_status()
            data = r.json()
            q_words = [w for w in query.lower().split() if len(w) > 2]
            for item in data:
                if not isinstance(item, dict) or not item.get("position"):
                    continue
                title = item.get("position", "")
                desc = _strip_html(item.get("description", ""))
                tags = item.get("tags") or []
                combined = (title + " " + desc + " " + " ".join(tags)).lower()
                if q_words and not any(w in combined for w in q_words):
                    continue
                jobs.append({
                    "title": title,
                    "organization": item.get("company", ""),
                    "location": "Remote",
                    "work_mode": "Remote",
                    "salary_min": None, "salary_max": None, "currency": "USD",
                    "description": desc[:2000],
                    "technologies": _extract_technologies(desc + " " + " ".join(tags)),
                    "application_link": item.get("apply_url") or item.get("url", ""),
                    "career_page_link": item.get("url", ""),
                    "posted_date": (item.get("date") or "")[:10],
                    "verification_status": "UNVERIFIED",
                    "source": "RemoteOK",
                    "experience_required": 0,
                })
            jobs = jobs[:25]
    except Exception as e:
        logger.warning(f"RemoteOK: {e}")
    return jobs


async def _fetch_jobicy(query: str) -> list[dict]:
    jobs: list[dict] = []
    industry_map = {
        "frontend": "design-ux", "backend": "engineering", "fullstack": "engineering",
        "data": "data-science", "devops": "engineering", "cloud": "engineering",
        "qa": "engineering", "mobile": "engineering", "ml": "data-science",
        "sre": "engineering", "security": "engineering",
    }
    industry = next((v for k, v in industry_map.items() if k in query.lower()), "engineering")
    tag = query.split()[0] if query else "software"
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
            r = await c.get(
                "https://jobicy.com/api/v2/remote-jobs",
                params={"count": 25, "geo": "worldwide", "industry": industry, "tag": tag},
            )
            r.raise_for_status()
            for item in r.json().get("jobs", []):
                desc = _strip_html(item.get("jobDescription", ""))
                industries = item.get("jobIndustry") or []
                if isinstance(industries, str):
                    industries = [industries]
                jobs.append({
                    "title": item.get("jobTitle", ""),
                    "organization": item.get("companyName", ""),
                    "location": item.get("jobGeo") or "Remote",
                    "work_mode": "Remote",
                    "salary_min": None, "salary_max": None, "currency": "USD",
                    "description": desc[:2000],
                    "technologies": _extract_technologies(desc + " " + " ".join(industries)),
                    "application_link": item.get("url", ""),
                    "career_page_link": item.get("url", ""),
                    "posted_date": (item.get("pubDate") or "")[:10],
                    "verification_status": "UNVERIFIED",
                    "source": "Jobicy",
                    "experience_required": 0,
                })
    except Exception as e:
        logger.warning(f"Jobicy: {e}")
    return jobs


async def _fetch_adzuna(query: str, location: str, app_id: str, app_key: str) -> list[dict]:
    if not app_id or not app_key:
        return []
    loc_lower = location.lower()
    if any(x in loc_lower for x in ("india", "bangalore", "mumbai", "hyderabad", "pune", "chennai", "delhi", "noida", "gurgaon")):
        country = "in"
    elif any(x in loc_lower for x in ("uk", "london", "britain", "manchester", "birmingham")):
        country = "gb"
    elif any(x in loc_lower for x in ("australia", "sydney", "melbourne")):
        country = "au"
    elif any(x in loc_lower for x in ("canada", "toronto", "vancouver")):
        country = "ca"
    elif any(x in loc_lower for x in ("germany", "berlin", "munich")):
        country = "de"
    elif any(x in loc_lower for x in ("singapore",)):
        country = "sg"
    else:
        country = "us"

    currency_map = {"in": "INR", "gb": "GBP", "au": "AUD", "ca": "CAD", "de": "EUR", "sg": "SGD", "us": "USD"}
    jobs: list[dict] = []
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
            r = await c.get(
                f"https://api.adzuna.com/v1/api/jobs/{country}/search/1",
                params={
                    "app_id": app_id, "app_key": app_key,
                    "results_per_page": 20,
                    "what": query,
                    "where": "" if "remote" in loc_lower else location,
                    "content-type": "application/json",
                    "sort_by": "relevance",
                },
            )
            r.raise_for_status()
            currency = currency_map.get(country, "USD")
            for item in r.json().get("results", []):
                desc = item.get("description", "")
                sal_min = item.get("salary_min")
                sal_max = item.get("salary_max")
                app_link = item.get("redirect_url", "")
                jobs.append({
                    "title": item.get("title", ""),
                    "organization": (item.get("company") or {}).get("display_name", ""),
                    "location": (item.get("location") or {}).get("display_name", location),
                    "work_mode": _detect_work_mode(desc + " " + item.get("title", "")),
                    "salary_min": int(sal_min) if sal_min else None,
                    "salary_max": int(sal_max) if sal_max else None,
                    "currency": currency,
                    "description": desc[:2000],
                    "technologies": _extract_technologies(desc),
                    "application_link": app_link,
                    "career_page_link": app_link,
                    "posted_date": (item.get("created") or "")[:10],
                    "verification_status": "UNVERIFIED",
                    "source": "Adzuna",
                    "experience_required": 0,
                })
    except Exception as e:
        logger.warning(f"Adzuna ({country}): {e}")
    return jobs


async def _fetch_jsearch(query: str, location: str, rapid_key: str) -> list[dict]:
    """
    JSearch via RapidAPI — pulls from LinkedIn, Indeed, Glassdoor, Naukri.
    Free tier: 200 req/month at rapidapi.com (search 'jsearch').
    """
    if not rapid_key:
        return []
    jobs: list[dict] = []
    portal_map = {
        "linkedin.com": "LinkedIn", "indeed.com": "Indeed",
        "glassdoor.com": "Glassdoor", "naukri.com": "Naukri",
    }
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
            r = await c.get(
                "https://jsearch.p.rapidapi.com/search",
                params={"query": f"{query} {location}".strip(), "num_pages": "2", "date_posted": "week"},
                headers={"X-RapidAPI-Key": rapid_key, "X-RapidAPI-Host": "jsearch.p.rapidapi.com"},
            )
            r.raise_for_status()
            for item in r.json().get("data", []):
                desc = item.get("job_description", "")
                link = item.get("job_apply_link", "")
                source = next((v for k, v in portal_map.items() if k in link.lower()), "Other")
                sal_min = item.get("job_min_salary")
                sal_max = item.get("job_max_salary")
                currency = item.get("job_salary_currency") or "USD"
                city = item.get("job_city", "")
                country = item.get("job_country", "")
                jobs.append({
                    "title": item.get("job_title", ""),
                    "organization": item.get("employer_name", ""),
                    "location": f"{city}, {country}".strip(", ") or location,
                    "work_mode": "Remote" if item.get("job_is_remote") else _detect_work_mode(desc),
                    "salary_min": int(sal_min) if sal_min else None,
                    "salary_max": int(sal_max) if sal_max else None,
                    "currency": currency,
                    "description": desc[:2000],
                    "technologies": _extract_technologies(desc),
                    "application_link": link,
                    "career_page_link": link,
                    "posted_date": (item.get("job_posted_at_datetime_utc") or "")[:10],
                    "verification_status": "UNVERIFIED",
                    "source": source,
                    "experience_required": 0,
                })
    except Exception as e:
        logger.warning(f"JSearch: {e}")
    return jobs


# ─── Scoring & dedup ──────────────────────────────────────────────────────────
def _compute_match_score(job: dict, profile_skills: set[str], exp_years: int) -> int:
    techs = [t.lower() for t in (job.get("technologies") or [])]
    if not techs:
        return 50
    overlap = sum(1 for t in techs if t in profile_skills)
    score = int((overlap / len(techs)) * 100)
    exp_req = job.get("experience_required") or 0
    if exp_years and exp_req:
        if exp_years >= exp_req:
            score = min(99, score + 10)
        elif exp_years < exp_req - 2:
            score = max(5, score - 15)
    return score


def _deduplicate(jobs: list[dict]) -> list[dict]:
    seen: set[tuple] = set()
    out = []
    for j in jobs:
        key = (j.get("title", "").lower()[:40], j.get("organization", "").lower()[:30])
        if key not in seen:
            seen.add(key)
            out.append(j)
    return out


# ─── Public service ───────────────────────────────────────────────────────────
class JobDiscoveryService:
    def __init__(
        self,
        adzuna_app_id: str = "",
        adzuna_app_key: str = "",
        jsearch_api_key: str = "",
    ):
        self.adzuna_app_id = adzuna_app_id
        self.adzuna_app_key = adzuna_app_key
        self.jsearch_api_key = jsearch_api_key

    async def discover_jobs(
        self,
        role: str = "",
        location: str = "Remote",
        profile_skills: Optional[list[str]] = None,
        exp_years: int = 0,
        min_match_score: int = 0,
        run_verification: bool = True,
    ) -> list[dict]:
        """
        Fetch jobs from all configured portals, deduplicate, score, verify.
        Returns jobs sorted: verified first, then by match score.

        Args:
            role             — candidate role / keyword
            location         — preferred location for Adzuna/JSearch
            profile_skills   — flat list of candidate's skills (for match scoring)
            exp_years        — years of experience
            min_match_score  — 0 = all; 60 = only 60%+ matches (strict mode)
            run_verification — HEAD-ping each URL to verify it's still active
        """
        search_terms = _get_search_terms(role) if role else _DEFAULT_TERMS
        # Use up to 3 search terms for broader coverage
        terms_to_use = search_terms[:3]
        primary = terms_to_use[0]
        secondary = terms_to_use[1] if len(terms_to_use) > 1 else primary
        logger.info(f"Discovering '{primary}' (+ {len(terms_to_use)-1} variants) in '{location}'")

        # Fan out across all portals with multiple search terms
        results = await asyncio.gather(
            _fetch_remotive(primary),
            _fetch_arbeitnow(primary),
            _fetch_arbeitnow(secondary),
            _fetch_the_muse(primary),
            _fetch_remoteok(primary),
            _fetch_remoteok(secondary),
            _fetch_jobicy(primary),
            _fetch_adzuna(primary, location, self.adzuna_app_id, self.adzuna_app_key),
            _fetch_jsearch(primary, location, self.jsearch_api_key),
            _fetch_jsearch(secondary, location, self.jsearch_api_key),
            return_exceptions=True,
        )

        all_jobs: list[dict] = []
        for r in results:
            if isinstance(r, list):
                all_jobs.extend(r)

        all_jobs = _deduplicate(all_jobs)
        logger.info(f"After dedup: {len(all_jobs)} jobs")

        if run_verification and all_jobs:
            all_jobs = await _verify_batch(all_jobs)

        p_skills = {s.lower() for s in (profile_skills or [])}
        for job in all_jobs:
            job["match_score"] = _compute_match_score(job, p_skills, exp_years)

        if min_match_score > 0:
            all_jobs = [j for j in all_jobs if j.get("match_score", 0) >= min_match_score]

        all_jobs.sort(key=lambda j: (
            0 if j.get("verification_status") == "VERIFIED" else 1,
            -(j.get("match_score") or 0),
        ))

        logger.info(f"Returning {len(all_jobs)} jobs")
        return all_jobs

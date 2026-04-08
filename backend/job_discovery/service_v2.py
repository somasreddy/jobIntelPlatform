"""
Job Discovery Service V2 - Clean Load - Fixed Arbeitnow and New Freelance Source
"""
import logging
import re
import asyncio
import os
import sys
from typing import Optional
import httpx

logger = logging.getLogger(__name__)
print("--- [DEBUG] JobDiscoveryService V2 Module Loaded from:", __file__)

_TIMEOUT = 15.0
_VERIFY_TIMEOUT = 8.0

# --- Role -> search keywords ---------------------------------------------------
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
    "design":       ["ui ux designer", "product designer", "visual designer", "creative director"],
    "creative":     ["graphic designer", "art director", "behance", "dribbble"],
    "marketing":    ["digital marketing manager", "content strategist", "seo specialist"],
    "writer":       ["technical writer", "content writer", "journalist", "copywriter"],
    "freelance":    ["freelance developer", "contract engineer", "independent consultant"],
    "gig":          ["project based work", "freelance gig", "upwork", "fiverr"],
    "nonprofit":    ["nonprofit manager", "social impact", "program coordinator"],
}
_DEFAULT_TERMS = ["software engineer"]

def _get_search_terms(role: str) -> list[str]:
    role_lower = role.lower()
    for key, terms in _ROLE_SEARCH_TERMS.items():
        if key in role_lower:
            return terms
    clean = re.sub(r"[^a-z0-9 ]", "", role_lower).strip()
    return [clean] if clean else _DEFAULT_TERMS

# --- Tech extraction ----------------------------------------------------------
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
    if "remote" in t: return "Remote"
    if "hybrid" in t: return "Hybrid"
    return "On-site"

def _parse_salary(salary_str: Optional[str]) -> tuple:
    if not salary_str: return None, None, "USD"
    currency = "USD"
    s = salary_str.lower()
    if "£" in salary_str or "gbp" in s: currency = "GBP"
    elif "€" in salary_str or "eur" in s: currency = "EUR"
    elif "₹" in salary_str or "inr" in s or "lpa" in s: currency = "INR"
    clean = salary_str.replace(",", "")
    nums = [int(n) for n in re.findall(r"\d+", clean) if int(n) > 1000]
    if len(nums) >= 2: return nums[0], nums[1], currency
    if len(nums) == 1: return nums[0], int(nums[0] * 1.3), currency
    return None, None, currency

def _strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text or "")

async def _verify_url(url: str) -> str:
    if not url or not url.startswith("http"): return "UNVERIFIED"
    try:
        async with httpx.AsyncClient(timeout=_VERIFY_TIMEOUT, follow_redirects=True) as c:
            r = await c.head(url, headers={"User-Agent": "Mozilla/5.0"})
            return "VERIFIED" if r.status_code < 400 else "UNVERIFIED"
    except Exception: return "UNVERIFIED"

async def _fetch_authentic_jobs(query: str) -> list[dict]:
    """Authentic Jobs RSS Fetcher - good for freelance/contract."""
    jobs: list[dict] = []
    try:
        from bs4 import BeautifulSoup
        # RSS feed for all jobs, filtered by keyword
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        async with httpx.AsyncClient(timeout=_TIMEOUT, headers=headers) as c:
            r = await c.get("https://authenticjobs.com/feed/")
            r.raise_for_status()
            soup = BeautifulSoup(r.text, "xml")
            q_words = [w for w in query.lower().split() if len(w) > 2]
            for item in soup.find_all("item"):
                title = item.find("title").text if item.find("title") else ""
                desc = _strip_html(item.find("description").text if item.find("description") else "")
                if q_words and not any(w in (title + " " + desc).lower() for w in q_words): continue
                jobs.append({
                    "title": title, "organization": "Authentic Jobs", "location": "Remote / Contract", "work_mode": "Remote",
                    "salary_min": None, "salary_max": None, "currency": "USD",
                    "description": desc[:2000], "technologies": _extract_technologies(desc),
                    "application_link": item.find("link").text if item.find("link") else "",
                    "posted_date": (item.find("pubDate").text if item.find("pubDate") else "")[:16],
                    "verification_status": "UNVERIFIED", "source": "AuthenticJobs",
                })
    except Exception as e: logger.warning(f"AuthenticJobs: {e}")
    return jobs

async def _verify_batch(jobs: list[dict]) -> list[dict]:
    urls = [j.get("application_link", "") for j in jobs[:30]]
    statuses = await asyncio.gather(*[_verify_url(u) for u in urls])
    for i, s in enumerate(statuses): jobs[i]["verification_status"] = s
    return jobs

# --- Portal fetchers ----------------------------------------------------------

async def _fetch_remotive(query: str) -> list[dict]:
    cat_map = {"frontend": "software-dev", "backend": "software-dev", "fullstack": "software-dev"}
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
                    "description": desc[:2000], "technologies": _extract_technologies(desc),
                    "application_link": item.get("url", ""), "posted_date": (item.get("publication_date") or "")[:10],
                    "verification_status": "UNVERIFIED", "source": "Remotive",
                })
    except Exception as e: logger.warning(f"Remotive: {e}")
    return jobs

async def _fetch_arbeitnow(query: str) -> list[dict]:
    jobs: list[dict] = []
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
            r = await c.get("https://www.arbeitnow.com/api/job-board-api", params={"search": query, "remote": "true"})
            r.raise_for_status()
            resp_json = r.json()
            if not isinstance(resp_json, dict): return []
            data = resp_json.get("data", [])
            if not isinstance(data, list): return []
            for item in data:
                if not isinstance(item, dict): continue
                desc = _strip_html(item.get("description", ""))
                jobs.append({
                    "title": item.get("title", ""), "organization": item.get("company_name", ""),
                    "location": item.get("location", "Remote"), "work_mode": "Remote",
                    "salary_min": None, "salary_max": None, "currency": "EUR",
                    "description": desc[:2000], "technologies": _extract_technologies(desc),
                    "application_link": item.get("url", ""), 
                    "posted_date": str(item.get("created_at") or "")[:10],
                    "verification_status": "UNVERIFIED", "source": "Arbeitnow",
                })
    except Exception as e: logger.warning(f"Arbeitnow Fixed Catch: {e}")
    return jobs

async def _fetch_weworkremotely(query: str) -> list[dict]:
    jobs: list[dict] = []
    try:
        from bs4 import BeautifulSoup
        async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
            r = await c.get("https://weworkremotely.com/remote-jobs.rss")
            r.raise_for_status()
            soup = BeautifulSoup(r.text, "xml")
            q_words = [w for w in query.lower().split() if len(w) > 2]
            for item in soup.find_all("item"):
                title = item.find("title").text if item.find("title") else ""
                desc = _strip_html(item.find("description").text if item.find("description") else "")
                if q_words and not any(w in (title + " " + desc).lower() for w in q_words): continue
                jobs.append({
                    "title": title, "organization": "WWR", "location": "Remote", "work_mode": "Remote",
                    "salary_min": None, "salary_max": None, "currency": "USD",
                    "description": desc[:2000], "technologies": _extract_technologies(desc),
                    "application_link": item.find("link").text if item.find("link") else "",
                    "posted_date": (item.find("pubDate").text if item.find("pubDate") else "")[:16],
                    "verification_status": "UNVERIFIED", "source": "WeWorkRemotely",
                })
    except Exception as e: logger.warning(f"WWR: {e}")
    return jobs

async def _fetch_hn_hiring(query: str) -> list[dict]:
    jobs: list[dict] = []
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
            r_thread = await c.get("https://hn.algolia.com/api/v1/search", params={"query": "Who is hiring", "tags": "story", "hitsPerPage": 1})
            hits = r_thread.json().get("hits", [])
            if hits:
                thread_id = hits[0].get("objectID")
                r_jobs = await c.get("https://hn.algolia.com/api/v1/search", params={"tags": f"comment,story_{thread_id}", "query": query, "hitsPerPage": 20})
                for item in r_jobs.json().get("hits", []):
                    c_text = _strip_html(item.get("comment_text", ""))
                    jobs.append({
                        "title": c_text.split("\n")[0][:100], "organization": "HN Startup", "location": "Remote", "work_mode": "Remote",
                        "salary_min": None, "salary_max": None, "currency": "USD",
                        "description": c_text[:2000], "technologies": _extract_technologies(c_text),
                        "application_link": f"https://news.ycombinator.com/item?id={item.get('objectID')}",
                        "posted_date": (item.get("created_at") or "")[:10],
                        "verification_status": "UNVERIFIED", "source": "HackerNews",
                    })
    except Exception as e: logger.warning(f"HN: {e}")
    return jobs

async def _fetch_adzuna(query: str, location: str, app_id: str, app_key: str) -> list[dict]:
    if not app_id or not app_key: return []
    jobs: list[dict] = []
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
            r = await c.get(f"https://api.adzuna.com/v1/api/jobs/us/search/1", params={"app_id": app_id, "app_key": app_key, "results_per_page": 20, "what": query})
            for item in r.json().get("results", []):
                desc = item.get("description", "")
                jobs.append({
                    "title": item.get("title", ""), "organization": (item.get("company") or {}).get("display_name", ""),
                    "location": (item.get("location") or {}).get("display_name", "Remote"), "work_mode": "Remote",
                    "salary_min": item.get("salary_min"), "salary_max": item.get("salary_max"), "currency": "USD",
                    "description": desc[:2000], "technologies": _extract_technologies(desc),
                    "application_link": item.get("redirect_url", ""), "posted_date": (item.get("created") or "")[:10],
                    "verification_status": "UNVERIFIED", "source": "Adzuna",
                })
    except Exception as e: logger.warning(f"Adzuna: {e}")
    return jobs

# --- Public service -----------------------------------------------------------
class JobDiscoveryService:
    def __init__(self, adzuna_app_id: str = "", adzuna_app_key: str = "", jsearch_api_key: str = ""):
        self.adzuna_app_id = adzuna_app_id
        self.adzuna_app_key = adzuna_app_key
        self.jsearch_api_key = jsearch_api_key

    async def discover_jobs(self, role: str = "", location: str = "Remote", profile_skills: Optional[list[str]] = None, exp_years: int = 0, min_match_score: int = 0, run_verification: bool = True) -> list[dict]:
        from job_discovery.connectors_v3 import _fetch_greenhouse, _fetch_lever, _fetch_wellfound
        search_terms = _get_search_terms(role) if role else _DEFAULT_TERMS
        primary = search_terms[0]
        results = await asyncio.gather(
            _fetch_remotive(primary),
            _fetch_arbeitnow(primary),
            _fetch_weworkremotely(primary),
            _fetch_hn_hiring(primary),
            _fetch_adzuna(primary, location, self.adzuna_app_id, self.adzuna_app_key),
            _fetch_authentic_jobs(primary),
            _fetch_greenhouse(primary),
            _fetch_lever(primary),
            _fetch_wellfound(primary),
            return_exceptions=True
        )
        all_jobs = []
        for r in results:
            if isinstance(r, list): all_jobs.extend(r)
        
        seen = set()
        final = []
        for j in all_jobs:
            key = (j.get("title", "").lower()[:40], j.get("organization", "").lower()[:30])
            if key not in seen:
                seen.add(key)
                final.append(j)
        
        if run_verification and final: final = await _verify_batch(final)
        return final

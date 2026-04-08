"""
Job Discovery Connectors V3
Adds Greenhouse, Lever, and Wellfound (via public APIs / scraping).

All fetchers follow the same contract as service_v2.py fetchers:
  async def _fetch_X(query: str) -> list[dict]
Each dict has: title, organization, location, work_mode, salary_min,
salary_max, currency, description, technologies, application_link,
posted_date, verification_status, source.
"""
import logging
import re
import httpx

logger = logging.getLogger(__name__)
_TIMEOUT = 12.0


# ── Shared helpers (mirror from service_v2) ───────────────────────────────────

_TECH_TOKENS = {
    "python", "java", "javascript", "typescript", "go", "golang", "rust", "kotlin",
    "swift", "react", "next.js", "vue", "angular", "node.js", "fastapi", "django",
    "flask", "spring boot", "flutter", "react native", "tensorflow", "pytorch",
    "docker", "kubernetes", "aws", "azure", "gcp", "terraform",
    "postgresql", "mysql", "mongodb", "redis", "elasticsearch",
    "graphql", "grpc", "rest api", "microservices",
}

def _extract_technologies(text: str) -> list[str]:
    text_lower = text.lower()
    return list(dict.fromkeys(
        tech.title() for tech in _TECH_TOKENS if tech in text_lower
    ))[:12]

def _strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", " ", text or "").strip()

def _detect_work_mode(text: str) -> str:
    t = text.lower()
    if "remote" in t: return "Remote"
    if "hybrid" in t: return "Hybrid"
    return "On-site"


# ── Greenhouse connector ──────────────────────────────────────────────────────

# Greenhouse exposes a public job board API for each company.
# Without company slugs we can't enumerate all boards, so we target
# well-known tech companies that use Greenhouse.
_GREENHOUSE_COMPANIES = [
    "airbnb", "stripe", "notion", "linear", "figma", "vercel", "netlify",
    "hashicorp", "mongodb", "elastic", "grafana", "databricks", "snowflake",
    "cockroachlabs", "planetscale", "supabase", "posthog", "segment",
]

async def _fetch_greenhouse(query: str) -> list[dict]:
    """
    Fetches jobs from Greenhouse job boards for popular tech companies.
    API: GET https://boards-api.greenhouse.io/v1/boards/{company}/jobs
    """
    jobs: list[dict] = []
    q_words = [w.lower() for w in query.split() if len(w) > 2]

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        for company in _GREENHOUSE_COMPANIES:
            try:
                resp = await client.get(
                    f"https://boards-api.greenhouse.io/v1/boards/{company}/jobs",
                    params={"content": "true"},
                    headers={"User-Agent": "JobIntelBot/1.0"},
                )
                if not resp.ok:
                    continue
                data = resp.json()
                for job in data.get("jobs", [])[:20]:
                    title = job.get("title", "")
                    # Filter by query relevance
                    if q_words and not any(w in title.lower() for w in q_words):
                        continue
                    content = _strip_html(job.get("content", ""))
                    location = job.get("location", {}).get("name", "Remote") or "Remote"
                    apply_url = job.get("absolute_url", "")
                    jobs.append({
                        "title": title,
                        "organization": company.replace("-", " ").title(),
                        "location": location,
                        "work_mode": _detect_work_mode(location + " " + content),
                        "salary_min": None,
                        "salary_max": None,
                        "currency": "USD",
                        "description": content[:2000],
                        "technologies": _extract_technologies(title + " " + content),
                        "application_link": apply_url,
                        "posted_date": (job.get("updated_at", "") or "")[:10],
                        "verification_status": "VERIFIED",  # Greenhouse is always live
                        "source": "Greenhouse",
                    })
            except Exception as exc:
                logger.debug(f"Greenhouse/{company}: {exc}")

    logger.info(f"Greenhouse: fetched {len(jobs)} jobs for '{query}'")
    return jobs


# ── Lever connector ───────────────────────────────────────────────────────────

_LEVER_COMPANIES = [
    "netflix", "shopify", "hubspot", "intercom", "atlassian", "cloudflare",
    "okta", "pagerduty", "sendbird", "brex", "plaid", "robinhood",
    "reddit", "discord", "twitch", "airtable", "miro", "loom", "lattice",
]

async def _fetch_lever(query: str) -> list[dict]:
    """
    Fetches jobs from Lever postings API.
    API: GET https://api.lever.co/v0/postings/{company}?mode=json
    """
    jobs: list[dict] = []
    q_words = [w.lower() for w in query.split() if len(w) > 2]

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        for company in _LEVER_COMPANIES:
            try:
                resp = await client.get(
                    f"https://api.lever.co/v0/postings/{company}",
                    params={"mode": "json"},
                    headers={"User-Agent": "JobIntelBot/1.0"},
                )
                if not resp.ok:
                    continue
                postings = resp.json()
                for posting in postings[:20]:
                    title = posting.get("text", "")
                    if q_words and not any(w in title.lower() for w in q_words):
                        continue
                    desc_parts = posting.get("description", "") or ""
                    lists = posting.get("lists", []) or []
                    full_desc = _strip_html(desc_parts) + " ".join(
                        _strip_html(lst.get("content", "")) for lst in lists
                    )
                    categories = posting.get("categories", {})
                    location = categories.get("location", "Remote") or "Remote"
                    apply_url = posting.get("applyUrl", posting.get("hostedUrl", ""))
                    jobs.append({
                        "title": title,
                        "organization": company.replace("-", " ").title(),
                        "location": location,
                        "work_mode": _detect_work_mode(location + " " + full_desc),
                        "salary_min": None,
                        "salary_max": None,
                        "currency": "USD",
                        "description": full_desc[:2000],
                        "technologies": _extract_technologies(title + " " + full_desc),
                        "application_link": apply_url,
                        "posted_date": "",
                        "verification_status": "VERIFIED",  # Lever is always live
                        "source": "Lever",
                    })
            except Exception as exc:
                logger.debug(f"Lever/{company}: {exc}")

    logger.info(f"Lever: fetched {len(jobs)} jobs for '{query}'")
    return jobs


# ── Wellfound (AngelList Talent) connector ────────────────────────────────────

async def _fetch_wellfound(query: str) -> list[dict]:
    """
    Wellfound (formerly AngelList) — uses their public GraphQL search endpoint.
    Falls back to empty list gracefully if the API changes.
    """
    jobs: list[dict] = []
    try:
        # Wellfound public search (no auth required for basic job listing)
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(
                "https://wellfound.com/graphql",
                json={
                    "operationName": "JobSearchResults",
                    "variables": {"query": query, "page": 1},
                    "query": """
                      query JobSearchResults($query: String!, $page: Int) {
                        jobListings(query: $query, page: $page) {
                          startups {
                            highConcept
                            name
                            jobListings {
                              title
                              description
                              remote
                              locationNames
                              compensation
                              applyUrl
                            }
                          }
                        }
                      }
                    """,
                },
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0",
                    "Accept": "application/json",
                },
            )
            if resp.ok:
                data = resp.json()
                startups = (
                    data.get("data", {})
                    .get("jobListings", {})
                    .get("startups", [])
                )
                for startup in startups[:10]:
                    company = startup.get("name", "Startup")
                    for listing in startup.get("jobListings", [])[:3]:
                        title = listing.get("title", "")
                        if not title:
                            continue
                        desc = _strip_html(listing.get("description", ""))
                        location = ", ".join(listing.get("locationNames") or ["Remote"])
                        is_remote = listing.get("remote", False)
                        compensation = listing.get("compensation", "")
                        # Parse compensation into salary_min/max
                        sal_min, sal_max = None, None
                        comp_nums = [int(n) for n in re.findall(r"\d{4,}", compensation.replace(",", "")) if int(n) > 1000]
                        if len(comp_nums) >= 2:
                            sal_min, sal_max = comp_nums[0], comp_nums[1]
                        elif len(comp_nums) == 1:
                            sal_min = comp_nums[0]
                        jobs.append({
                            "title": title,
                            "organization": company,
                            "location": location,
                            "work_mode": "Remote" if is_remote else _detect_work_mode(location),
                            "salary_min": sal_min,
                            "salary_max": sal_max,
                            "currency": "USD",
                            "description": desc[:2000],
                            "technologies": _extract_technologies(title + " " + desc),
                            "application_link": listing.get("applyUrl", ""),
                            "posted_date": "",
                            "verification_status": "UNVERIFIED",
                            "source": "Wellfound",
                        })
    except Exception as exc:
        logger.debug(f"Wellfound: {exc}")

    logger.info(f"Wellfound: fetched {len(jobs)} jobs for '{query}'")
    return jobs

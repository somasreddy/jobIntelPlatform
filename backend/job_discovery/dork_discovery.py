
"""No-key dork based job discovery.

Builds Google-style dork queries from a user profile and searches public web
results without Apify, LinkedIn, or LLM API keys. The queries intentionally use
portable operators (site:, intitle:, inurl:, quoted phrases, OR, NOT) so they can
be opened in Google manually or executed through no-key HTML search endpoints.
"""
from __future__ import annotations

import asyncio
import html
import logging
import re
from dataclasses import dataclass
from html.parser import HTMLParser
from typing import Iterable
from urllib.parse import parse_qs, quote_plus, unquote, urlparse

import httpx

logger = logging.getLogger(__name__)

_SEARCH_TIMEOUT = 14.0
_PAGE_TIMEOUT = 10.0
_MAX_QUERIES = 4
_MAX_RESULTS_PER_QUERY = 12
_MAX_PAGES_TO_ENRICH = 28

ATS_SITES = [
    "site:myworkdayjobs.com", "site:greenhouse.io", "site:boards.greenhouse.io",
    "site:job-boards.greenhouse.io", "site:icims.com", "site:taleo.net",
    "site:lever.co", "site:jobs.lever.co", "site:smartrecruiters.com",
    "site:jobvite.com", "site:workforcenow.adp.com", "site:successfactors.com",
    "site:brassring.com", "site:jazzhr.com", "site:breezy.hr", "site:jobdiva.com",
    "site:bullhorn.com", "site:bamboohr.com", "site:linkedin.com/jobs",
]

JOB_BOARD_SITES = [
    "site:naukri.com", "site:timesjobs.com", "site:indeed.co.in", "site:linkedin.com/jobs",
    "site:monsterindia.com", "site:shine.com", "site:foundit.in", "site:cutshort.io",
    "site:hirist.com", "site:iimjobs.com", "site:apna.co", "site:instahyre.com",
    "site:indeed.com", "site:monster.com", "site:glassdoor.com", "site:ziprecruiter.com",
    "site:careerbuilder.com", "site:simplyhired.com", "site:weworkremotely.com",
    "site:wellfound.com", "site:indeed.ca", "site:jobbank.gc.ca", "site:workopolis.com",
    "site:indeed.co.uk", "site:reed.co.uk", "site:cv-library.co.uk", "site:totaljobs.com",
    "site:indeed.de", "site:stepstone.de", "site:jobs.de", "site:xing.com",
    "site:indeed.fr", "site:monster.fr", "site:indeed.es", "site:infojobs.net",
    "site:indeed.com.au", "site:seek.com.au", "site:seek.co.nz", "site:jobstreet.com",
    "site:kalibrr.com", "site:rozee.pk", "site:indeed.com.mx", "site:indeed.com.br",
    "site:computrabajo.com",
]

IRELAND_SITES = [
    "site:jobsireland.ie", "site:irishjobs.ie", "site:jobs.ie", "site:recruitireland.com",
    "site:publicjobs.ie", "site:ie.indeed.com", "site:ie.linkedin.com/jobs",
]

INURL_TERMS = ["inurl:jobs", "inurl:viewjob", "inurl:careers", "inurl:job-listing", "inurl:vacancy", "inurl:positions"]
NEGATIVE_TERMS = [
    "Fresher", "Internship", "Intern", "Trainee", "Customer Support", "Technical Support",
    "Sample Resume", "CV template",
]

ROLE_STOP_WORDS = {
    "senior", "lead", "principal", "staff", "engineer", "developer", "specialist",
    "manager", "analyst", "consultant", "remote", "hybrid", "job", "jobs", "role",
    "opening", "position",
}

ROLE_SYNONYMS = {
    "qa": ["Senior QA Engineer", "QA Automation Engineer", "Test Automation Engineer", "SDET"],
    "sdet": ["SDET", "Senior SDET", "QA Automation Engineer", "Test Automation Engineer"],
    "quality": ["Senior QA Engineer", "Quality Engineer", "QA Automation Engineer", "SDET"],
    "frontend": ["Frontend Engineer", "React Developer", "UI Engineer", "Frontend Developer"],
    "backend": ["Backend Engineer", "Software Engineer Backend", "Python Developer", "Java Developer"],
    "fullstack": ["Full Stack Engineer", "Fullstack Developer", "Software Engineer"],
    "devops": ["DevOps Engineer", "Platform Engineer", "Site Reliability Engineer", "SRE"],
    "data": ["Data Engineer", "Data Scientist", "Analytics Engineer"],
    "product": ["Product Manager", "Technical Product Manager", "Senior Product Manager"],
}

TECH_TOKENS = {
    "python", "java", "javascript", "typescript", "go", "golang", "rust", "kotlin",
    "swift", "react", "next.js", "vue", "angular", "node.js", "fastapi", "django",
    "spring boot", "selenium", "selenium webdriver", "playwright", "cypress", "appium",
    "webdriverio", "api testing", "rest assured", "postman", "jmeter", "k6", "gatling",
    "docker", "kubernetes", "aws", "azure", "gcp", "terraform", "jenkins",
    "github actions", "gitlab ci", "azure devops", "postgresql", "mysql", "mongodb",
    "microservices", "graphql", "grpc", "rest api", "webmethods", "mulesoft",
    "boomi", "sap cpi", "edi", "as2", "fhir", "hl7",
}


@dataclass(frozen=True)
class SearchHit:
    title: str
    url: str
    snippet: str = ""
    provider: str = "web"


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[tuple[str, str]] = []
        self._href: str | None = None
        self._text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() == "a":
            attr = dict(attrs)
            href = attr.get("href")
            if href:
                self._href = href
                self._text = []

    def handle_data(self, data: str) -> None:
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "a" and self._href is not None:
            text = " ".join(t.strip() for t in self._text if t.strip())
            self.links.append((self._href, html.unescape(text)))
            self._href = None
            self._text = []


def _quote_group(values: Iterable[str], limit: int = 8) -> str:
    clean = []
    for value in values:
        text = re.sub(r"\s+", " ", str(value or "").strip())
        if text and text.lower() not in {v.lower() for v in clean}:
            clean.append(text)
    return "(" + " OR ".join(f'"{v}"' for v in clean[:limit]) + ")"


def _or_group(values: Iterable[str], limit: int = 30) -> str:
    return "(" + " OR ".join(list(values)[:limit]) + ")"


def _role_titles(role: str) -> list[str]:
    role_clean = re.sub(r"\s+", " ", (role or "").strip())
    role_lower = role_clean.lower()
    titles: list[str] = []
    for key, synonyms in ROLE_SYNONYMS.items():
        if key in role_lower:
            titles.extend(synonyms)
            break
    if role_clean:
        titles.append(role_clean)
        lower = role_clean.lower()
        if not re.search(r"\b(senior|lead|principal|staff|architect|head|director)\b", lower):
            titles.extend([f"Senior {role_clean}", f"Lead {role_clean}"])
    return list(dict.fromkeys(titles or ["Software Engineer"]))[:8]


def _skill_terms(skills: list[str]) -> list[str]:
    terms = [s for s in skills if s]
    return list(dict.fromkeys(terms))[:8]


def _location_terms(location: str) -> list[str]:
    raw = re.sub(r"\s+", " ", (location or "").strip())
    parts = [p.strip() for p in re.split(r"[,/|;\n]+", raw) if p.strip()]
    if len(parts) == 1 and parts[0]:
        protected = {
            "new york", "san francisco", "united states", "united kingdom",
            "new zealand", "south africa", "sri lanka", "hong kong",
            "abu dhabi", "saudi arabia", "costa rica",
        }
        words = parts[0].split()
        split_parts: list[str] = []
        index = 0
        while index < len(words):
            pair = " ".join(words[index:index + 2])
            if pair.lower() in protected:
                split_parts.append(pair)
                index += 2
            else:
                split_parts.append(words[index])
                index += 1
        if len(split_parts) > 1:
            parts = split_parts
    if not parts:
        parts = ["India", "Remote"]
    if not any(p.lower() == "remote" for p in parts):
        parts.append("Remote")
    if not any(p.lower() == "hybrid" for p in parts):
        parts.append("Hybrid")
    return list(dict.fromkeys(parts))[:8]

def _experience_terms(exp_years: int) -> list[str]:
    terms = ["senior", "lead"]
    if exp_years and exp_years > 0:
        terms.insert(0, f"{exp_years}+ years")
        terms.insert(1, f"{max(exp_years - 2, 1)}+ years")
        terms.append(f"{exp_years} years experience")
    else:
        terms.extend(["5+ years", "7+ years", "* years experience"])
    if exp_years >= 10:
        terms.extend(["principal", "architect"])
    return list(dict.fromkeys(terms))[:8]


def build_dork_queries(role: str, skills: list[str], location: str, exp_years: int) -> list[str]:
    """Build generic Google-style dork queries from profile values."""
    titles = _role_titles(role)
    skill_terms = _skill_terms(skills)
    skill_group = _quote_group(skill_terms, limit=8) if skill_terms else ""
    title_group = f'(intitle:{_quote_group(titles, limit=8)} OR {_quote_group(titles, limit=8)})'
    loc_group = _quote_group(_location_terms(location), limit=8)
    exp_group = _quote_group(_experience_terms(exp_years), limit=8)
    inurl_group = _or_group(INURL_TERMS, limit=8)
    negative = " ".join(f'-"{term}"' for term in NEGATIVE_TERMS)
    optional_skill = f" AND {skill_group}" if skill_group else ""

    base = f"{title_group}{optional_skill} AND {loc_group} AND {exp_group} AND {inurl_group} {negative}"
    queries = [
        f"{_or_group(ATS_SITES, limit=24)} AND {base}",
        f"{_or_group(JOB_BOARD_SITES, limit=34)} AND {base}",
    ]
    loc_lower = (location or "").lower()
    if any(term in loc_lower for term in ("ireland", "dublin", "cork", "galway", "limerick")):
        queries.insert(0, f"{_or_group(IRELAND_SITES, limit=8)} AND {base}")
    else:
        queries.append(f"{_or_group(IRELAND_SITES, limit=8)} AND {title_group}{optional_skill} AND (\"Ireland\" OR \"Dublin\" OR \"Remote\") AND {inurl_group} {negative}")

    # A shorter fallback query helps when search engines reject very long dorks.
    fallback_skill = f" {_quote_group(skill_terms, limit=4)}" if skill_terms else ""
    queries.append(f"{_quote_group(titles, limit=4)}{fallback_skill} {_quote_group(_location_terms(location), limit=4)} jobs careers {negative}")
    return queries[:_MAX_QUERIES]


def google_search_urls(queries: list[str]) -> list[str]:
    return [f"https://www.google.com/search?q={quote_plus(q)}" for q in queries]


def _normalize_result_url(href: str) -> str | None:
    href = html.unescape(href or "")
    if href.startswith("//"):
        href = "https:" + href
    if href.startswith("/url?"):
        query = parse_qs(urlparse(href).query)
        href = query.get("q", [""])[0]
    if "duckduckgo.com/l/" in href:
        query = parse_qs(urlparse(href).query)
        href = query.get("uddg", [href])[0]
    href = unquote(href)
    if not href.startswith("http"):
        return None
    host = urlparse(href).netloc.lower()
    blocked = ("google.", "duckduckgo.com", "bing.com", "microsoft.com", "youtube.com", "webcache")
    if any(b in host for b in blocked):
        return None
    return href.split("#", 1)[0]


def _extract_hits(html_text: str, provider: str) -> list[SearchHit]:
    parser = LinkParser()
    parser.feed(html_text)
    hits: list[SearchHit] = []
    seen: set[str] = set()
    for href, title in parser.links:
        url = _normalize_result_url(href)
        if not url or url in seen:
            continue
        seen.add(url)
        clean_title = re.sub(r"\s+", " ", title or "").strip()
        if len(clean_title) < 4:
            clean_title = urlparse(url).netloc
        hits.append(SearchHit(title=clean_title[:180], url=url, provider=provider))
        if len(hits) >= _MAX_RESULTS_PER_QUERY:
            break
    return hits


async def _search_duckduckgo(client: httpx.AsyncClient, query: str) -> list[SearchHit]:
    resp = await client.get("https://html.duckduckgo.com/html/", params={"q": query})
    resp.raise_for_status()
    return _extract_hits(resp.text, "DuckDuckGo")


async def _search_bing(client: httpx.AsyncClient, query: str) -> list[SearchHit]:
    resp = await client.get("https://www.bing.com/search", params={"q": query, "count": "20"})
    resp.raise_for_status()
    return _extract_hits(resp.text, "Bing")


async def _search_google(client: httpx.AsyncClient, query: str) -> list[SearchHit]:
    resp = await client.get("https://www.google.com/search", params={"q": query, "num": "20", "hl": "en"})
    resp.raise_for_status()
    return _extract_hits(resp.text, "Google")


def _strip_html(text: str) -> str:
    text = re.sub(r"<script[\s\S]*?</script>", " ", text or " ", flags=re.I)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    return html.unescape(re.sub(r"\s+", " ", text)).strip()


def _meta_description(page_html: str) -> str:
    for pattern in [
        r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)',
        r'<meta[^>]+property=["\']og:description["\'][^>]+content=["\']([^"\']+)',
    ]:
        m = re.search(pattern, page_html, flags=re.I)
        if m:
            return html.unescape(m.group(1)).strip()
    return ""


def _page_title(page_html: str, fallback: str) -> str:
    m = re.search(r"<title[^>]*>([\s\S]*?)</title>", page_html or "", flags=re.I)
    if not m:
        return fallback
    return html.unescape(re.sub(r"\s+", " ", m.group(1))).strip() or fallback


def _company_from_url(url: str) -> str:
    parsed = urlparse(url)
    host = parsed.netloc.lower().replace("www.", "")
    parts = [p for p in parsed.path.split("/") if p]
    company = ""
    if "greenhouse" in host and parts:
        company = parts[0]
    elif "lever.co" in host and parts:
        company = parts[0]
    elif "smartrecruiters" in host and parts:
        company = parts[0]
    elif "myworkdayjobs" in host:
        company = host.split(".")[0]
    elif "ashbyhq" in host and parts:
        company = parts[0]
    elif parts and parts[0].lower() not in {"jobs", "careers", "job", "viewjob"}:
        company = parts[0]
    else:
        company = host.split(".")[0]
    company = re.sub(r"[-_]+", " ", company).strip()
    return company.title() if company else "Company"


def _clean_title(title: str, company: str) -> str:
    text = re.sub(r"\s+", " ", title or "").strip()
    text = re.sub(r"^(Job Application for|Apply for|Careers? -)\s*", "", text, flags=re.I)
    for sep in [" | ", " - ", " at ", " :: "]:
        if sep in text:
            chunks = [c.strip() for c in text.split(sep) if c.strip()]
            if chunks:
                text = chunks[0]
                break
    text = text.replace(company, "").strip(" -|:") or title
    return text[:180]


def _extract_technologies(text: str) -> list[str]:
    lower = text.lower()
    return list(dict.fromkeys(token.title() for token in TECH_TOKENS if token in lower))[:12]


def _detect_work_mode(text: str) -> str:
    lower = text.lower()
    if "remote" in lower:
        return "Remote"
    if "hybrid" in lower:
        return "Hybrid"
    return "On-site"


def _extract_experience_required(text: str) -> int:
    matches = [int(m) for m in re.findall(r"(\d{1,2})\+?\s*(?:years|yrs)", text.lower())]
    return min(matches) if matches else 0


def _matches_profile(job: dict, titles: list[str], skills: list[str], locations: list[str]) -> bool:
    combined = " ".join(str(job.get(k, "")) for k in ("title", "description", "location", "technologies")).lower()
    if any(term.lower() in combined for term in NEGATIVE_TERMS):
        return False
    title_match = any(t.lower() in combined for t in titles)
    skill_match = any(s.lower() in combined for s in skills) if skills else True
    # Location and country are already embedded in the dork query. Many ATS pages
    # omit city text from result snippets, so a second strict location filter drops
    # valid openings before users can review them.
    return title_match and skill_match


def _term_tokens(value: str) -> list[str]:
    tokens = re.findall(r"[a-z0-9+#.]+", (value or "").lower())
    return [token for token in tokens if len(token) > 2 and token not in ROLE_STOP_WORDS]


def _job_text(job: dict) -> str:
    return " ".join(
        str(job.get(k, ""))
        for k in ("title", "organization", "description", "location", "work_mode", "technologies", "application_link")
    ).lower()


QA_ROLE_TERMS = (
    "qa", "quality assurance", "quality engineer", "quality analyst", "test engineer",
    "test automation", "automation tester", "sdet", "software development engineer in test",
    "testing", "tester",
)

OTHER_COUNTRY_TERMS = {
    "india": ["brazil", "usa", "united states", "canada", "germany", "france", "spain", "australia", "new zealand", "ireland", "uk", "united kingdom", "romania", "argentina", "mexico", "portugal", "colombia", "netherlands", "poland"],
    "ireland": ["india", "brazil", "usa", "united states", "canada", "germany", "france", "spain", "australia", "new zealand", "uk", "united kingdom"],
}


def _role_family_matches(role: str, job: dict, combined: str) -> bool:
    role_lower = (role or "").lower()
    title = str(job.get("title", "")).lower()
    if any(term in role_lower for term in ("qa", "quality", "test", "sdet")):
        return any(term in title or term in combined for term in QA_ROLE_TERMS)

    role_tokens = _term_tokens(role)
    if not role_tokens:
        return True
    title_hits = [token for token in role_tokens if token in title]
    combined_hits = [token for token in role_tokens if token in combined]
    return len(title_hits) >= 1 or len(combined_hits) >= min(2, len(role_tokens))


def _skill_matches(skills: list[str], combined: str) -> bool:
    if not skills:
        return True
    for skill in skills:
        skill_lower = skill.lower().strip()
        if not skill_lower:
            continue
        if skill_lower in combined or any(token in combined for token in _term_tokens(skill_lower)):
            return True
    return False


def _location_matches(location: str, combined: str) -> bool:
    raw = (location or "").lower()
    terms = [term.lower() for term in _location_terms(location)]
    concrete_terms = [term for term in terms if term not in {"remote", "hybrid"}]

    for country, blocked in OTHER_COUNTRY_TERMS.items():
        if country in raw and country not in combined and any(other in combined for other in blocked):
            return False

    if concrete_terms:
        return any(term in combined for term in concrete_terms)
    if "remote" in terms:
        return "remote" in combined
    return True


def _passes_user_constraints(job: dict, role: str, skills: list[str], location: str) -> bool:
    combined = _job_text(job)
    if any(term.lower() in combined for term in NEGATIVE_TERMS):
        return False
    return (
        _role_family_matches(role, job, combined)
        and _skill_matches(skills, combined)
        and _location_matches(location, combined)
    )


def _ai_relevance_score(job: dict, role: str, skills: list[str], location: str, exp_years: int) -> tuple[int, list[str]]:
    """Deterministic AI-style relevance gate for noisy web dork results."""
    combined = _job_text(job)
    if not _passes_user_constraints(job, role, skills, location):
        return 0, []

    score = 0
    reasons: list[str] = []
    title_text = str(job.get("title", "")).lower()
    role_titles = [t.lower() for t in _role_titles(role)]
    if any(title and title in title_text for title in role_titles):
        score += 35
        reasons.append("Title matches target role")
    else:
        role_hits = [token for token in _term_tokens(role) if token in combined]
        if role_hits:
            score += min(30, 12 + len(role_hits) * 6)
            reasons.append(f"Role terms: {', '.join(role_hits[:3])}")

    skill_hits: list[str] = []
    for skill in skills:
        skill_lower = skill.lower().strip()
        if not skill_lower:
            continue
        if skill_lower in combined or any(token in combined for token in _term_tokens(skill_lower)):
            skill_hits.append(skill)
    if skills:
        if skill_hits:
            score += min(28, 10 + len(skill_hits) * 5)
            reasons.append(f"Skills: {', '.join(skill_hits[:3])}")
        else:
            score -= 10

    loc_terms = _location_terms(location)
    loc_hits = [term for term in loc_terms if term.lower() in combined]
    wants_remote = any(term.lower() == "remote" for term in loc_terms)
    if loc_hits:
        score += 18
        reasons.append(f"Location: {', '.join(loc_hits[:3])}")
    elif wants_remote and "remote" in combined:
        score += 18
        reasons.append("Remote match")
    elif location:
        score += 4

    exp_req = int(job.get("experience_required") or 0)
    if exp_req and exp_years:
        if exp_years >= exp_req:
            score += 10
            reasons.append(f"Experience fit: {exp_req}+ yrs")
        elif exp_req > exp_years + 2:
            score -= 12
    elif exp_years >= 5 and re.search(r"\b(senior|lead|principal|staff|architect)\b", combined):
        score += 8
        reasons.append("Seniority fit")

    parsed = urlparse(str(job.get("application_link", "")))
    url_text = f"{parsed.netloc} {parsed.path}".lower()
    if any(term in url_text for term in ("job", "jobs", "career", "careers", "position", "opening", "viewjob")):
        score += 7
        reasons.append("Job page signal")

    if not reasons and score > 0:
        reasons.append("Related search result")
    return max(0, min(100, score)), reasons[:4]


def _compute_match_score(job: dict, profile_skills: set[str], exp_years: int) -> int:
    techs = [t.lower() for t in (job.get("technologies") or [])]
    if techs:
        overlap = sum(1 for t in techs if t in profile_skills or any(t in s or s in t for s in profile_skills))
        score = 45 + int((overlap / len(techs)) * 45)
    else:
        score = 62
    exp_req = job.get("experience_required") or 0
    if exp_years and exp_req:
        if exp_years >= exp_req:
            score += 8
        elif exp_years < exp_req - 2:
            score -= 12
    return max(10, min(99, score))


def _job_from_hit(hit: SearchHit, page_html: str = "") -> dict:
    company = _company_from_url(hit.url)
    page_title = _page_title(page_html, hit.title)
    title = _clean_title(page_title, company)
    description = _meta_description(page_html) or _strip_html(page_html)[:2000] or hit.snippet or hit.title
    text = f"{title} {company} {description} {hit.url}"
    return {
        "title": title,
        "organization": company,
        "location": "Remote" if "remote" in text.lower() else "",
        "work_mode": _detect_work_mode(text),
        "salary_min": None,
        "salary_max": None,
        "currency": "USD",
        "description": description[:2000],
        "technologies": _extract_technologies(text),
        "application_link": hit.url,
        "career_page_link": hit.url,
        "posted_date": "",
        "verification_status": "VERIFIED" if page_html else "UNVERIFIED",
        "source": f"Dork/{hit.provider}",
        "experience_required": _extract_experience_required(text),
        "search_title": hit.title,
    }


async def _enrich_hit(client: httpx.AsyncClient, hit: SearchHit) -> dict | None:
    try:
        resp = await client.get(hit.url, follow_redirects=True)
        if resp.status_code >= 400:
            return _job_from_hit(hit)
        return _job_from_hit(hit, resp.text[:350000])
    except Exception:
        return _job_from_hit(hit)


async def discover_jobs_from_dorks(
    role: str,
    location: str,
    profile_skills: list[str] | None = None,
    exp_years: int = 0,
    min_match_score: int = 0,
) -> tuple[list[dict], list[str]]:
    skills = profile_skills or []
    queries = build_dork_queries(role, skills, location, exp_years)
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }

    hits: list[SearchHit] = []
    async with httpx.AsyncClient(timeout=_SEARCH_TIMEOUT, headers=headers) as client:
        providers = (_search_duckduckgo, _search_bing, _search_google)
        for query in queries:
            batches = await asyncio.gather(
                *[provider(client, query) for provider in providers],
                return_exceptions=True,
            )
            for batch in batches:
                if isinstance(batch, list):
                    hits.extend(batch)
                else:
                    logger.debug("Dork search provider failed: %s", batch)

    dedup_hits: list[SearchHit] = []
    seen_urls: set[str] = set()
    for hit in hits:
        if hit.url not in seen_urls:
            seen_urls.add(hit.url)
            dedup_hits.append(hit)
    dedup_hits = dedup_hits[:_MAX_PAGES_TO_ENRICH]

    async with httpx.AsyncClient(timeout=_PAGE_TIMEOUT, headers=headers) as client:
        enriched = await asyncio.gather(*[_enrich_hit(client, hit) for hit in dedup_hits], return_exceptions=True)

    skill_terms = _skill_terms(skills)
    profile_skill_set = {s.lower() for s in skills}
    jobs: list[dict] = []
    seen_jobs: set[tuple[str, str]] = set()
    for item in enriched:
        if not isinstance(item, dict):
            continue
        ai_score, match_reasons = _ai_relevance_score(item, role, skill_terms, location, exp_years)
        if ai_score < 60:
            continue
        key = (item.get("title", "").lower()[:70], item.get("organization", "").lower()[:50])
        if key in seen_jobs:
            continue
        seen_jobs.add(key)
        item["ai_relevance_score"] = ai_score
        item["match_reasons"] = match_reasons
        item["match_score"] = max(_compute_match_score(item, profile_skill_set, exp_years), ai_score)
        if min_match_score and item["match_score"] < min_match_score:
            continue
        jobs.append(item)

    jobs.sort(key=lambda j: (-(j.get("match_score") or 0), j.get("title", "")))
    logger.info("Dork discovery produced %s jobs from %s hits", len(jobs), len(dedup_hits))
    return jobs, queries


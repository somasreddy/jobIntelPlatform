"""Country-aware source registry for job discovery.

The query builder should not decide which countries map to which boards. This
registry keeps that business rule auditable and easy to extend.
"""
from __future__ import annotations

from dataclasses import dataclass
import re

ATS_SITES = [
    "site:myworkdayjobs.com", "site:greenhouse.io", "site:boards.greenhouse.io",
    "site:job-boards.greenhouse.io", "site:icims.com", "site:taleo.net",
    "site:lever.co", "site:jobs.lever.co", "site:smartrecruiters.com",
    "site:jobvite.com", "site:workforcenow.adp.com", "site:successfactors.com",
    "site:brassring.com", "site:jazzhr.com", "site:breezy.hr", "site:jobdiva.com",
    "site:bullhorn.com", "site:bamboohr.com", "site:linkedin.com/jobs",
]

GLOBAL_JOB_BOARD_SITES = [
    "site:indeed.com", "site:monster.com", "site:glassdoor.com", "site:ziprecruiter.com",
    "site:careerbuilder.com", "site:linkedin.com/jobs", "site:simplyhired.com",
    "site:weworkremotely.com", "site:wellfound.com",
]


@dataclass(frozen=True)
class CountrySourceGroup:
    code: str
    label: str
    aliases: tuple[str, ...]
    job_boards: tuple[str, ...]
    default_locations: tuple[str, ...] = ()


@dataclass(frozen=True)
class SourcePlan:
    scope: str
    country_code: str | None
    country_label: str
    job_boards: tuple[str, ...]
    include_ats: bool
    reason: str

    def as_dict(self) -> dict:
        return {
            "scope": self.scope,
            "country_code": self.country_code,
            "country_label": self.country_label,
            "job_boards": list(self.job_boards),
            "include_ats": self.include_ats,
            "reason": self.reason,
        }


COUNTRY_SOURCE_GROUPS = [
    CountrySourceGroup(
        code="IN",
        label="India",
        aliases=("india", "bharat", "in"),
        default_locations=("bengaluru", "bangalore", "hyderabad", "pune", "chennai", "mumbai", "delhi", "gurgaon", "noida", "kolkata"),
        job_boards=(
            "site:naukri.com", "site:timesjobs.com", "site:indeed.co.in", "site:linkedin.com/jobs",
            "site:monsterindia.com", "site:shine.com", "site:foundit.in", "site:cutshort.io",
            "site:hirist.com", "site:iimjobs.com", "site:apna.co", "site:instahyre.com",
        ),
    ),
    CountrySourceGroup(
        code="IE",
        label="Ireland",
        aliases=("ireland", "republic of ireland", "ie"),
        default_locations=("dublin", "cork", "galway", "limerick", "waterford"),
        job_boards=("site:jobsireland.ie", "site:irishjobs.ie", "site:jobs.ie", "site:recruitireland.com", "site:publicjobs.ie", "site:ie.indeed.com", "site:ie.linkedin.com/jobs"),
    ),
    CountrySourceGroup(
        code="US",
        label="United States",
        aliases=("united states", "usa", "us", "america"),
        default_locations=("new york", "san francisco", "austin", "seattle", "chicago", "boston", "california", "texas"),
        job_boards=tuple(GLOBAL_JOB_BOARD_SITES),
    ),
    CountrySourceGroup(
        code="CA",
        label="Canada",
        aliases=("canada", "ca"),
        default_locations=("toronto", "vancouver", "montreal", "ottawa", "calgary"),
        job_boards=("site:indeed.ca", "site:jobbank.gc.ca", "site:workopolis.com", "site:linkedin.com/jobs"),
    ),
    CountrySourceGroup(
        code="GB",
        label="United Kingdom",
        aliases=("united kingdom", "uk", "great britain", "england", "scotland", "wales", "northern ireland"),
        default_locations=("london", "manchester", "birmingham", "edinburgh", "glasgow", "leeds", "belfast"),
        job_boards=("site:indeed.co.uk", "site:reed.co.uk", "site:cv-library.co.uk", "site:totaljobs.com", "site:linkedin.com/jobs"),
    ),
    CountrySourceGroup(
        code="DE",
        label="Germany",
        aliases=("germany", "deutschland", "de"),
        default_locations=("berlin", "munich", "hamburg", "frankfurt", "cologne", "stuttgart"),
        job_boards=("site:indeed.de", "site:stepstone.de", "site:jobs.de", "site:xing.com", "site:linkedin.com/jobs"),
    ),
    CountrySourceGroup(
        code="FR",
        label="France",
        aliases=("france", "fr"),
        default_locations=("paris", "lyon", "marseille", "toulouse", "lille"),
        job_boards=("site:indeed.fr", "site:monster.fr", "site:linkedin.com/jobs"),
    ),
    CountrySourceGroup(
        code="ES",
        label="Spain",
        aliases=("spain", "espana", "es"),
        default_locations=("madrid", "barcelona", "valencia", "seville"),
        job_boards=("site:indeed.es", "site:infojobs.net", "site:linkedin.com/jobs"),
    ),
    CountrySourceGroup(
        code="AU",
        label="Australia",
        aliases=("australia", "au"),
        default_locations=("sydney", "melbourne", "brisbane", "perth", "adelaide"),
        job_boards=("site:indeed.com.au", "site:seek.com.au", "site:linkedin.com/jobs"),
    ),
    CountrySourceGroup(
        code="NZ",
        label="New Zealand",
        aliases=("new zealand", "nz"),
        default_locations=("auckland", "wellington", "christchurch"),
        job_boards=("site:seek.co.nz", "site:linkedin.com/jobs"),
    ),
    CountrySourceGroup(
        code="SEA",
        label="Southeast Asia",
        aliases=("singapore", "malaysia", "philippines", "indonesia", "vietnam", "thailand", "southeast asia"),
        default_locations=("singapore", "kuala lumpur", "manila", "jakarta", "bangkok", "ho chi minh"),
        job_boards=("site:jobstreet.com", "site:kalibrr.com", "site:linkedin.com/jobs"),
    ),
    CountrySourceGroup(
        code="PK",
        label="Pakistan",
        aliases=("pakistan", "pk"),
        default_locations=("karachi", "lahore", "islamabad"),
        job_boards=("site:rozee.pk", "site:linkedin.com/jobs"),
    ),
    CountrySourceGroup(
        code="LATAM",
        label="Latin America",
        aliases=("mexico", "brazil", "brasil", "latin america", "latam", "argentina", "chile", "colombia", "peru"),
        default_locations=("mexico city", "sao paulo", "rio de janeiro", "buenos aires", "santiago", "bogota"),
        job_boards=("site:indeed.com.mx", "site:indeed.com.br", "site:computrabajo.com", "site:linkedin.com/jobs"),
    ),
]


def _contains_phrase(text: str, phrase: str) -> bool:
    return bool(re.search(rf"\b{re.escape(phrase.lower())}\b", text))


def all_registered_job_boards() -> tuple[str, ...]:
    boards: list[str] = []
    boards.extend(GLOBAL_JOB_BOARD_SITES)
    for group in COUNTRY_SOURCE_GROUPS:
        boards.extend(group.job_boards)
    return tuple(dict.fromkeys(boards))


def resolve_source_plan(location: str) -> SourcePlan:
    text = re.sub(r"\s+", " ", (location or "").strip().lower())
    for group in COUNTRY_SOURCE_GROUPS:
        if any(_contains_phrase(text, alias) for alias in group.aliases):
            return SourcePlan(
                scope="country",
                country_code=group.code,
                country_label=group.label,
                job_boards=group.job_boards,
                include_ats=True,
                reason=f"Matched country from user search: {group.label}; using trusted ATS/company career portals plus country boards.",
            )
    for group in COUNTRY_SOURCE_GROUPS:
        if any(_contains_phrase(text, city) for city in group.default_locations):
            return SourcePlan(
                scope="country",
                country_code=group.code,
                country_label=group.label,
                job_boards=group.job_boards,
                include_ats=True,
                reason=f"Inferred country from city/location: {group.label}; using trusted ATS/company career portals plus country boards.",
            )
    is_remote = _contains_phrase(text, "remote") or not text
    return SourcePlan(
        scope="global_remote" if is_remote else "global",
        country_code=None,
        country_label="Worldwide Remote" if is_remote else "Global",
        job_boards=all_registered_job_boards(),
        include_ats=True,
        reason="Remote search with no country selected; using all supported global and country job boards." if is_remote else "No supported country detected; using all supported global and country job boards.",
    )

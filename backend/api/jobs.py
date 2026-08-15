import uuid
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Body, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from core.database import get_db
from core.auth import get_current_user_id
from core.config import settings
from models.database import VerifiedJob, CandidateProfile, CareerGoal
from models.schemas import JobCreate
from job_discovery.service_v2 import JobDiscoveryService
from job_discovery.dork_discovery import build_dork_search_plan, google_search_urls
from job_discovery.source_registry import load_search_catalog, resolve_source_plan
from services.fit_score import compute_fit_score
from services.job_intel import compute_intel_flags
from services.job_ranking import RankingPreferences, rank_jobs

logger = logging.getLogger(__name__)
router = APIRouter()


def _combined_location(payload: dict) -> str:
    location = str(payload.get("location") or "").strip()
    country = str(payload.get("country") or "").strip()
    if not country:
        return location
    if location and country.lower() in location.lower():
        return location
    return ", ".join(part for part in [location, country] if part)


def _row_to_dict(job: VerifiedJob) -> dict:
    created_at = job.created_at
    if created_at and created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    age_hours = max(0, int((datetime.now(timezone.utc) - created_at).total_seconds() / 3600)) if created_at else None
    verification_status = job.verification_status or "UNVERIFIED"
    confidence = getattr(job, "extraction_confidence", None)
    confidence = int(confidence if confidence is not None else (90 if verification_status == "VERIFIED" else 45))
    source_quality = "high" if verification_status == "VERIFIED" else "medium" if job.application_link else "low"
    freshness_status = "fresh" if age_hours is not None and age_hours <= 72 else "aging" if age_hours is not None and age_hours <= 336 else "stale"
    return {
        "id": str(job.id),
        "title": job.title,
        "organization": job.organization,
        "location": job.location,
        "workMode": job.work_mode,
        "salaryMin": job.salary_min,
        "salaryMax": job.salary_max,
        "currency": job.currency or "USD",
        "experienceRequired": job.experience_required,
        "description": job.description,
        "technologies": job.technologies or [],
        "applicationLink": job.application_link,
        "careerPageLink": job.career_page_link,
        "recruiterName": job.recruiter_name,
        "recruiterLinkedIn": job.recruiter_linkedin,
        "verificationStatus": verification_status,
        "levelUp": job.level_up,
        "matchScore": job.match_score,
        "postedDate": job.posted_date or str(job.created_at)[:10],
        "source": (getattr(job, "normalized_payload", None) or {}).get("source"),
        "sourceQuality": source_quality,
        "extractionConfidence": confidence,
        "freshnessScore": int(getattr(job, "freshness_score", 0) or 0) or None,
        "jobFreshnessHours": age_hours,
        "freshnessStatus": freshness_status,
        "lastVerifiedAt": str(getattr(job, "last_verified_at", "") or "") or None,
        "canonicalUrl": getattr(job, "canonical_url", None),
        "fieldProvenance": getattr(job, "field_provenance", None) or {},
    }


@router.get("")
async def get_jobs(
    response: Response,
    search: Optional[str] = Query(None),
    work_mode: Optional[str] = Query(None),
    tech: Optional[str] = Query(None),
    source: Optional[str] = Query(None),          # portal filter e.g. "LinkedIn"
    min_match_score: int = Query(0, ge=0, le=100), # strict score filter
    verified_only: bool = Query(False),
    skip: int = Query(0, ge=0),
    recency_days: int = Query(7, ge=1, le=90),
    salary_present: Optional[bool] = Query(None),
    min_confidence: int = Query(0, ge=0, le=100),
    source_quality: Optional[str] = Query(None, pattern="^(high|medium|low)$"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user_id),
):
    """Get discovered jobs with trust, provenance, recency, and fit filters."""
    from collections import Counter
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=recency_days)
        stmt = select(VerifiedJob).where(VerifiedJob.created_at >= cutoff)
        if verified_only:
            stmt = stmt.where(VerifiedJob.verification_status == "VERIFIED")
        if work_mode and work_mode != "All":
            stmt = stmt.where(VerifiedJob.work_mode == work_mode)
        if search:
            q = f"%{search.lower()}%"
            stmt = stmt.where(
                func.lower(VerifiedJob.title).like(q)
                | func.lower(VerifiedJob.organization).like(q)
            )
        retrieval_limit = min(500, max(limit * 4, skip + limit))
        stmt = stmt.order_by(VerifiedJob.created_at.desc()).limit(retrieval_limit)
        result = await db.execute(stmt)
        job_objs = result.scalars().all()
        candidates_retrieved = len(job_objs)
        rows = [_row_to_dict(j) for j in job_objs]
    except Exception as exc:
        logger.warning(f"DB unavailable for GET /jobs, returning empty list: {exc}")
        return []

    # Post-filter: tech tag
    if tech and tech != "All":
        rows = [r for r in rows if tech in (r.get("technologies") or [])]
    # Post-filter: source portal
    if source and source != "All":
        rows = [r for r in rows if r.get("source") == source]
    # Post-filter: minimum match score
    if min_match_score > 0:
        rows = [r for r in rows if (r.get("matchScore") or 0) >= min_match_score]

    if salary_present is not None:
        rows = [row for row in rows if bool(row.get("salaryMin") or row.get("salaryMax")) is salary_present]
    if min_confidence:
        rows = [row for row in rows if (row.get("extractionConfidence") or 0) >= min_confidence]
    if source_quality:
        rows = [row for row in rows if row.get("sourceQuality") == source_quality]
    # ── Attach fit scores using the user's live profile ──────────────────────
    profile = None
    goal = None
    try:
        profile_r = await db.execute(
            select(CandidateProfile).where(CandidateProfile.user_id == user_id)
        )
        profile = profile_r.scalar_one_or_none()

        goal_r = await db.execute(
            select(CareerGoal).where(CareerGoal.user_id == user_id, CareerGoal.is_active == True)
        )
        goal = goal_r.scalar_one_or_none()

        if profile:
            for row in rows:
                fit = compute_fit_score(
                    user_skills=list(profile.skills or []),
                    user_frameworks=list(profile.frameworks or []),
                    user_languages=list(profile.languages or []),
                    user_experience_years=profile.experience_years,
                    user_preferred_locations=list(profile.preferred_locations or []),
                    user_work_mode=profile.work_mode,
                    user_current_salary=profile.current_salary,
                    user_target_role=goal.target_role if goal else None,
                    user_target_salary_min=goal.target_salary_min if goal else None,
                    job_title=row.get("title", ""),
                    job_description=row.get("description", ""),
                    job_requirements=row.get("technologies") or [],
                    job_experience_required=row.get("experienceRequired"),
                    job_location=row.get("location"),
                    job_work_mode=row.get("workMode"),
                    job_salary_min=row.get("salaryMin"),
                    job_salary_max=row.get("salaryMax"),
                )
                row["fitScore"] = fit["fit_score"]
                row["fitBadge"] = fit["badge"]
    except Exception as exc:
        logger.warning(f"Fit score computation skipped: {exc}")

    # ── Attach intel flags ────────────────────────────────────────────────────
    try:
        org_counts = Counter(j.organization or "" for j in job_objs)
        job_obj_map = {str(j.id): j for j in job_objs}
        for row in rows:
            jobj = job_obj_map.get(row["id"])
            if jobj:
                flags = compute_intel_flags(
                    job_id=str(jobj.id),
                    title=jobj.title or "",
                    organization=jobj.organization or "",
                    description=jobj.description,
                    application_link=jobj.application_link,
                    salary_min=jobj.salary_min,
                    salary_max=jobj.salary_max,
                    work_mode=jobj.work_mode,
                    requirements=list(jobj.requirements or []) + list(jobj.technologies or []),
                    created_at=jobj.created_at,
                    posted_date=jobj.posted_date,
                    org_recent_count=org_counts.get(jobj.organization or "", 1),
                )
                row.update(flags)
    except Exception as exc:
        logger.warning(f"Intel flags computation skipped: {exc}")

    preferences = RankingPreferences(
        target_role=goal.target_role if goal else "",
        work_mode=profile.work_mode if profile else "",
        locations=tuple(profile.preferred_locations or ()) if profile else (),
        minimum_salary=goal.target_salary_min if goal else None,
    )
    if settings.ENABLE_DETERMINISTIC_RANKING:
        rows, ranking_telemetry = rank_jobs(rows, preferences)
    else:
        ranking_telemetry = {"ranking_version": "disabled", "candidates_ranked": len(rows)}
    candidates_after_filters = len(rows)
    rows = rows[skip:skip + limit]
    ranking_telemetry.update({
        "candidates_retrieved": candidates_retrieved,
        "candidates_after_filters": candidates_after_filters,
        "returned": len(rows),
        "skip": skip,
        "limit": limit,
    })
    response.headers["X-Ranking-Version"] = ranking_telemetry["ranking_version"]
    response.headers["X-Candidates-Retrieved"] = str(candidates_retrieved)
    response.headers["X-Candidates-Ranked"] = str(candidates_after_filters)
    logger.info("job_ranking_telemetry=%s", ranking_telemetry)
    return rows


@router.get("/verified")
async def get_verified_jobs(
    skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)
):
    """Get only verified jobs."""
    stmt = (
        select(VerifiedJob)
        .where(VerifiedJob.verification_status == "VERIFIED")
        .order_by(VerifiedJob.created_at.desc())
        .offset(skip).limit(limit)
    )
    result = await db.execute(stmt)
    return [_row_to_dict(j) for j in result.scalars().all()]


@router.post("/discover")
async def discover_jobs(
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Live no-key job discovery.

    Accepts a profile payload and returns best-matched jobs discovered through
    generic Google-style dork queries plus no-key public feeds and ATS APIs.

    Payload fields (all optional):
      role             - candidate's current / target role
      skills           - list of skill strings
      frameworks       - list of framework strings
      cicd_tools       - list of CI/CD tool strings
      languages        - list of language strings
      experience_years - integer
      location         - preferred location string
      country          - preferred country string
      work_mode        - "Remote" | "Hybrid" | "On-site" | "Any"
      min_match_score  - 0-100, default 60
      run_verification - bool, default true (HEAD-ping every app link)
    """
    svc = JobDiscoveryService()

    profile_skills = (
        (payload.get("skills") or [])
        + (payload.get("frameworks") or [])
        + (payload.get("cicd_tools") or [])
        + (payload.get("languages") or [])
    )

    source_catalog = await load_search_catalog(db)
    jobs = await svc.discover_jobs(
        role=payload.get("role", ""),
        location=_combined_location(payload),
        profile_skills=profile_skills,
        exp_years=int(payload.get("experience_years") or 0),
        min_match_score=int(payload.get("min_match_score") or 60),
        run_verification=bool(payload.get("run_verification", True)),
        source_catalog=source_catalog or None,
    )

    # Persist discovered jobs so GET /api/jobs/ returns them on next load
    if jobs:
        try:
            existing_result = await db.execute(select(VerifiedJob.application_link))
            existing_links: set[str] = {row[0] for row in existing_result if row[0]}

            for job_data in jobs:
                link = job_data.get("application_link", "")
                if link and link in existing_links:
                    continue
                try:
                    job_obj = VerifiedJob(
                        title=job_data.get("title", ""),
                        organization=job_data.get("organization", ""),
                        location=job_data.get("location", ""),
                        work_mode=job_data.get("work_mode", "Remote"),
                        salary_min=job_data.get("salary_min"),
                        salary_max=job_data.get("salary_max"),
                        currency=job_data.get("currency", "USD"),
                        description=job_data.get("description", ""),
                        technologies=job_data.get("technologies", []),
                        application_link=link or None,
                        posted_date=job_data.get("posted_date"),
                        verification_status=job_data.get("verification_status", "UNVERIFIED"),
                    )
                    db.add(job_obj)
                    await db.flush()
                    if link:
                        existing_links.add(link)
                except Exception as exc:
                    logger.warning(f"Failed to persist discovered job '{job_data.get('title')}': {exc}")
        except Exception as exc:
            logger.warning(f"DB unavailable for job persistence, skipping: {exc}")

    # Return camelCase format matching GET /api/jobs/ so the frontend Job type maps correctly
    return [
        {
            "id": "",
            "title": j.get("title", ""),
            "organization": j.get("organization", ""),
            "location": j.get("location", ""),
            "workMode": j.get("work_mode", ""),
            "salaryMin": j.get("salary_min"),
            "salaryMax": j.get("salary_max"),
            "currency": j.get("currency", "USD"),
            "experienceRequired": j.get("experience_required"),
            "description": j.get("description", ""),
            "technologies": j.get("technologies") or [],
            "applicationLink": j.get("application_link", ""),
            "careerPageLink": j.get("career_page_link"),
            "verificationStatus": j.get("verification_status", "UNVERIFIED"),
            "postedDate": j.get("posted_date", ""),
            "source": j.get("source"),
            "matchScore": j.get("match_score"),
            "aiRelevanceScore": j.get("ai_relevance_score"),
            "matchReasons": j.get("match_reasons") or [],
        }
        for j in jobs
    ]


@router.post("/dork-query")
async def generate_dork_query(payload: dict = Body(...), db: AsyncSession = Depends(get_db)):
    """Return the generic Google-style dork queries generated for a profile."""
    profile_skills = (
        (payload.get("skills") or [])
        + (payload.get("frameworks") or [])
        + (payload.get("cicd_tools") or [])
        + (payload.get("languages") or [])
    )
    source_catalog = await load_search_catalog(db)
    source_plan = resolve_source_plan(_combined_location(payload), source_catalog=source_catalog or None)
    plan = build_dork_search_plan(
        role=payload.get("role", ""),
        skills=profile_skills,
        location=_combined_location(payload),
        exp_years=int(payload.get("experience_years") or 0),
        source_plan=source_plan,
    )
    queries = plan["queries"]
    return {
        "queries": queries,
        "google_urls": google_search_urls(queries),
        "intent": plan["intent"],
        "source_plan": plan["source_plan"],
        "source": "country-aware-dork-builder",
    }


@router.get("/{job_id}")
async def get_job_details(job_id: str, db: AsyncSession = Depends(get_db)):
    """Get details for a specific job."""
    try:
        uid = uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job ID format")
    result = await db.execute(select(VerifiedJob).where(VerifiedJob.id == uid))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return _row_to_dict(job)


@router.post("")
async def create_job(payload: JobCreate, db: AsyncSession = Depends(get_db)):
    """Create / ingest a new job (used by discovery worker)."""
    job = VerifiedJob(
        title=payload.title,
        organization=payload.organization,
        location=payload.location,
        work_mode=payload.work_mode,
        salary_min=payload.salary_min,
        salary_max=payload.salary_max,
        currency=payload.currency,
        experience_required=payload.experience_required,
        description=payload.description,
        technologies=payload.technologies,
        application_link=payload.application_link,
        career_page_link=payload.career_page_link,
        verification_status=payload.verification_status,
    )
    db.add(job)
    await db.flush()
    await db.refresh(job)
    return _row_to_dict(job)


@router.post("/match-score")
async def compute_match_score(payload: dict = Body(...)):
    """Compute skill-overlap match score between a profile and a job."""
    profile = payload.get("profile", {})
    job = payload.get("job", {})
    p_skills = set(
        s.lower() for s in (
            (profile.get("skills") or [])
            + (profile.get("frameworks") or [])
            + (profile.get("cicd_tools") or [])
            + (profile.get("languages") or [])
        )
    )
    j_techs = set(t.lower() for t in (job.get("technologies") or []))
    if not j_techs:
        return {"score": 70}
    overlap = len(p_skills & j_techs)
    score = int((overlap / len(j_techs)) * 100)
    exp_req = job.get("experience_required") or 0
    cand_exp = profile.get("experience_years") or 0
    if cand_exp >= exp_req:
        score = min(99, score + 10)
    elif cand_exp < exp_req - 2:
        score = max(10, score - 15)
    return {"score": score, "overlap": list(p_skills & j_techs), "missing": list(j_techs - p_skills)}


@router.post("/scan-portals")
async def scan_portals(
    payload: dict = Body(default={}),
    db: AsyncSession = Depends(get_db),
):
    """
    Career-Ops 2C — 3-level portal scanner.

    Scans tracked company career pages and Greenhouse/Ashby APIs for new jobs,
    deduplicates against existing DB records, and ingests new postings.

    Body (all optional):
      {
        "companies": ["Anthropic", "Stripe"],  # filter to specific companies; omit for all
        "scan_level": 2,                        # 1=Playwright, 2=API only (default), 3=WebSearch
        "title_filter": true                    # apply TITLE_FILTER rules (default true)
      }
    """
    import asyncio
    import httpx
    from job_discovery.portals_config import (
        get_enabled_companies, get_greenhouse_companies, filter_title
    )

    scan_level   = int(payload.get("scan_level", 2))
    apply_filter = bool(payload.get("title_filter", True))
    company_filter = [c.lower() for c in (payload.get("companies") or [])]

    companies = get_enabled_companies()
    if company_filter:
        companies = [c for c in companies if c["company"].lower() in company_filter]

    # Fetch existing URLs from DB to deduplicate
    existing_result = await db.execute(select(VerifiedJob.application_link))
    existing_links: set[str] = {row[0] for row in existing_result if row[0]}

    discovered: list[dict] = []
    new_count   = 0
    dedup_count = 0

    async def _fetch_greenhouse(company: dict) -> list[dict]:
        api_url = company.get("api")
        if not api_url:
            return []
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(api_url, params={"content": "true"})
                if not resp.is_success:
                    return []
                data = resp.json()
                jobs_raw = data.get("jobs", [])
                results = []
                for j in jobs_raw[:50]:
                    title = j.get("title", "")
                    if apply_filter and not filter_title(title)["passes"]:
                        continue
                    link = j.get("absolute_url") or j.get("url") or ""
                    results.append({
                        "title":           title,
                        "organization":    company["company"],
                        "location":        j.get("location", {}).get("name", ""),
                        "work_mode":       "hybrid",
                        "description":     j.get("content", "")[:5000],
                        "application_link": link,
                        "career_page_link": company["careers_url"],
                        "posted_date":     (j.get("updated_at") or "")[:10],
                        "source":          "greenhouse_api",
                        "verification_status": "VERIFIED",
                    })
                return results
        except Exception as e:
            logger.warning(f"Greenhouse scan failed for {company['company']}: {e}")
            return []

    async def _fetch_ashby(company: dict) -> list[dict]:
        slug = company["careers_url"].rstrip("/").split("/")[-1]
        api_url = f"https://api.ashbyhq.com/posting-api/job-board/{slug}"
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(api_url)
                if not resp.is_success:
                    return []
                data = resp.json()
                jobs_raw = data.get("jobs", [])
                results = []
                for j in jobs_raw[:50]:
                    title = j.get("title", "")
                    if apply_filter and not filter_title(title)["passes"]:
                        continue
                    link = j.get("jobUrl") or j.get("applyUrl") or ""
                    dept = (j.get("department") or {}).get("name", "")
                    loc  = ", ".join(l.get("name", "") for l in (j.get("location") or [{}]))
                    results.append({
                        "title":           title,
                        "organization":    company["company"],
                        "location":        loc,
                        "work_mode":       "remote" if "remote" in loc.lower() else "hybrid",
                        "description":     j.get("descriptionHtml", "")[:5000],
                        "application_link": link,
                        "career_page_link": company["careers_url"],
                        "posted_date":     (j.get("publishedDate") or "")[:10],
                        "source":          "ashby_api",
                        "verification_status": "VERIFIED",
                    })
                return results
        except Exception as e:
            logger.warning(f"Ashby scan failed for {company['company']}: {e}")
            return []

    # Level 2 — API-based scan (Greenhouse + Ashby)
    if scan_level >= 2:
        tasks = []
        for company in companies:
            platform = company.get("platform")
            if platform == "greenhouse" and company.get("api"):
                tasks.append(_fetch_greenhouse(company))
            elif platform == "ashby":
                tasks.append(_fetch_ashby(company))

        results = await asyncio.gather(*tasks, return_exceptions=True)
        for batch in results:
            if isinstance(batch, list):
                discovered.extend(batch)

    # Deduplicate and ingest new jobs
    for job_data in discovered:
        link = job_data.get("application_link", "")
        if link and link in existing_links:
            dedup_count += 1
            continue

        try:
            job = VerifiedJob(
                title=job_data["title"],
                organization=job_data["organization"],
                location=job_data.get("location", ""),
                work_mode=job_data.get("work_mode", "hybrid"),
                description=job_data.get("description", ""),
                application_link=job_data.get("application_link"),
                career_page_link=job_data.get("career_page_link"),
                posted_date=job_data.get("posted_date"),
                verification_status=job_data.get("verification_status", "VERIFIED"),
            )
            db.add(job)
            await db.flush()
            new_count += 1
            if link:
                existing_links.add(link)
        except Exception as e:
            logger.warning(f"Failed to ingest job '{job_data.get('title')}': {e}")

    return {
        "scan_level": scan_level,
        "companies_scanned": len(companies),
        "total_discovered": len(discovered),
        "new_ingested": new_count,
        "duplicates_skipped": dedup_count,
        "companies": [c["company"] for c in companies],
    }


@router.post("/batch-evaluate")
async def batch_evaluate(
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Batch evaluate multiple jobs using the Career-Ops 6-Block Evaluator.

    Payload:
      job_ids:     list[str]  — UUIDs of jobs to evaluate
      resume_text: str        — Candidate's resume as plain text (min 50 chars)

    Returns a list of { job_id, title, organization, score, archetype, evaluation }.
    Evaluations run concurrently (up to 5 at a time).
    """
    import asyncio
    from services.intelligence_tools import run_job_evaluator

    job_ids = payload.get("job_ids", [])
    resume_text = payload.get("resume_text", "")

    if not job_ids:
        return {"error": "job_ids list is required", "results": []}
    if len(resume_text) < 50:
        return {"error": "resume_text must be at least 50 characters", "results": []}

    # Cap at 10 jobs per batch to avoid LLM cost explosion
    job_ids = job_ids[:10]

    # Fetch all jobs from DB
    jobs_map = {}
    for jid in job_ids:
        try:
            uid = uuid.UUID(jid)
        except ValueError:
            continue
        result = await db.execute(select(VerifiedJob).where(VerifiedJob.id == uid))
        job = result.scalar_one_or_none()
        if job:
            jobs_map[str(uid)] = job

    if not jobs_map:
        return {"error": "No valid jobs found for given IDs", "results": []}

    # Build JD text for each job
    async def evaluate_single(jid: str, job: VerifiedJob) -> dict:
        jd = job.description or (
            f"Role: {job.title}. Company: {job.organization}. "
            f"Location: {job.location}. Work mode: {job.work_mode}. "
            f"Experience: {job.experience_required}+ years. "
            f"Technologies: {', '.join(job.technologies or [])}."
        )
        # Ensure JD meets minimum length
        if len(jd) < 50:
            jd += f" Salary: {job.salary_min or 0}-{job.salary_max or 0} {job.currency or 'USD'}."

        try:
            evaluation = await run_job_evaluator(jd, resume_text)
            return {
                "job_id": jid,
                "title": job.title,
                "organization": job.organization,
                "score": evaluation.get("score", 0),
                "archetype": (evaluation.get("block_a_summary") or {}).get("archetype", "Unknown"),
                "evaluation": evaluation,
                "status": "success",
            }
        except Exception as e:
            logger.error(f"Batch evaluate failed for {jid}: {e}")
            return {
                "job_id": jid,
                "title": job.title,
                "organization": job.organization,
                "score": 0,
                "archetype": "Error",
                "evaluation": None,
                "status": "error",
                "error": str(e),
            }

    # Semaphore to limit concurrency to 5
    sem = asyncio.Semaphore(5)

    async def sem_evaluate(jid: str, job: VerifiedJob) -> dict:
        async with sem:
            return await evaluate_single(jid, job)

    tasks = [sem_evaluate(jid, job) for jid, job in jobs_map.items()]
    results = await asyncio.gather(*tasks)

    # Sort by score descending
    results = sorted(results, key=lambda r: r.get("score", 0), reverse=True)

    return {
        "total": len(results),
        "evaluated": sum(1 for r in results if r["status"] == "success"),
        "results": results,
    }


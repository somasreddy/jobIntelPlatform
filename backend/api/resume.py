import uuid
import base64
import logging
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Body
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from core.auth import get_current_user_id
from models.database import VerifiedJob, ResumeHistory
from resume_parser.parser import ResumeParser
from ats_resume_generator.generator import ATSResumeGenerator, generate_master_resume
from cover_letter_generator.generator import CoverLetterGenerator

logger = logging.getLogger(__name__)
router = APIRouter()
_parser  = ResumeParser()
_ats_gen = ATSResumeGenerator()
_cl_gen  = CoverLetterGenerator()


# ── Parse uploaded resume ─────────────────────────────────────────────────────
@router.post("/parse")
async def parse_resume(file: UploadFile = File(...)):
    """Parse an uploaded PDF/DOCX and extract skills."""
    content = await file.read()
    result  = await _parser.parse_document(content, file.filename or "resume.pdf")
    return {
        "filename":        file.filename,
        "extracted_skills": result.get("skills", []),
        "frameworks":      result.get("frameworks", []),
        "languages":       result.get("languages", []),
        "cicd_tools":      result.get("cicd_tools", []),
        "experience_years": result.get("experience_years", 0),
    }


# ── ATS-optimised resume for a specific job ───────────────────────────────────
@router.post("/generate-ats")
async def generate_ats_resume(
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    uid: uuid.UUID = Depends(get_current_user_id),
):
    """
    Generate an ATS-optimized resume for a specific job.
    Body: { profile: {...}, job_id: str } OR { profile: {...}, job: {...} }
    """
    profile  = payload.get("profile", {})
    job_data = payload.get("job")
    job_uuid: uuid.UUID | None = None

    if not job_data:
        job_id = payload.get("job_id")
        if not job_id:
            raise HTTPException(status_code=400, detail="Provide either job_id or job object")
        try:
            job_uuid = uuid.UUID(job_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid job_id")
        row = (await db.execute(select(VerifiedJob).where(VerifiedJob.id == job_uuid))).scalar_one_or_none()
        if not row:
            raise HTTPException(status_code=404, detail="Job not found")
        job_data = {
            "title": row.title,
            "organization": row.organization,
            "description": row.description,
            "technologies": row.technologies or [],
        }

    result = await _ats_gen.generate_tailored_resume(profile, job_data)

    try:
        history = ResumeHistory(
            user_id=uid,
            job_id=job_uuid,
            job_title=job_data.get("title"),
            organization=job_data.get("organization"),
            ats_score=result.get("ats_score"),
            summary=result.get("summary"),
            bullets=result.get("bullets", []),
            skills_grouped=result.get("skills_grouped", {}),
            pdf_base64=result.get("pdf_base64"),
            docx_base64=result.get("docx_base64"),
        )
        db.add(history)
        await db.flush()
        result["history_id"] = str(history.id)
    except Exception as e:
        logger.warning(f"Failed to save resume history: {e}")

    return result


# ── Download helpers (no auth needed — caller supplies the base64) ─────────────
@router.post("/download-pdf")
async def download_resume_pdf(payload: dict = Body(...)):
    pdf_b64 = payload.get("pdf_base64")
    if not pdf_b64:
        raise HTTPException(status_code=400, detail="pdf_base64 required")
    return Response(
        content=base64.b64decode(pdf_b64),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=ats_resume.pdf"},
    )


@router.post("/download-docx")
async def download_resume_docx(payload: dict = Body(...)):
    docx_b64 = payload.get("docx_base64")
    if not docx_b64:
        raise HTTPException(status_code=400, detail="docx_base64 required")
    return Response(
        content=base64.b64decode(docx_b64),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": "attachment; filename=ats_resume.docx"},
    )


# ── Master resume (no job required) ──────────────────────────────────────────
@router.post("/generate-master")
async def generate_master_resume_endpoint(payload: dict = Body(...)):
    profile = payload.get("profile", {})
    if not profile.get("name"):
        raise HTTPException(status_code=400, detail="profile.name is required")
    return await generate_master_resume(profile)


# ── Cover letter ──────────────────────────────────────────────────────────────
@router.post("/generate-cover-letter")
async def generate_cover_letter(payload: dict = Body(...)):
    profile = payload.get("profile", {})
    job     = payload.get("job", {})
    return await _cl_gen.generate(profile, job)


# ── Premium PDF (career-ops HTML template via Playwright) ─────────────────────
@router.post("/generate-pdf")
async def generate_premium_pdf_endpoint(
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    uid: uuid.UUID = Depends(get_current_user_id),
):
    """
    Render a premium ATS PDF using the career-ops Space Grotesk + DM Sans template.

    Mode 1 — structured data:
      { profile, summary, competency_keywords, experience, projects?, education?,
        certifications?, skills_grouped?, page_format?, lang?, save_to_history? }

    Mode 2 — re-render from saved history:
      { history_id: "<uuid>" }
    """
    from ats_resume_generator.premium_pdf import generate_premium_pdf

    history_id = payload.get("history_id")

    if history_id:
        try:
            hist_uid = uuid.UUID(history_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid history_id")

        record = (
            await db.execute(
                select(ResumeHistory).where(
                    ResumeHistory.id == hist_uid,
                    ResumeHistory.user_id == uid,
                )
            )
        ).scalar_one_or_none()
        if not record:
            raise HTTPException(status_code=404, detail="Resume history not found")

        experience = [{
            "company":  record.organization or "",
            "title":    record.job_title or "",
            "duration": "",
            "bullets":  record.bullets or [],
        }]
        profile = {"name": "Candidate"}
        pdf_result = await generate_premium_pdf(
            profile=profile,
            summary=record.summary or "",
            competency_keywords=list((record.skills_grouped or {}).keys())[:10],
            experience=experience,
            skills_grouped=record.skills_grouped,
        )
        if payload.get("save_to_history", True) and pdf_result.get("pdf_base64"):
            record.pdf_base64 = pdf_result["pdf_base64"]
            await db.flush()
        return {**pdf_result, "history_id": str(hist_uid)}

    # Mode 1 — structured data
    profile = payload.get("profile")
    if not profile or not profile.get("name"):
        raise HTTPException(status_code=400, detail="profile.name is required")
    experience = payload.get("experience", [])
    if not experience:
        raise HTTPException(status_code=400, detail="experience list is required")

    pdf_result = await generate_premium_pdf(
        profile=profile,
        summary=payload.get("summary", ""),
        competency_keywords=payload.get("competency_keywords", []),
        experience=experience,
        projects=payload.get("projects"),
        education=payload.get("education"),
        certifications=payload.get("certifications"),
        skills_grouped=payload.get("skills_grouped"),
        page_format=payload.get("page_format", "a4"),
        lang=payload.get("lang", "en"),
    )

    saved_history_id = None
    if payload.get("save_to_history", True) and pdf_result.get("pdf_base64"):
        try:
            history = ResumeHistory(
                user_id=uid,
                job_title=payload.get("job_title"),
                organization=payload.get("organization"),
                summary=payload.get("summary", ""),
                bullets=[b for exp in experience for b in exp.get("bullets", [])],
                skills_grouped=payload.get("skills_grouped", {}),
                pdf_base64=pdf_result["pdf_base64"],
            )
            db.add(history)
            await db.flush()
            saved_history_id = str(history.id)
        except Exception as e:
            logger.warning(f"Failed to save premium PDF to history: {e}")

    return {**pdf_result, "history_id": saved_history_id}


# ── Resume history ─────────────────────────────────────────────────────────────
@router.get("/history")
async def get_resume_history(
    db: AsyncSession = Depends(get_db),
    uid: uuid.UUID = Depends(get_current_user_id),
    limit: int = 20,
    offset: int = 0,
):
    result = await db.execute(
        select(ResumeHistory)
        .where(ResumeHistory.user_id == uid)
        .order_by(ResumeHistory.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    records = result.scalars().all()
    return [
        {
            "id":           str(r.id),
            "job_title":    r.job_title,
            "organization": r.organization,
            "ats_score":    r.ats_score,
            "summary":      r.summary,
            "bullets":      r.bullets or [],
            "skills_grouped": r.skills_grouped or {},
            "created_at":   r.created_at.isoformat() if r.created_at else None,
        }
        for r in records
    ]


@router.get("/history/{history_id}/download-pdf")
async def download_history_pdf(
    history_id: str,
    db: AsyncSession = Depends(get_db),
    uid: uuid.UUID = Depends(get_current_user_id),
):
    try:
        hist_uid = uuid.UUID(history_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid history ID")

    record = (
        await db.execute(
            select(ResumeHistory).where(
                ResumeHistory.id == hist_uid,
                ResumeHistory.user_id == uid,
            )
        )
    ).scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Resume history not found")
    if not record.pdf_base64:
        raise HTTPException(status_code=404, detail="No PDF available for this entry")

    pdf_bytes = base64.b64decode(record.pdf_base64)
    filename = f"resume_{record.organization or 'job'}_{str(hist_uid)[:8]}.pdf".replace(" ", "_")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.delete("/history/{history_id}")
async def delete_resume_history(
    history_id: str,
    db: AsyncSession = Depends(get_db),
    uid: uuid.UUID = Depends(get_current_user_id),
):
    try:
        hist_uid = uuid.UUID(history_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid history ID")

    record = (
        await db.execute(
            select(ResumeHistory).where(
                ResumeHistory.id == hist_uid,
                ResumeHistory.user_id == uid,
            )
        )
    ).scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Resume history not found")
    await db.delete(record)
    return {"deleted": str(hist_uid)}

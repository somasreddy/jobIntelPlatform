import uuid
import base64
import logging
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Body
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from models.database import VerifiedJob, ResumeHistory
from resume_parser.parser import ResumeParser
from ats_resume_generator.generator import ATSResumeGenerator, generate_master_resume
from cover_letter_generator.generator import CoverLetterGenerator

logger = logging.getLogger(__name__)
router = APIRouter()
_parser = ResumeParser()
_ats_gen = ATSResumeGenerator()
_cl_gen = CoverLetterGenerator()

_DEMO_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


@router.post("/parse")
async def parse_resume(file: UploadFile = File(...)):
    """Parse an uploaded resume PDF/DOCX and extract skills and experience."""
    content = await file.read()
    result = await _parser.parse_document(content, file.filename or "resume.pdf")
    return {
        "filename": file.filename,
        "extracted_skills": result.get("skills", []),
        "frameworks": result.get("frameworks", []),
        "languages": result.get("languages", []),
        "cicd_tools": result.get("cicd_tools", []),
        "experience_years": result.get("experience_years", 0),
    }


@router.post("/generate-ats")
async def generate_ats_resume(
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate an ATS-optimized resume for a specific job.
    Body: { profile: {...}, job_id: str } OR { profile: {...}, job: {...} }
    Returns bullets, ats_score, pdf_base64, docx_base64.
    Auto-saves to resume history.
    """
    profile = payload.get("profile", {})
    job_data = payload.get("job")
    job_uuid = None

    if not job_data:
        job_id = payload.get("job_id")
        if job_id:
            try:
                job_uuid = uuid.UUID(job_id)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid job_id")
            result = await db.execute(
                select(VerifiedJob).where(VerifiedJob.id == job_uuid)
            )
            row = result.scalar_one_or_none()
            if not row:
                raise HTTPException(status_code=404, detail="Job not found")
            job_data = {
                "title": row.title,
                "organization": row.organization,
                "description": row.description,
                "technologies": row.technologies or [],
            }
        else:
            raise HTTPException(
                status_code=400, detail="Provide either job_id or job object"
            )

    result = await _ats_gen.generate_tailored_resume(profile, job_data)

    # Auto-save to resume history
    try:
        history = ResumeHistory(
            user_id=_DEMO_USER_ID,
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


@router.post("/download-pdf")
async def download_resume_pdf(payload: dict = Body(...)):
    """Return PDF bytes for download from a previously generated base64 string."""
    pdf_b64 = payload.get("pdf_base64")
    if not pdf_b64:
        raise HTTPException(status_code=400, detail="pdf_base64 required")
    pdf_bytes = base64.b64decode(pdf_b64)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=ats_resume.pdf"},
    )


@router.post("/download-docx")
async def download_resume_docx(payload: dict = Body(...)):
    """Return DOCX bytes for download."""
    docx_b64 = payload.get("docx_base64")
    if not docx_b64:
        raise HTTPException(status_code=400, detail="docx_base64 required")
    docx_bytes = base64.b64decode(docx_b64)
    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": "attachment; filename=ats_resume.docx"},
    )


@router.post("/generate-master")
async def generate_master_resume_endpoint(payload: dict = Body(...)):
    """
    Generate a complete master ATS resume from the saved profile + resume text.
    No job required. Uses LLM to write summary and parse experience.
    Returns pdf_base64 and docx_base64.
    """
    profile = payload.get("profile", {})
    if not profile.get("name"):
        raise HTTPException(status_code=400, detail="Profile name is required")
    result = await generate_master_resume(profile)
    return result


@router.post("/generate-cover-letter")
async def generate_cover_letter(payload: dict = Body(...)):
    """Generate a personalized cover letter for a job."""
    profile = payload.get("profile", {})
    job = payload.get("job", {})
    result = await _cl_gen.generate(profile, job)
    return result


@router.get("/history")
async def get_resume_history(db: AsyncSession = Depends(get_db)):
    """Get all previously generated resumes for the current user."""
    result = await db.execute(
        select(ResumeHistory)
        .where(ResumeHistory.user_id == _DEMO_USER_ID)
        .order_by(ResumeHistory.created_at.desc())
    )
    records = result.scalars().all()
    return [
        {
            "id": str(r.id),
            "job_title": r.job_title,
            "organization": r.organization,
            "ats_score": r.ats_score,
            "summary": r.summary,
            "bullets": r.bullets or [],
            "skills_grouped": r.skills_grouped or {},
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in records
    ]


@router.get("/history/{history_id}/download-pdf")
async def download_history_pdf(history_id: str, db: AsyncSession = Depends(get_db)):
    """Download a previously generated resume PDF by history ID."""
    try:
        uid = uuid.UUID(history_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid history ID")

    result = await db.execute(
        select(ResumeHistory).where(
            ResumeHistory.id == uid,
            ResumeHistory.user_id == _DEMO_USER_ID,
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Resume history not found")
    if not record.pdf_base64:
        raise HTTPException(status_code=404, detail="No PDF available for this entry")

    pdf_bytes = base64.b64decode(record.pdf_base64)
    filename = f"resume_{record.organization or 'job'}_{str(uid)[:8]}.pdf".replace(" ", "_")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.delete("/history/{history_id}")
async def delete_resume_history(history_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a resume history entry."""
    try:
        uid = uuid.UUID(history_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid history ID")

    result = await db.execute(
        select(ResumeHistory).where(
            ResumeHistory.id == uid,
            ResumeHistory.user_id == _DEMO_USER_ID,
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Resume history not found")
    await db.delete(record)
    return {"deleted": str(uid)}

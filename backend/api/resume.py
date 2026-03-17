import uuid
import base64
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Body
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from models.database import VerifiedJob
from resume_parser.parser import ResumeParser
from ats_resume_generator.generator import ATSResumeGenerator
from cover_letter_generator.generator import CoverLetterGenerator

router = APIRouter()
_parser = ResumeParser()
_ats_gen = ATSResumeGenerator()
_cl_gen = CoverLetterGenerator()


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
    """
    profile = payload.get("profile", {})
    job_data = payload.get("job")

    if not job_data:
        job_id = payload.get("job_id")
        if job_id:
            try:
                uid = uuid.UUID(job_id)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid job_id")
            result = await db.execute(
                select(VerifiedJob).where(VerifiedJob.id == uid)
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


@router.post("/generate-cover-letter")
async def generate_cover_letter(payload: dict = Body(...)):
    """Generate a personalized cover letter for a job."""
    profile = payload.get("profile", {})
    job = payload.get("job", {})
    result = await _cl_gen.generate(profile, job)
    return result

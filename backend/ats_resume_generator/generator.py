import io
import logging

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """You are an expert ATS resume writer specializing in QA/SDET roles.
Rewrite the candidate's experience bullets to precisely mirror the language, keywords,
and technical terminology from the target job description.
Rules:
- Use strong action verbs (Architected, Engineered, Implemented, Led, Reduced, Achieved)
- Include specific metrics where plausible (%, time saved, team size, coverage %)
- Embed the JD's exact tech stack names naturally
- Output exactly 5 bullet points as a JSON array of strings
- Each bullet must be 1-2 sentences max
- Return ONLY the JSON array, no markdown, no preamble"""


async def _generate_bullets(
    profile: dict, job_description: str, tech_stack: list
) -> list:
    try:
        from core.llm import chat
        user_prompt = (
            f"Candidate Role: {profile.get('current_role', 'QA Engineer')}\n"
            f"Experience: {profile.get('experience_years', 5)} years\n"
            f"Known Skills: {', '.join((profile.get('skills') or [])[:10])}\n"
            f"Target Tech Stack: {', '.join(tech_stack[:6])}\n\n"
            f"Job Description (first 800 chars):\n{job_description[:800]}\n\n"
            "Rewrite 5 experience bullets as a JSON array."
        )
        raw = await chat(_SYSTEM_PROMPT, user_prompt, temperature=0.4)
        import json
        clean = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        bullets = json.loads(clean)
        if isinstance(bullets, list):
            return [str(b) for b in bullets[:5]]
    except Exception as e:
        logger.warning(f"LLM bullet generation failed: {e}")

    tech = tech_stack[0] if tech_stack else "automation"
    return [
        f"Architected a {tech} framework from scratch, reducing regression cycle time by 40% and enabling daily CI/CD deployments.",
        f"Integrated end-to-end test suites into Jenkins and GitHub Actions pipelines, preventing 95%+ of critical defects from reaching production.",
        f"Led API contract testing initiative using Postman and REST Assured across 12 microservices, achieving 85% API coverage.",
        f"Mentored a team of 4 junior QA engineers in best practices, improving overall team velocity by 30%.",
        f"Implemented a data-driven test suite for {tech_stack[1] if len(tech_stack) > 1 else 'performance'} scenarios, cutting manual regression effort by 60%.",
    ]


def _build_pdf(profile: dict, job: dict, bullets: list) -> bytes:
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
        from reportlab.lib import colors

        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4,
            leftMargin=2*cm, rightMargin=2*cm, topMargin=1.5*cm, bottomMargin=1.5*cm)
        styles = getSampleStyleSheet()
        story = []

        name_style = ParagraphStyle("Name", parent=styles["Heading1"], fontSize=20, spaceAfter=2,
            textColor=colors.HexColor("#1e293b"))
        section_style = ParagraphStyle("Section", parent=styles["Heading2"], fontSize=10,
            spaceBefore=10, spaceAfter=4, textColor=colors.HexColor("#4f46e5"))
        body_style = ParagraphStyle("Body", parent=styles["Normal"], fontSize=9, leading=13, spaceAfter=4)
        bullet_style = ParagraphStyle("Bullet", parent=styles["Normal"], fontSize=9, leading=13,
            leftIndent=12, spaceAfter=3)

        name = profile.get("name") or "Candidate"
        role = profile.get("current_role", "QA Engineer")
        loc = profile.get("current_location", "")
        exp = profile.get("experience_years", 0)
        skills = profile.get("skills") or []
        frameworks = profile.get("frameworks") or []
        cicd = profile.get("cicd_tools") or []
        certs = profile.get("certifications") or []
        techs = job.get("technologies") or []

        story.append(Paragraph(name, name_style))
        story.append(Paragraph(f"{role} | {loc} | {exp}+ Years Experience", body_style))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#4f46e5")))
        story.append(Spacer(1, 6))

        story.append(Paragraph("PROFESSIONAL SUMMARY", section_style))
        overlap = [t for t in techs if t in skills + frameworks]
        summary = (
            f"Results-driven {role} with {exp}+ years designing scalable automation frameworks. "
            f"Deep expertise in {', '.join((overlap or techs)[:3])}, aligning with "
            f"{job.get('organization', 'the target company')}. Proven track record elevating "
            "quality across CI/CD pipelines and reducing time-to-release."
        )
        story.append(Paragraph(summary, body_style))
        story.append(Spacer(1, 4))

        story.append(Paragraph("CORE TECHNOLOGIES", section_style))
        all_skills = list(dict.fromkeys(skills + frameworks + cicd))
        story.append(Paragraph(" | ".join(all_skills[:18]), body_style))
        story.append(Spacer(1, 4))

        story.append(Paragraph("PROFESSIONAL EXPERIENCE", section_style))
        story.append(Paragraph(f"<b>{role}</b> — Current", body_style))
        for b in bullets:
            story.append(Paragraph(f"• {b}", bullet_style))
        story.append(Spacer(1, 4))

        if certs:
            story.append(Paragraph("CERTIFICATIONS", section_style))
            story.append(Paragraph(" | ".join(certs), body_style))

        doc.build(story)
        return buf.getvalue()
    except Exception as e:
        logger.error(f"PDF build error: {e}")
        return b""


def _build_docx(profile: dict, job: dict, bullets: list) -> bytes:
    try:
        from docx import Document
        from docx.shared import Pt, RGBColor

        doc = Document()
        name = profile.get("name") or "Candidate"
        role = profile.get("current_role", "QA Engineer")
        loc = profile.get("current_location", "")
        exp = profile.get("experience_years", 0)
        skills = profile.get("skills") or []
        frameworks = profile.get("frameworks") or []
        cicd = profile.get("cicd_tools") or []
        certs = profile.get("certifications") or []
        techs = job.get("technologies") or []

        h = doc.add_heading(name, level=1)
        h.runs[0].font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)
        doc.add_paragraph(f"{role}  |  {loc}  |  {exp}+ Years Experience")

        def add_section(title: str):
            p = doc.add_heading(title, level=2)
            p.runs[0].font.color.rgb = RGBColor(0x4F, 0x46, 0xE5)

        add_section("Professional Summary")
        overlap = [t for t in techs if t in skills + frameworks]
        doc.add_paragraph(
            f"Results-driven {role} with {exp}+ years designing scalable automation frameworks. "
            f"Deep expertise in {', '.join((overlap or techs)[:3])}, aligning with "
            f"{job.get('organization', 'the target company')}."
        )

        add_section("Core Technologies")
        all_skills = list(dict.fromkeys(skills + frameworks + cicd))
        doc.add_paragraph("  |  ".join(all_skills[:18]))

        add_section("Professional Experience")
        doc.add_paragraph(f"{role} — Current")
        for b in bullets:
            doc.add_paragraph(b, style="List Bullet")

        if certs:
            add_section("Certifications")
            doc.add_paragraph("  |  ".join(certs))

        buf = io.BytesIO()
        doc.save(buf)
        return buf.getvalue()
    except Exception as e:
        logger.error(f"DOCX build error: {e}")
        return b""


def _estimate_ats_score(profile: dict, tech_stack: list) -> int:
    profile_skills = set(
        s.lower() for s in (
            (profile.get("skills") or [])
            + (profile.get("frameworks") or [])
            + (profile.get("cicd_tools") or [])
        )
    )
    jd_techs = set(t.lower() for t in tech_stack)
    if not jd_techs:
        return 70
    overlap = len(profile_skills & jd_techs)
    raw = int((overlap / len(jd_techs)) * 100)
    return min(95, raw + 35)


class ATSResumeGenerator:
    def __init__(self):
        pass

    async def generate_tailored_resume(self, base_profile: dict, job: dict) -> dict:
        """Uses LLM to rewrite experience bullets to match JD keywords.
        Returns bullets, pdf_base64, docx_base64, and ats_score."""
        import base64
        job_description = job.get("description", "")
        tech_stack = job.get("technologies") or []

        bullets = await _generate_bullets(base_profile, job_description, tech_stack)
        pdf_bytes = _build_pdf(base_profile, job, bullets)
        docx_bytes = _build_docx(base_profile, job, bullets)

        return {
            "bullets": bullets,
            "pdf_base64": base64.b64encode(pdf_bytes).decode() if pdf_bytes else None,
            "docx_base64": base64.b64encode(docx_bytes).decode() if docx_bytes else None,
            "ats_score": _estimate_ats_score(base_profile, tech_stack),
        }

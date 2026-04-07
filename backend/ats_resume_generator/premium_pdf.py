"""
Career-Ops ATS PDF Generator — Premium HTML→PDF via Playwright

Ported from career-ops/generate-pdf.mjs + cv-template.html.
Uses Playwright (Python) to render a premium ATS-optimized CV from HTML.

Design spec (from career-ops/modes/pdf.md):
  - Fonts: Space Grotesk (headings) + DM Sans (body)
  - Single-column, no sidebars (ATS-friendly)
  - Header gradient: cyan → purple
  - Section order: Summary, Competencies, Experience, Projects, Education, Certifications, Skills
"""
import io
import re
import base64
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# HTML Template (inlined from career-ops/templates/cv-template.html)
# Uses Google Fonts CDN instead of local woff2 files for portability.
# ─────────────────────────────────────────────────────────────────────────────
_CV_TEMPLATE = """<!DOCTYPE html>
<html lang="{lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{name} — CV</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  html {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
  body {{
    font-family: 'DM Sans', sans-serif; font-size: 11px; line-height: 1.5;
    color: #1a1a2e; background: #fff; padding: 0; margin: 0;
  }}
  .page {{ width: 100%; max-width: {page_width}; margin: 0 auto; padding: 0; }}

  /* HEADER */
  .header {{ margin-bottom: 16px; }}
  .header h1 {{
    font-family: 'Space Grotesk', sans-serif; font-size: 24px; font-weight: 700;
    color: #1a1a2e; letter-spacing: -0.02em; margin-bottom: 4px;
  }}
  .header-gradient {{
    height: 2px;
    background: linear-gradient(to right, hsl(187, 74%, 32%), hsl(270, 70%, 45%));
    border-radius: 1px; margin-bottom: 8px;
  }}
  .contact-row {{
    display: flex; flex-wrap: wrap; gap: 6px 16px;
    font-size: 10px; color: #555;
  }}
  .contact-row a {{ color: #555; text-decoration: none; }}
  .separator {{ color: #ccc; }}

  /* SECTIONS */
  .section {{ margin-bottom: 14px; }}
  .section-title {{
    font-family: 'Space Grotesk', sans-serif; font-size: 13px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.05em;
    color: hsl(187, 74%, 32%); border-bottom: 1px solid #e5e5e5;
    padding-bottom: 3px; margin-bottom: 8px;
  }}
  .summary-text {{ font-size: 11px; line-height: 1.6; color: #333; }}
  a {{ white-space: nowrap; }}

  /* COMPETENCIES */
  .competencies-grid {{ display: flex; flex-wrap: wrap; gap: 6px; }}
  .competency-tag {{
    font-size: 10px; font-weight: 500; color: hsl(187, 74%, 28%);
    background: hsl(187, 40%, 95%); padding: 3px 10px; border-radius: 3px;
    border: 1px solid hsl(187, 40%, 88%);
  }}

  /* EXPERIENCE */
  .job {{ margin-bottom: 12px; }}
  .job-header {{ display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px; }}
  .job-company {{
    font-family: 'Space Grotesk', sans-serif; font-size: 12px; font-weight: 600;
    color: hsl(270, 70%, 45%);
  }}
  .job-period {{ font-size: 10px; color: #777; white-space: nowrap; }}
  .job-role {{ font-size: 11px; font-weight: 500; color: #444; margin-bottom: 4px; }}
  .job ul {{ padding-left: 16px; margin-top: 4px; }}
  .job li {{ font-size: 10.5px; line-height: 1.5; color: #333; margin-bottom: 2px; }}

  /* PROJECTS */
  .project {{ margin-bottom: 10px; }}
  .project-title {{
    font-family: 'Space Grotesk', sans-serif; font-size: 11px; font-weight: 600;
    color: hsl(270, 70%, 45%);
  }}
  .project-desc {{ font-size: 10.5px; color: #444; margin-top: 2px; }}
  .project-tech {{ font-size: 9.5px; color: #888; margin-top: 2px; }}

  /* EDUCATION / CERTS */
  .edu-item {{ margin-bottom: 6px; }}
  .edu-header {{ display: flex; justify-content: space-between; align-items: baseline; }}
  .edu-title {{ font-weight: 600; font-size: 11px; color: #333; }}
  .edu-org {{ color: hsl(270, 70%, 45%); font-weight: 500; }}
  .edu-year {{ font-size: 10px; color: #777; }}
  .cert-item {{ display: flex; justify-content: space-between; margin-bottom: 4px; }}
  .cert-title {{ font-size: 10.5px; font-weight: 500; color: #333; }}

  /* SKILLS */
  .skills-grid {{ display: flex; flex-wrap: wrap; gap: 4px 12px; }}
  .skill-category {{ font-weight: 600; color: #333; font-size: 10.5px; }}
  .skill-item {{ font-size: 10.5px; color: #444; }}

  .avoid-break {{ break-inside: avoid; }}

  @media print {{
    body {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
    .page {{ padding: 0; }}
  }}
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <h1>{name}</h1>
    <div class="header-gradient"></div>
    <div class="contact-row">
      {contact_html}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Professional Summary</div>
    <div class="summary-text">{summary}</div>
  </div>

  <div class="section">
    <div class="section-title">Core Competencies</div>
    <div class="competencies-grid">{competencies_html}</div>
  </div>

  <div class="section">
    <div class="section-title">Work Experience</div>
    {experience_html}
  </div>

  {projects_section}

  {education_section}

  {certifications_section}

  <div class="section avoid-break">
    <div class="section-title">Skills</div>
    {skills_html}
  </div>
</div>
</body>
</html>"""


def _build_contact_html(profile: dict) -> str:
    """Build the contact row HTML from profile data."""
    parts = []
    email = profile.get("email") or ""
    if email:
        parts.append(f'<span>{email}</span>')
    linkedin = profile.get("linkedin") or profile.get("linkedin_url") or ""
    if linkedin:
        display = re.sub(r'^https?://(www\.)?', '', linkedin).rstrip('/')
        parts.append(f'<a href="{linkedin}">{display}</a>')
    portfolio = profile.get("portfolio") or profile.get("portfolio_url") or ""
    if portfolio:
        display = re.sub(r'^https?://(www\.)?', '', portfolio).rstrip('/')
        parts.append(f'<a href="{portfolio}">{display}</a>')
    location = profile.get("current_location") or profile.get("location") or ""
    if location:
        parts.append(f'<span>{location}</span>')
    return '<span class="separator">|</span>'.join(parts)


def _build_competencies_html(keywords: list[str]) -> str:
    """Build the Core Competencies flex-grid HTML."""
    return " ".join(f'<span class="competency-tag">{kw}</span>' for kw in keywords[:10])


def _build_experience_html(experience: list[dict]) -> str:
    """Build the Work Experience section HTML."""
    blocks = []
    for exp in experience[:6]:
        company = exp.get("company", "")
        role = exp.get("title", exp.get("role", ""))
        period = exp.get("duration", exp.get("period", ""))
        bullets = exp.get("bullets", [])

        bullets_html = "".join(f"<li>{b}</li>" for b in bullets[:6])
        blocks.append(f"""<div class="job avoid-break">
      <div class="job-header">
        <span class="job-company">{company}</span>
        <span class="job-period">{period}</span>
      </div>
      <div class="job-role">{role}</div>
      <ul>{bullets_html}</ul>
    </div>""")
    return "\n".join(blocks)


def _build_projects_html(projects: list[dict]) -> str:
    """Build the Projects section."""
    if not projects:
        return ""
    blocks = []
    for p in projects[:4]:
        name = p.get("name", p.get("title", ""))
        desc = p.get("description", "")
        tech = p.get("tech", p.get("technologies", []))
        tech_str = ", ".join(tech) if isinstance(tech, list) else str(tech)
        blocks.append(f"""<div class="project">
      <span class="project-title">{name}</span>
      <div class="project-desc">{desc}</div>
      <div class="project-tech">Tech: {tech_str}</div>
    </div>""")
    inner = "\n".join(blocks)
    return f"""<div class="section avoid-break">
    <div class="section-title">Projects</div>
    {inner}
  </div>"""


def _build_education_html(education: list[dict]) -> str:
    """Build the Education section."""
    if not education:
        return ""
    blocks = []
    for ed in education[:4]:
        degree = ed.get("degree", "")
        inst = ed.get("institution", "")
        year = ed.get("year", "")
        blocks.append(f"""<div class="edu-item avoid-break">
      <div class="edu-header">
        <span class="edu-title">{degree} <span class="edu-org">— {inst}</span></span>
        <span class="edu-year">{year}</span>
      </div>
    </div>""")
    inner = "\n".join(blocks)
    return f"""<div class="section avoid-break">
    <div class="section-title">Education</div>
    {inner}
  </div>"""


def _build_certifications_html(certs: list[str]) -> str:
    """Build the Certifications section."""
    if not certs:
        return ""
    blocks = []
    for c in certs[:8]:
        blocks.append(f'<div class="cert-item"><span class="cert-title">{c}</span></div>')
    inner = "\n".join(blocks)
    return f"""<div class="section avoid-break">
    <div class="section-title">Certifications</div>
    {inner}
  </div>"""


def _build_skills_html(profile: dict, skills_grouped: dict = None) -> str:
    """Build the Skills section."""
    if skills_grouped:
        rows = []
        for cat, items in skills_grouped.items():
            items_str = ", ".join(items) if isinstance(items, list) else str(items)
            rows.append(f'<div class="skill-item"><span class="skill-category">{cat}:</span> {items_str}</div>')
        return '<div class="skills-grid">' + "".join(rows) + '</div>'

    # Fallback: use profile arrays
    all_skills = []
    for key in ["skills", "frameworks", "languages", "cicd_tools", "ai_tools"]:
        all_skills.extend(profile.get(key) or [])
    tags = " ".join(f'<span class="competency-tag">{s}</span>' for s in all_skills[:20])
    return f'<div class="competencies-grid">{tags}</div>'


def build_premium_html(
    profile: dict,
    summary: str,
    competency_keywords: list[str],
    experience: list[dict],
    projects: list[dict] = None,
    education: list[dict] = None,
    certifications: list[str] = None,
    skills_grouped: dict = None,
    page_format: str = "a4",
    lang: str = "en",
) -> str:
    """Build a complete ATS-optimized HTML resume from structured data."""

    page_width = "210mm" if page_format == "a4" else "8.5in"
    name = profile.get("name", "Candidate")

    html = _CV_TEMPLATE.format(
        lang=lang,
        name=name,
        page_width=page_width,
        contact_html=_build_contact_html(profile),
        summary=summary,
        competencies_html=_build_competencies_html(competency_keywords),
        experience_html=_build_experience_html(experience or []),
        projects_section=_build_projects_html(projects or []),
        education_section=_build_education_html(education or []),
        certifications_section=_build_certifications_html(certifications or []),
        skills_html=_build_skills_html(profile, skills_grouped),
    )
    return html


async def generate_premium_pdf(
    profile: dict,
    summary: str,
    competency_keywords: list[str],
    experience: list[dict],
    projects: list[dict] = None,
    education: list[dict] = None,
    certifications: list[str] = None,
    skills_grouped: dict = None,
    page_format: str = "a4",
    lang: str = "en",
) -> dict:
    """
    Generate a premium ATS PDF using Playwright (Python).
    Returns { html, pdf_base64, page_count, size_kb }.
    """
    html = build_premium_html(
        profile=profile,
        summary=summary,
        competency_keywords=competency_keywords,
        experience=experience,
        projects=projects,
        education=education,
        certifications=certifications,
        skills_grouped=skills_grouped,
        page_format=page_format,
        lang=lang,
    )

    try:
        from playwright.async_api import async_playwright

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            page = await browser.new_page()
            await page.set_content(html, wait_until="networkidle")
            # Wait for Google Fonts to load
            await page.evaluate("() => document.fonts.ready")

            pdf_bytes = await page.pdf(
                format=page_format.upper() if page_format == "a4" else "Letter",
                print_background=True,
                margin={"top": "0.6in", "right": "0.6in", "bottom": "0.6in", "left": "0.6in"},
            )
            await browser.close()

        # Count pages (approximate)
        pdf_str = pdf_bytes.decode("latin-1")
        page_count = len(re.findall(r"/Type\s*/Page[^s]", pdf_str))

        return {
            "html": html,
            "pdf_base64": base64.b64encode(pdf_bytes).decode(),
            "page_count": page_count,
            "size_kb": round(len(pdf_bytes) / 1024, 1),
        }
    except ImportError:
        logger.warning("Playwright not installed — returning HTML only")
        return {
            "html": html,
            "pdf_base64": None,
            "page_count": 0,
            "size_kb": 0,
            "error": "Playwright not installed. Install with: pip install playwright && python -m playwright install chromium",
        }
    except Exception as e:
        logger.error(f"Premium PDF generation failed: {e}")
        return {
            "html": html,
            "pdf_base64": None,
            "page_count": 0,
            "size_kb": 0,
            "error": str(e),
        }

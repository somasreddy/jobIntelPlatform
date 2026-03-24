import io
import re
import logging
import json
from typing import Optional
from core.llm import smart_chat

logger = logging.getLogger(__name__)

# Comprehensive QA/SDET skill taxonomy
KNOWN_SKILLS = {
    "ui_automation": [
        "selenium", "playwright", "cypress", "appium", "webdriverio",
        "robot framework", "katalon", "testcafe",
    ],
    "api_testing": [
        "rest assured", "postman", "supertest", "karate", "soapui",
        "pact", "insomnia", "newman",
    ],
    "performance": [
        "jmeter", "k6", "gatling", "locust", "artillery", "neoload",
    ],
    "languages": [
        "java", "python", "javascript", "typescript", "kotlin", "c#",
        "go", "ruby", "groovy", "scala", "sql",
    ],
    "frameworks": [
        "testng", "junit", "pytest", "cucumber bdd", "cucumber",
        "behave", "jasmine", "mocha", "jest", "rspec",
    ],
    "cicd": [
        "jenkins", "github actions", "gitlab ci", "azure devops", "circleci",
        "travis ci", "bamboo", "teamcity",
    ],
    "cloud": [
        "aws", "azure", "gcp", "docker", "kubernetes", "terraform",
        "helm", "ecs", "lambda",
    ],
    "tools": [
        "jira", "confluence", "git", "maven", "gradle", "npm",
        "sonarqube", "allure", "extent reports",
    ],
}

_EXPERIENCE_PATTERNS = [
    re.compile(r"(\d+)\+?\s*years?\s+of\s+experience", re.I),
    re.compile(r"(\d+)\+?\s*yrs?\s+of\s+experience", re.I),
    re.compile(r"experience\s+of\s+(\d+)\+?\s*years?", re.I),
    re.compile(r"(\d{4})\s*[-–]\s*(present|current|now|\d{4})", re.I),
]


def _extract_text_from_pdf(file_bytes: bytes) -> str:
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            return "\n".join(
                page.extract_text() or "" for page in pdf.pages
            )
    except ImportError:
        pass
    try:
        import PyPDF2
        reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
        return "\n".join(
            page.extract_text() or "" for page in reader.pages
        )
    except Exception as e:
        logger.error(f"PDF parse error: {e}")
        return ""


def _extract_text_from_docx(file_bytes: bytes) -> str:
    try:
        from docx import Document
        doc = Document(io.BytesIO(file_bytes))
        return "\n".join(p.text for p in doc.paragraphs)
    except Exception as e:
        logger.error(f"DOCX parse error: {e}")
        return ""


def _match_skills(text: str) -> dict[str, list[str]]:
    text_lower = text.lower()
    found: dict[str, list[str]] = {cat: [] for cat in KNOWN_SKILLS}
    for category, skills in KNOWN_SKILLS.items():
        for skill in skills:
            if skill.lower() in text_lower:
                found[category].append(skill.title())
    return found


def _estimate_experience(text: str) -> int:
    # Try explicit mentions first
    for pat in _EXPERIENCE_PATTERNS[:3]:
        m = pat.search(text)
        if m:
            return int(m.group(1))

    # Count date ranges (e.g. 2016 – 2024)
    date_range_pat = re.compile(r"(\d{4})\s*[-–]\s*(\d{4}|present|current|now)", re.I)
    years_total = 0
    for m in date_range_pat.finditer(text):
        start = int(m.group(1))
        end_raw = m.group(2).lower()
        end = 2025 if end_raw in ("present", "current", "now") else int(end_raw)
        if 1990 <= start <= 2030 and start <= end:
            years_total += end - start
    if years_total:
        return min(years_total, 30)

    return 0


async def _extract_llm_data(text: str) -> dict:
    """Use LLM to extract structured skills and experience from raw text."""
    system_prompt = """You are a Specialized AI Resume Parsing Engine.
Extract the following from the resume text as a JSON object:
- skills: All technical skills (languages, tools, frameworks, concepts).
- experience_years: Total years of professional experience (integer).
- current_role: Most recent job title.

Return ONLY JSON."""
    try:
        raw = await smart_chat(system_prompt, f"Resume Text:\n{text[:6000]}", temperature=0.1)
        clean = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        data = json.loads(clean)
        return data if isinstance(data, dict) else {}
    except Exception as e:
        logger.warning(f"LLM resume parsing failed: {e}")
        return {}


class ResumeParser:
    def __init__(self):
        pass

    async def parse_document(
        self, file_bytes: bytes, filename: str
    ) -> dict:
        fname_lower = filename.lower()
        if fname_lower.endswith(".pdf"):
            raw_text = _extract_text_from_pdf(file_bytes)
        elif fname_lower.endswith((".docx", ".doc")):
            raw_text = _extract_text_from_docx(file_bytes)
        else:
            raw_text = file_bytes.decode("utf-8", errors="ignore")

        if not raw_text.strip():
            logger.warning(f"No text extracted from {filename}")
            return {
                "skills": [], "frameworks": [], "cicd_tools": [],
                "languages": [], "experience_years": 0, "raw_text": "",
            }

        matched = _match_skills(raw_text)
        experience_years = _estimate_experience(raw_text)
        
        # Merge with LLM data for accuracy
        llm_data = await _extract_llm_data(raw_text)
        
        all_skills = set(
            matched["ui_automation"]
            + matched["api_testing"]
            + matched["performance"]
            + matched["tools"]
            + matched["frameworks"]
            + matched["languages"]
            + matched["cicd"]
            + matched["cloud"]
        )
        # Add LLM discovered skills
        for s in llm_data.get("skills", []):
            if isinstance(s, str): all_skills.add(s.title())
        
        # Prioritize LLM estimate if valid
        final_exp = llm_data.get("experience_years", experience_years)
        if not isinstance(final_exp, (int, float)): final_exp = experience_years

        return {
            "skills": sorted(list(all_skills)),
            "frameworks": matched["frameworks"], # Keep for granular UI
            "languages": matched["languages"],
            "cicd_tools": matched["cicd"] + matched["cloud"],
            "experience_years": int(final_exp),
            "current_role": llm_data.get("current_role", "Software Engineer"),
            "raw_text": raw_text[:5000],
        }

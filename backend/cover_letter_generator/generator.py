import logging

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """You are an expert career coach writing highly personalized cover letters
for QA/SDET professionals. Write a compelling, concise cover letter (3 paragraphs, ~200 words)
that mirrors the job description language. Do not use generic phrases like "I am a team player".
Focus on specific technical achievements and alignment with the company's engineering culture.
Return only the cover letter text, no subject line, no sign-off instructions."""


class CoverLetterGenerator:
    def __init__(self):
        pass

    async def generate(self, profile: dict, job: dict) -> dict:
        """Uses LLM to draft a highly personalized cover letter."""
        name = profile.get("name", "Candidate")
        role = profile.get("current_role", "QA Engineer")
        exp = profile.get("experience_years", 5)
        skills = (profile.get("skills") or [])[:4]
        job_title = job.get("title", "the role")
        org = job.get("organization", "your company")
        jd = job.get("description", "")
        techs = (job.get("technologies") or [])[:3]

        try:
            from core.llm import chat
            user_prompt = (
                f"Candidate: {name}, {role}, {exp} years exp, skills: {', '.join(skills)}\n"
                f"Target role: {job_title} at {org}\n"
                f"Key technologies required: {', '.join(techs)}\n"
                f"Job Description excerpt: {jd[:600]}\n\n"
                "Write the cover letter body (3 paragraphs, ~200 words)."
            )
            content = await chat(_SYSTEM_PROMPT, user_prompt, temperature=0.6)
        except Exception as e:
            logger.warning(f"LLM cover letter generation failed: {e}")
            content = (
                f"Dear Hiring Manager,\n\n"
                f"I am writing to express my strong interest in the {job_title} position at {org}. "
                f"With {exp} years of experience architecting resilient QA automation frameworks—"
                f"particularly using {', '.join(techs)}—my background aligns precisely with your "
                f"engineering culture.\n\n"
                f"In my current role as {role}, I have built end-to-end automation pipelines that "
                f"accelerate release cycles without compromising quality. My hands-on experience with "
                f"{', '.join(skills[:2])} enables me to deliver measurable improvements in coverage "
                f"and defect prevention from day one.\n\n"
                f"I am drawn to {org} because of your commitment to engineering excellence. "
                f"I look forward to discussing how I can contribute to your quality mission.\n\n"
                f"Best regards,\n{name}"
            )

        return {"content": content}

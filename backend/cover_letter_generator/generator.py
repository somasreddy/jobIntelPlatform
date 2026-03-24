import logging

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """You are an expert career coach writing highly personalized cover letters for ANY role and domain.
Write a compelling, concise cover letter (3 paragraphs, ~200 words) that mirrors the job description language.
Rules:
- Do NOT use generic phrases like "I am a team player" or "I am a quick learner".
- Mirror the exact terminology from the job description.
- Paragraph 1: Hook — specific achievement or insight that shows you understand their problem.
- Paragraph 2: Proof — 1-2 quantified accomplishments directly relevant to this role's requirements.
- Paragraph 3: Close — why this company/role specifically, confident ask for a conversation.
- Use the candidate's full profile: skills, AI tools, certifications, years of experience.
Return only the cover letter body text. No subject line, no sign-off instructions."""


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
            from core.llm import smart_chat
            all_skills = (
                (profile.get("skills") or [])
                + (profile.get("frameworks") or [])
                + (profile.get("languages") or [])
                + (profile.get("ai_tools") or [])
            )
            user_prompt = (
                f"Candidate: {name}, {role}, {exp} years exp\n"
                f"All Skills & Tools: {', '.join(all_skills[:20])}\n"
                f"Certifications: {', '.join(profile.get('certifications') or [])}\n"
                f"Resume summary: {profile.get('base_resume_text', '')[:400]}\n"
                f"Target role: {job_title} at {org}\n"
                f"Key technologies required: {', '.join(techs)}\n"
                f"Full Job Description:\n{jd[:2000]}\n\n"
                "Write the cover letter body (3 paragraphs, ~200 words)."
            )
            content = await smart_chat(_SYSTEM_PROMPT, user_prompt, temperature=0.6, task_type="cover_letter", cache_ttl=0)
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

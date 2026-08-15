import logging

logger = logging.getLogger(__name__)

# Delimiter the LLM is instructed to emit between the letter body and its own
# explanation of the choices it made. Kept out-of-band (after the marker)
# rather than as JSON so a model that ignores formatting can't corrupt the
# letter body itself — worst case, `_split_rationale` just finds no marker
# and the whole reply becomes the letter (today's exact behaviour), so this
# is purely additive.
_RATIONALE_MARKER = "---RATIONALE---"

_SYSTEM_PROMPT = f"""You are an expert career coach writing highly personalized cover letters for ANY role and domain.
Write a compelling, concise cover letter (3 paragraphs, ~200 words) that mirrors the job description language.
Rules:
- Do NOT use generic phrases like "I am a team player" or "I am a quick learner".
- Mirror the exact terminology from the job description.
- Paragraph 1: Hook — specific achievement or insight that shows you understand their problem.
- Paragraph 2: Proof — 1-2 quantified accomplishments directly relevant to this role's requirements.
- Paragraph 3: Close — why this company/role specifically, confident ask for a conversation.
- Use the candidate's full profile: skills, AI tools, certifications, years of experience.

After the letter, on its own line, write exactly: {_RATIONALE_MARKER}
Then list 2-4 short bullet points (each starting with "- ") explaining SPECIFIC
choices you made for THIS letter — which JD requirement/phrase you mirrored,
which candidate achievement you led with and why it fits this role, and any
tone/structure choice tied to this specific company. Ground each point in
something concrete from the JD or profile, not generic cover-letter advice.

Return only the letter body, the marker line, then the rationale bullets.
No subject line, no sign-off instructions, nothing before the letter."""


def _split_rationale(raw: str) -> tuple[str, list[str]]:
    """Split the LLM's raw reply into (letter_body, rationale_bullets).

    Falls back to treating the entire reply as the letter body with an empty
    rationale list if the marker is missing — e.g. a weaker model ignored the
    instruction. That fallback exactly matches this function's pre-rationale
    behaviour, so nothing regresses when the marker isn't present.
    """
    if _RATIONALE_MARKER in raw:
        letter_part, rationale_part = raw.split(_RATIONALE_MARKER, 1)
        bullets = [
            line.strip(" -•\t")
            for line in rationale_part.strip().splitlines()
            if line.strip(" -•\t")
        ]
        return letter_part.strip(), bullets
    return raw.strip(), []


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
            raw_content = await smart_chat(_SYSTEM_PROMPT, user_prompt, temperature=0.6, task_type="cover_letter", cache_ttl=0)
            content, rationale = _split_rationale(raw_content)
            if not content:
                raise ValueError("Empty cover letter body from LLM")
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
            rationale = [
                "The AI personalization call was unavailable, so this is a generic "
                "template rather than one explained/tailored to this specific job.",
            ]

        return {"content": content, "rationale": rationale}

import logging

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """You are an expert career coach crafting concise LinkedIn outreach messages
for QA/SDET professionals reaching out to recruiters. Write a short, direct message (4-5 sentences, <100 words).
- Reference the specific role and company
- Mention 1-2 relevant technical achievements with metrics
- End with a specific low-friction ask (10-minute call)
- Tone: professional, confident, not sycophantic
Return only the message body, no subject line."""


class RecruiterEngine:
    def __init__(self):
        pass

    async def generate_outreach_message(
        self, job: dict, profile: dict
    ) -> dict:
        """Generates a personalized LinkedIn outreach message using LLM."""
        recruiter_name = job.get("recruiter_name", "Recruiter")
        first_name = recruiter_name.split()[0] if recruiter_name else "Recruiter"
        job_title = job.get("title", "the role")
        org = job.get("organization", "your company")
        techs = (job.get("technologies") or [])[:3]
        name = profile.get("name", "Candidate")
        role = profile.get("current_role", "QA Engineer")
        exp = profile.get("experience_years", 5)

        try:
            from core.llm import chat
            user_prompt = (
                f"Recruiter first name: {first_name}\n"
                f"Company: {org}\n"
                f"Role: {job_title}\n"
                f"Candidate: {name}, {role}, {exp} years exp\n"
                f"Tech stack required: {', '.join(techs)}\n\n"
                "Write the outreach message body (max 100 words)."
            )
            message = await chat(_SYSTEM_PROMPT, user_prompt, temperature=0.5)
        except Exception as e:
            logger.warning(f"LLM outreach generation failed: {e}")
            message = (
                f"Hi {first_name},\n\n"
                f"I saw that {org} is hiring for a {job_title}. "
                f"Given my {exp}+ years building automation frameworks using {', '.join(techs)}, "
                f"I believe I would be a strong fit. In my current role as {role}, I recently "
                f"reduced regression cycles by 40% using a similar tech stack.\n\n"
                f"I've applied via the portal but wanted to connect directly. "
                f"Would you be open to a quick 10-minute chat this week?\n\n"
                f"Thanks,\n{name}\n{role}"
            )

        return {
            "recruiter_name": recruiter_name,
            "recruiter_linkedin": job.get("recruiter_linkedin"),
            "message": message,
        }

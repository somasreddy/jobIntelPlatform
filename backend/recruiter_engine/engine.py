import logging

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """You are an expert career coach crafting highly personalized LinkedIn outreach messages
for professionals across ANY domain and role reaching out to recruiters and hiring managers.
Write a short, direct message (4-5 sentences, <100 words).
Rules:
- Reference the specific role and company
- Mention 1-2 relevant achievements with metrics from the candidate's background
- Use the candidate's actual skills and domain — not generic phrases
- End with a specific low-friction ask (10-minute call or quick chat)
- Tone: confident, professional, not sycophantic
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
        techs = (job.get("technologies") or [])[:5]
        jd_snippet = (job.get("description") or "")[:500]
        name = profile.get("name", "Candidate")
        role = profile.get("current_role", "Professional")
        exp = profile.get("experience_years", 5)
        all_skills = (
            (profile.get("skills") or [])
            + (profile.get("frameworks") or [])
            + (profile.get("ai_tools") or [])
        )

        try:
            from core.llm import smart_chat
            user_prompt = (
                f"Recruiter first name: {first_name}\n"
                f"Company: {org}\n"
                f"Role: {job_title}\n"
                f"Candidate: {name}, {role}, {exp} years exp\n"
                f"Candidate's key skills: {', '.join(all_skills[:10])}\n"
                f"Tech/keywords from JD: {', '.join(techs)}\n"
                f"JD context: {jd_snippet}\n\n"
                "Write the outreach message body (max 100 words). Make it specific to this candidate's background."
            )
            message = await smart_chat(_SYSTEM_PROMPT, user_prompt, temperature=0.5, task_type="outreach", cache_ttl=0)
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

import json
import logging
from typing import List, Dict, Any
from core.llm import smart_chat, chat

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """You are an expert AI Interview Coach and Senior Technical Recruiter.
Generate highly personalized, challenging, and relevant interview questions for ANY role and industry.
Base every question on the candidate's actual profile AND the specific job description provided.

Generate a mix of:
1. Behavioral questions (STAR format) rooted in the JD's real requirements.
2. Role-specific technical/domain questions using the exact JD terminology and tech/tools.
3. Situational/Scenario questions based on the real challenges mentioned in the JD.
4. Leadership/Ownership questions (only if candidate has >5 years experience).
5. At least 2 "trap" questions that test self-awareness or common blind spots for this role.

For each question, provide:
- question: The exact interview question.
- type: "behavioral" | "technical" | "situational" | "leadership" | "trap".
- difficulty: "Easy" | "Medium" | "Hard".
- domain: The specific area tested (e.g., "System Design", "Data Analysis", "Stakeholder Management").
- hint: What the interviewer is really probing for — not obvious.
- keyPoints: 3-4 things the candidate MUST mention in a strong answer.
- starTemplate: (For behavioral) Situation/Task/Action/Result outline tailored to candidate's background.
- strongAnswer: Natural, human-sounding model answer using the candidate's actual background.

Output exactly 8-10 questions as a JSON object with a "questions" key.
Return ONLY valid JSON."""

_MOCK_INTERVIEWER_SYSTEM = """You are a tough but fair Senior Technical Interviewer conducting a live mock interview.
Your job is to:
1. Ask one question at a time based on the candidate's profile and target role.
2. After the candidate answers, give brief, specific feedback (2-3 sentences): what was strong, what was missing.
3. Then ask the NEXT question that builds on or pivots from the previous answer.
4. Keep a natural interview flow — start easy, ramp up difficulty.
5. After 6-8 exchanges, wrap up with: "Thank you — that concludes our interview."

Respond in this JSON format:
{
  "feedback": "Brief feedback on their last answer (empty string for first message)",
  "next_question": "Your next interview question",
  "question_type": "behavioral|technical|situational|leadership",
  "difficulty": "Easy|Medium|Hard",
  "is_complete": false
}
Return ONLY valid JSON."""


class InterviewCoachService:
    def __init__(self):
        pass

    async def generate_questions(
        self,
        profile: Dict[str, Any],
        target_role: str,
        target_company: str = "",
        job_description: str = "",
    ) -> Dict[str, Any]:
        """Generate a tailored set of interview questions using LLM."""
        exp_years = profile.get("experience_years", 0)
        all_skills = (
            (profile.get("skills") or [])
            + (profile.get("frameworks") or [])
            + (profile.get("languages") or [])
            + (profile.get("cicd_tools") or [])
            + (profile.get("ai_tools") or [])
        )

        user_prompt = (
            f"Candidate Profile:\n"
            f"- Current Role: {profile.get('current_role', 'Professional')}\n"
            f"- Experience: {exp_years} years\n"
            f"- All Skills & Tools: {', '.join(all_skills[:20])}\n"
            f"- Certifications: {', '.join(profile.get('certifications') or [])}\n"
            f"- Resume Context: {profile.get('base_resume_text', profile.get('resumeText', ''))[:600]}\n\n"
            f"Target Context:\n"
            f"- Target Role: {target_role}\n"
            f"- Target Company: {target_company}\n\n"
            f"Job Description:\n{job_description[:2500] if job_description else '(not provided)'}\n\n"
            "Generate 8-10 personalized interview questions in the specified JSON format."
        )

        try:
            raw_response = await smart_chat(
                system_prompt=_SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.6,
                task_type="interview",
                cache_ttl=3600,
            )
            clean_json = raw_response.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
            data = json.loads(clean_json)
            if "questions" in data:
                for idx, q in enumerate(data["questions"]):
                    if "id" not in q:
                        q["id"] = f"gen_{idx}"
            return data
        except Exception as e:
            logger.error(f"Error generating interview questions: {e}")
            return {"questions": [], "error": str(e)}

    async def conduct_mock_interview(
        self,
        profile: Dict[str, Any],
        target_role: str,
        target_company: str,
        conversation_history: List[Dict[str, str]],
    ) -> Dict[str, Any]:
        """
        Conducts a live mock interview turn-by-turn.
        conversation_history: list of {role: "user"|"assistant", content: str}
        Returns: {feedback, next_question, question_type, difficulty, is_complete}
        """
        skills = profile.get("skills") or []
        exp_years = profile.get("experience_years", 0)

        # Build context message
        context = (
            f"Candidate: {profile.get('current_role', 'Engineer')}, {exp_years} yrs exp, "
            f"skills: {', '.join(skills[:8])}\n"
            f"Target: {target_role} at {target_company}\n"
            f"Turn count: {len([m for m in conversation_history if m['role'] == 'user'])}"
        )

        # Build the prompt from history
        history_text = ""
        for msg in conversation_history[-8:]:  # last 8 turns max
            role_label = "Candidate" if msg["role"] == "user" else "Interviewer"
            history_text += f"{role_label}: {msg['content']}\n\n"

        user_prompt = f"Context:\n{context}\n\nConversation so far:\n{history_text}\nRespond as the interviewer."

        try:
            raw = await chat(
                system_prompt=_MOCK_INTERVIEWER_SYSTEM,
                user_prompt=user_prompt,
                temperature=0.7,
                cache_ttl=0,  # always fresh for live conversation
            )
            clean = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
            return json.loads(clean)
        except Exception as e:
            logger.error(f"Mock interview turn failed: {e}")
            return {
                "feedback": "",
                "next_question": "Tell me about a challenging bug you had to track down. Walk me through your approach.",
                "question_type": "behavioral",
                "difficulty": "Medium",
                "is_complete": False,
            }

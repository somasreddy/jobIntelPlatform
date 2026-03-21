import json
import logging
from typing import List, Dict, Any
from core.llm import chat

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """You are an expert AI Interview Coach and Senior Technical Recruiter.
Your goal is to generate highly personalized, challenging, and relevant interview questions for a candidate based on their profile and the target job/role.

Generate a mix of:
1. Behavioral questions (STAR format expected).
2. Role-specific technical questions (focused on the candidate's stack and JD requirements).
3. Situational/Scenario-based questions.
4. Leadership/Ownership questions (if candidate has >5 years experience).

For each question, provide:
- question: The text of the question.
- type: "behavioral" | "technical" | "situational" | "leadership".
- difficulty: "Easy" | "Medium" | "Hard".
- domain: The technical or functional area (e.g., "UI Automation", "System Design", "Product Sense").
- hint: A coaching tip on what the interviewer is looking for.
- keyPoints: A list of 3-4 key points the candidate should cover.
- starTemplate: (For behavioral) A brief Situation/Task/Action/Result outline tailored to the candidate's experience.

Output exactly 8-10 questions as a JSON object with a "questions" key containing the array.
Return ONLY valid JSON."""

class InterviewCoachService:
    def __init__(self):
        pass

    async def generate_questions(self, profile: Dict[str, Any], target_role: str, target_company: str = "") -> Dict[str, Any]:
        """
        Generate a tailored set of interview questions using LLM.
        """
        exp_years = profile.get("experience_years", 0)
        skills = profile.get("skills") or []
        frameworks = profile.get("frameworks") or []
        
        user_prompt = (
            f"Candidate Profile:\n"
            f"- Role: {profile.get('current_role', 'Engineer')}\n"
            f"- Experience: {exp_years} years\n"
            f"- Skills: {', '.join(skills)}\n"
            f"- Frameworks: {', '.join(frameworks)}\n"
            f"- Resume Context: {profile.get('resumeText', '')[:500]}\n\n"
            f"Target Context:\n"
            f"- Target Role: {target_role}\n"
            f"- Target Company: {target_company}\n\n"
            "Generate 8-10 personalized interview questions in the specified JSON format."
        )

        try:
            raw_response = await chat(
                system_prompt=_SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.6
            )
            
            # Clean and parse JSON
            clean_json = raw_response.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
            data = json.loads(clean_json)
            
            # Ensure each question has a unique ID for the frontend
            if "questions" in data:
                for idx, q in enumerate(data["questions"]):
                    if "id" not in q:
                        q["id"] = f"gen_{idx}"
            
            return data
        except Exception as e:
            logger.error(f"Error generating interview questions: {e}")
            return {"questions": [], "error": str(e)}

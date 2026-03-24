"""
Salary Negotiation Coach — LLM-powered compensation negotiation strategy.
Generates counter-offer rationale, talking points, and email templates.
"""
import json
import logging

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """You are a world-class compensation negotiation expert with 15+ years helping
software engineers and QA/SDET professionals negotiate higher salaries at top tech companies.

Given a job offer and candidate context, produce a complete negotiation strategy.

Return ONLY a JSON object with this structure:
{
  "market_assessment": "2-sentence assessment of whether the offer is fair, low, or high vs. market",
  "recommended_counter": {
    "amount": integer (recommended counter-offer amount),
    "currency": "USD",
    "rationale": "Why this specific number is justified"
  },
  "talking_points": [
    "Specific, confident talking point with data/evidence"
  ],
  "negotiation_script": "A natural, confident 3-4 sentence verbal script for the negotiation call",
  "email_template": "A complete, professional counter-offer email (subject line + body)",
  "red_flags": ["Any concerning aspects of the offer to address"],
  "additional_levers": ["Non-salary items to negotiate: equity, signing bonus, remote days, PTO, etc."],
  "walk_away_advice": "When/if to walk away from this offer"
}

Be specific with numbers. Be confident but professional. Never suggest being aggressive or unprofessional."""


class NegotiationCoach:
    def __init__(self):
        pass

    async def strategize(
        self,
        offered_salary: int,
        currency: str,
        role: str,
        company: str,
        location: str,
        experience_years: int,
        current_salary: int | None = None,
        competing_offers: list | None = None,
        skills: list | None = None,
        notes: str = "",
    ) -> dict:
        """Generate a full salary negotiation strategy."""
        from core.llm import smart_chat

        competing_str = ""
        if competing_offers:
            competing_str = f"\nCompeting Offers: {json.dumps(competing_offers)}"

        user_prompt = (
            f"Job Offer Details:\n"
            f"- Role: {role}\n"
            f"- Company: {company}\n"
            f"- Location: {location}\n"
            f"- Offered Salary: {offered_salary:,} {currency}/year\n"
            f"- Candidate Experience: {experience_years} years\n"
            f"- Current Salary: {current_salary:,} {currency}/year\n" if current_salary else ""
            f"- Key Skills: {', '.join((skills or [])[:10])}\n"
            f"{competing_str}\n"
            f"Additional Context: {notes}\n\n"
            "Generate a complete negotiation strategy with specific numbers and scripts."
        )

        try:
            raw = await smart_chat(
                _SYSTEM_PROMPT, user_prompt,
                temperature=0.4,
                task_type="negotiation",
                cache_ttl=0,
            )
            clean = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
            return json.loads(clean)
        except Exception as e:
            logger.error(f"Negotiation coach failed: {e}")
            # Meaningful fallback
            counter = int(offered_salary * 1.15)
            return {
                "market_assessment": f"The offer of {offered_salary:,} {currency} should be evaluated against current market rates for {role} in {location}.",
                "recommended_counter": {
                    "amount": counter,
                    "currency": currency,
                    "rationale": f"A 15% increase is standard for candidates with {experience_years}+ years of experience.",
                },
                "talking_points": [
                    f"My {experience_years} years of specialized experience in {', '.join((skills or ['QA automation'])[:3])} directly aligns with this role's requirements.",
                    "I've researched market rates for this role and believe a higher base is appropriate.",
                    "I'm genuinely excited about this opportunity and want to find a number that works for both of us.",
                ],
                "negotiation_script": (
                    f"Thank you so much for the offer — I'm genuinely excited about joining {company}. "
                    f"Based on my {experience_years} years of experience and current market data, "
                    f"I was hoping we could get closer to {counter:,} {currency}. "
                    "Is there flexibility on the base compensation?"
                ),
                "email_template": (
                    f"Subject: Re: Offer for {role} — Excited & Looking to Align\n\n"
                    f"Hi [Hiring Manager],\n\n"
                    f"Thank you for the offer for the {role} position at {company}. "
                    f"I'm very excited about the team and opportunity.\n\n"
                    f"After reviewing the offer and researching current market rates for {role} in {location}, "
                    f"I'd like to respectfully request a base salary of {counter:,} {currency}. "
                    f"This reflects my {experience_years} years of specialized experience and the value I'll bring.\n\n"
                    "I'm flexible on timing and open to discussing the total compensation package. "
                    "Looking forward to finding a number that works for both of us.\n\n"
                    "Best regards,\n[Your Name]"
                ),
                "red_flags": [],
                "additional_levers": ["Signing bonus", "Remote work flexibility", "Additional PTO", "Professional development budget", "Equity/stock options"],
                "walk_away_advice": f"If they cannot move above {int(offered_salary * 1.05):,} {currency}, evaluate whether the role offers significant career growth to compensate.",
            }

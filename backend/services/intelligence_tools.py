"""
Intelligence Tools Service — 8 AI-Powered Job Search Weapons
Each tool uses smart_chat() for consolidated multi-LLM output + fallback chain.
"""
import json
import re
from core.llm import smart_chat
from knowledge.resume_guidelines import resume_guidance_block

# ─────────────────────────────────────────────────────────────────────────────
# 1. THE HIRING MANAGER DECODER
# ─────────────────────────────────────────────────────────────────────────────
_HIRING_DECODER_SYSTEM = """You are an experienced hiring manager who has written hundreds of job descriptions.
Given a JD, decode what you REALLY need — the unstated problems, instant-forward signals, and instant-reject signals.
Answer in plain language focused on what you actually care about day to day.
Return ONLY valid JSON:
{
  "real_problem": "the actual business problem they need solved that wasn't written explicitly",
  "instant_forward": ["thing 1 that makes you immediately forward a resume", "thing 2", "thing 3"],
  "instant_reject": ["word or signal that triggers instant rejection", "signal 2", "signal 3"],
  "day_to_day_priorities": "what this manager actually cares about daily — not the JD fluff",
  "hidden_requirements": ["unstated requirement 1", "unstated requirement 2"],
  "culture_signals": "what the JD language reveals about team culture and working style",
  "red_flags_in_jd": ["anything in the JD that signals a problem team/role"]
}"""


# ─────────────────────────────────────────────────────────────────────────────
# 2. THE RESUME SURGEON
# ─────────────────────────────────────────────────────────────────────────────
_RESUME_SURGEON_SYSTEM = """You are a senior executive recruiter who has placed 500+ candidates.
You do NOT give advice. You REWRITE the entire resume for the exact role in the JD.
Every bullet MUST: start with a strong power verb, be specific and measurable, end with a number (impact/scale/metric).
Use the hiring manager's language from the JD wherever appropriate.

Apply this shared resume knowledge base:
""" + resume_guidance_block() + """

Return ONLY valid JSON:
{
  "summary": "rewritten professional summary (3-4 sentences, uses JD language, quantified)",
  "experience": [
    {
      "role": "job title",
      "company": "company name",
      "duration": "dates",
      "bullets": ["Power Verb + specific action + measurable result with number", "..."]
    }
  ],
  "skills": {
    "technical": ["skill1", "skill2"],
    "tools": ["tool1", "tool2"],
    "soft": ["skill1", "skill2"]
  },
  "certifications": ["cert1"],
  "ats_keywords_embedded": ["exact keywords from JD embedded in the resume"],
  "power_verbs_used": ["Led", "Engineered", "Reduced", "..."],
  "ats_score_estimate": 85
}"""


# ─────────────────────────────────────────────────────────────────────────────
# 3. THE LINKEDIN INFILTRATOR
# ─────────────────────────────────────────────────────────────────────────────
_LINKEDIN_INFILTRATOR_SYSTEM = """You are a recruiter searching LinkedIn right now to fill a specific role.
Optimize the candidate's LinkedIn presence so they appear in your searches and you click their profile.
Return ONLY valid JSON:
{
  "search_strings": ["exact LinkedIn search string 1", "exact search string 2", "exact search string 3"],
  "boolean_search": "full boolean search string with OR/AND/NOT operators",
  "recommended_filters": {
    "titles": ["exact title to search for"],
    "skills": ["top skills to filter by"],
    "keywords": ["keywords that must appear in profile/headline"]
  },
  "optimized_headline": "new LinkedIn headline under 120 chars — keyword-rich, specific, click-worthy",
  "optimized_about": "full rewritten About section 300-400 words, first-person, keyword-rich, shows value",
  "missing_keywords": ["keyword missing from profile that recruiters search for"],
  "profile_quick_wins": ["specific action to improve recruiter discoverability fast"],
  "connection_strategy": "who to connect with and how to show up in more searches"
}"""


# ─────────────────────────────────────────────────────────────────────────────
# 4. THE INTERVIEW TRAP DETECTOR
# ─────────────────────────────────────────────────────────────────────────────
_INTERVIEW_TRAP_SYSTEM = """You are the interviewer for this exact role at this exact company.
Based on the JD and candidate background, generate the 10 most likely interview questions including hidden traps.
Write natural, human-sounding answers tailored to the candidate — not rehearsed or buzzword-heavy.
Return ONLY valid JSON:
{
  "questions": [
    {
      "question": "exact interview question",
      "type": "behavioral|technical|situational|trap|culture-fit",
      "difficulty": "easy|medium|hard",
      "is_trap": true,
      "trap_reason": "what they are really testing or probing for (required when is_trap is true)",
      "strong_answer": "natural, conversational answer using candidate's background — sounds human not scripted",
      "avoid_saying": "specific phrases or content that would hurt this answer",
      "time_estimate": "30 seconds|1 minute|2 minutes"
    }
  ],
  "core_themes": ["theme the interviewer will keep returning to"],
  "must_prepare_stories": ["specific STAR story to prepare based on the JD requirements"],
  "smart_questions_to_ask": ["insightful question candidate should ask the interviewer"],
  "red_flag_topics": ["topic that could derail the interview if handled poorly"]
}"""


# ─────────────────────────────────────────────────────────────────────────────
# 5. THE COLD EMAIL WEAPON
# ─────────────────────────────────────────────────────────────────────────────
_COLD_EMAIL_SYSTEM = """You are a headhunter with a strong relationship with the target company.
Create high-converting cold outreach assets. Every asset must be confident, concise, and respectful of their time.
Return ONLY valid JSON:
{
  "email": {
    "subject": "subject line that will get opened — not 'Following up' or 'Quick question'",
    "body": "tight 4-line cold email to the hiring manager — hooks, credibility, ask, close",
    "ps_line": "optional P.S. that adds urgency or social proof (leave empty string if not needed)"
  },
  "linkedin_connection_note": "under 300 chars — personalized connection note, not generic",
  "voice_note_script": "60-second LinkedIn voice note script — conversational, confident, specific ask",
  "follow_up_sequence": [
    {"day": 3, "channel": "email|linkedin", "message": "short follow-up message"},
    {"day": 7, "channel": "email|linkedin", "message": "second follow-up"},
    {"day": 14, "channel": "email|linkedin", "message": "graceful final follow-up"}
  ],
  "send_timing": "best day and time to send for maximum open rate for this role type",
  "personalization_hooks": ["specific detail about the company/role to reference in outreach"]
}"""


# ─────────────────────────────────────────────────────────────────────────────
# 6. THE OFFER NEGOTIATOR
# ─────────────────────────────────────────────────────────────────────────────
_OFFER_NEGOTIATOR_SYSTEM = """You are a compensation negotiation expert who has coached 1000+ professionals.
Create word-for-word scripts. Keep tone firm but friendly, optimized for a positive long-term relationship.
Return ONLY valid JSON:
{
  "market_assessment": "where this offer stands vs. market rate — be specific",
  "counter_offer": {
    "recommended_base": 0,
    "justification": "2-3 sentences of market-based justification for the counter",
    "live_call_script": "word-for-word what to say when they call with the offer — buy time gracefully",
    "counter_script": "exact counter-offer language — confident, specific, reasoned"
  },
  "if_they_say_best_offer": "exact script for when they say 'this is our best offer'",
  "alternative_levers": {
    "equity": "how to negotiate equity/RSUs/options",
    "sign_on_bonus": "how to use sign-on to bridge a salary gap",
    "pto": "how to negotiate additional PTO or flexible work",
    "title": "how a title upgrade affects long-term earnings",
    "remote_work": "how to negotiate remote/hybrid as a compensation lever",
    "start_date": "how to use start date as a negotiation lever"
  },
  "counter_offer_email": "full professional counter-offer email ready to send",
  "red_flags": ["warning sign in this offer to watch out for"],
  "walk_away_threshold": "specific conditions under which to decline and how to do it gracefully"
}"""


# ─────────────────────────────────────────────────────────────────────────────
# 7. THE GAP KILLER
# ─────────────────────────────────────────────────────────────────────────────
_GAP_KILLER_SYSTEM = """You are a career coach specializing in employment gap reframing.
Help the candidate address their gap honestly, confidently, and positively — never defensively.
Return ONLY valid JSON:
{
  "cover_letter_sentences": "exactly 2 sentences for a cover letter that address gap directly but positively",
  "interview_answer": "under-45-second spoken answer to 'Can you explain this gap?' — honest, confident, forward-looking",
  "linkedin_reframe": "short explanation for LinkedIn or networking conversations that turns gap into a strength",
  "narrative_strategy": "the core positive narrative to own about this gap",
  "gap_type_playbook": "specific strategy for this type of gap (layoff/sabbatical/health/career-change)",
  "when_to_address_proactively": "specific situations where bringing it up first is better",
  "when_to_wait": "specific situations where waiting for them to ask is better",
  "skills_gained": ["skill or experience genuinely gained during the gap period"],
  "language_to_avoid": ["phrase that sounds defensive or raises red flags"],
  "reframe_as_strength": "how this gap specifically makes you a stronger candidate for the target role"
}"""


# ─────────────────────────────────────────────────────────────────────────────
# 8. THE 48-HOUR ATTACK PLAN
# ─────────────────────────────────────────────────────────────────────────────
_ATTACK_PLAN_SYSTEM = """You are a personal job search strategist. Create a hyper-actionable 48-hour plan.
Be specific — real company types, exact search strings, complete messages, full LinkedIn post.
Return ONLY valid JSON:
{
  "target_companies": [
    {
      "company_type": "specific type of company to target",
      "why_strong_fit": "specific reason this company type fits candidate's background",
      "linkedin_search_string": "exact search string to find hiring managers there",
      "insider_tip": "specific approach to getting noticed at this company type"
    }
  ],
  "linkedin_post": {
    "full_content": "complete LinkedIn post ready to publish — compelling, specific, not generic",
    "hashtags": ["#Hashtag1", "#Hashtag2", "#Hashtag3"],
    "best_posting_time": "day and time for maximum reach"
  },
  "referral_outreach": {
    "subject_line": "subject line for email to existing contacts",
    "message_template": "complete customizable message — specific ask, easy for them to help"
  },
  "hour_by_hour": {
    "hour_0_to_4": ["specific action 1", "specific action 2", "specific action 3"],
    "hour_4_to_12": ["specific action 1", "specific action 2", "specific action 3"],
    "hour_12_to_24": ["specific action 1", "specific action 2", "specific action 3"],
    "hour_24_to_48": ["specific action 1", "specific action 2", "specific action 3"]
  },
  "success_checkpoints": {
    "at_24_hours": ["measurable thing to check at 24 hours"],
    "at_48_hours": ["measurable thing to check at 48 hours"]
  },
  "momentum_killers": ["common mistake to avoid in first 48 hours"]
}"""


# ─────────────────────────────────────────────────────────────────────────────
# 9. THE JOB EVALUATOR (CAREER-OPS 6-BLOCK)
# ─────────────────────────────────────────────────────────────────────────────
_JOB_EVALUATOR_SYSTEM = """You are an elite career strategist. Analyze the provided Job Description against the Candidate Resume using the 6-Block Analysis method.
Return ONLY valid JSON:
{
  "score": 4.5,
  "block_a_summary": {
    "archetype": "Detected Archetype (e.g., FDE, PM, SA, LLMOps)",
    "domain": "Platform/Agentic/ML/Enterprise...",
    "level": "Junior/Mid/Senior/Staff",
    "tldr": "1 sentence TL;DR"
  },
  "block_b_match": {
    "strengths": ["Matched requirement 1 with CV line", "Matched requirement 2"],
    "gaps": [
      {
        "gap": "Missing requirement",
        "severity": "hard_blocker|nice_to_have",
        "mitigation": "How to address it in interview/cover letter"
      }
    ]
  },
  "block_c_level": {
    "natural_level": "Candidate's inferred level",
    "strategy_sell_senior": "How to frame experience as a senior level",
    "strategy_downlevel": "What to do if offered a lower title"
  },
  "block_d_comp": {
    "estimated_range": "e.g., $150k - $200k based on market data",
    "market_demand": "High/Medium/Low"
  },
  "block_e_personalization": [
    {
      "section": "Summary|Experience",
      "current": "current text",
      "proposed": "new text",
      "rationale": "why"
    }
  ],
  "block_f_interview": {
    "star_stories": [
      {
        "requirement": "JD requirement addressed",
        "story_theme": "Theme or hook to use",
        "reflection": "What candidate learned (signals seniority)"
      }
    ],
    "red_flags": ["Potential trap questions"]
  }
}"""


# ─────────────────────────────────────────────────────────────────────────────
# Public async service functions
# ─────────────────────────────────────────────────────────────────────────────

async def run_hiring_decoder(job_description: str) -> dict:
    user = f"Job Description:\n\n{job_description}"
    raw = await smart_chat(_HIRING_DECODER_SYSTEM, user, max_tokens=1500, task_type="hiring_decoder")
    return _parse_json(raw, _fallback_hiring_decoder())


async def run_resume_surgeon(job_description: str, resume_text: str) -> dict:
    user = f"Job Description:\n\n{job_description}\n\n---\nCandidate Resume:\n\n{resume_text}"
    raw = await smart_chat(_RESUME_SURGEON_SYSTEM, user, max_tokens=3000, task_type="resume_surgeon")
    return _parse_json(raw, _fallback_resume_surgeon())


async def run_linkedin_infiltrator(
    job_description: str,
    current_headline: str = "",
    current_about: str = "",
) -> dict:
    user = (
        f"Job Description:\n\n{job_description}\n\n"
        f"Current LinkedIn Headline:\n{current_headline or '(not provided)'}\n\n"
        f"Current About Section:\n{current_about or '(not provided)'}"
    )
    raw = await smart_chat(_LINKEDIN_INFILTRATOR_SYSTEM, user, max_tokens=2000, task_type="linkedin_infiltrator")
    return _parse_json(raw, _fallback_linkedin_infiltrator())


async def run_interview_trap_detector(
    job_description: str,
    resume_text: str,
    company: str,
    role: str,
) -> dict:
    user = (
        f"Role: {role} at {company}\n\n"
        f"Job Description:\n\n{job_description}\n\n"
        f"Candidate Background:\n\n{resume_text}"
    )
    raw = await smart_chat(_INTERVIEW_TRAP_SYSTEM, user, max_tokens=3000, task_type="interview_trap")
    return _parse_json(raw, _fallback_interview_trap())


async def run_cold_email_weapon(
    company: str,
    role: str,
    background_summary: str,
) -> dict:
    user = (
        f"Target Company: {company}\n"
        f"Target Role: {role}\n\n"
        f"Candidate Background:\n\n{background_summary}"
    )
    raw = await smart_chat(_COLD_EMAIL_SYSTEM, user, max_tokens=2000, task_type="cold_email")
    return _parse_json(raw, _fallback_cold_email(company, role))


async def run_offer_negotiator(
    offer_details: str,
    role: str,
    company: str,
    current_salary: str = "",
) -> dict:
    user = (
        f"Role: {role} at {company}\n"
        f"Current/Expected Salary: {current_salary or 'not specified'}\n\n"
        f"Offer Details:\n\n{offer_details}"
    )
    raw = await smart_chat(_OFFER_NEGOTIATOR_SYSTEM, user, max_tokens=2500, task_type="offer_negotiator")
    return _parse_json(raw, _fallback_offer_negotiator())


async def run_gap_killer(
    gap_description: str,
    gap_type: str,
    target_role: str,
) -> dict:
    user = (
        f"Gap Type: {gap_type}\n"
        f"Target Role: {target_role}\n\n"
        f"My Situation:\n\n{gap_description}"
    )
    raw = await smart_chat(_GAP_KILLER_SYSTEM, user, max_tokens=1500, task_type="gap_killer")
    return _parse_json(raw, _fallback_gap_killer())


async def run_attack_plan(
    target_role: str,
    resume_text: str,
    location: str = "Remote",
) -> dict:
    user = (
        f"Target Role: {target_role}\n"
        f"Location Preference: {location}\n\n"
        f"Background / Resume:\n\n{resume_text}"
    )
    raw = await smart_chat(_ATTACK_PLAN_SYSTEM, user, max_tokens=3000, task_type="attack_plan")
    return _parse_json(raw, _fallback_attack_plan(target_role))


async def run_job_evaluator(job_description: str, resume_text: str) -> dict:
    user = (
        f"Job Description:\n\n{job_description}\n\n"
        f"Candidate Background:\n\n{resume_text}"
    )
    raw = await smart_chat(_JOB_EVALUATOR_SYSTEM, user, max_tokens=4000, task_type="job_evaluator")
    return _parse_json(raw, _fallback_job_evaluator())


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _parse_json(raw: str, fallback: dict) -> dict:
    """Extract JSON from LLM output, falling back to static default on failure."""
    try:
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            return json.loads(match.group())
    except Exception:
        pass
    return fallback


# ─────────────────────────────────────────────────────────────────────────────
# Fallbacks — returned when LLM fails
# ─────────────────────────────────────────────────────────────────────────────

def _fallback_hiring_decoder() -> dict:
    return {
        "real_problem": "Unable to decode at this time. Please retry.",
        "instant_forward": [
            "Relevant experience with measurable impact on a similar problem",
            "Skills that exactly match the core technical requirements",
            "Clear career progression with increasing responsibility",
        ],
        "instant_reject": [
            "Generic summary with no quantified achievements",
            "Missing core required skills listed in the JD",
            "Job-hopping without explanation",
        ],
        "day_to_day_priorities": "Delivering results that reduce the team's pain points",
        "hidden_requirements": ["Strong communication with stakeholders", "Self-management and proactive updates"],
        "culture_signals": "Standard professional environment — look for pace indicators in the JD language",
        "red_flags_in_jd": [],
    }


def _fallback_resume_surgeon() -> dict:
    return {
        "summary": "Results-driven professional with a track record of delivering measurable outcomes. Combines technical depth with cross-functional collaboration to drive impact at scale.",
        "experience": [],
        "skills": {"technical": [], "tools": [], "soft": ["Communication", "Problem-solving", "Collaboration"]},
        "certifications": [],
        "ats_keywords_embedded": [],
        "power_verbs_used": ["Led", "Delivered", "Optimized", "Reduced", "Engineered"],
        "ats_score_estimate": 0,
    }


def _fallback_linkedin_infiltrator() -> dict:
    return {
        "search_strings": ['"your role" "your key skill"', '"related title" "company type"'],
        "boolean_search": '("Your Role" OR "Related Role") AND ("Key Skill") NOT "Unrelated Field"',
        "recommended_filters": {"titles": [], "skills": [], "keywords": []},
        "optimized_headline": "Your Role | Key Skill | Key Skill 2 | Open to Opportunities",
        "optimized_about": "Update your About section with role-specific keywords and quantified achievements.",
        "missing_keywords": [],
        "profile_quick_wins": [
            "Add all relevant skills to the Skills section",
            "Update headline with target role keywords",
            "Add featured section with top project or achievement",
        ],
        "connection_strategy": "Connect with recruiters and hiring managers at target companies.",
    }


def _fallback_interview_trap() -> dict:
    return {
        "questions": [
            {
                "question": "Tell me about yourself.",
                "type": "behavioral",
                "difficulty": "easy",
                "is_trap": False,
                "trap_reason": "",
                "strong_answer": "Focus on your most recent role, 2 quantified achievements, and why you're here.",
                "avoid_saying": "Your entire career history or personal life story",
                "time_estimate": "2 minutes",
            },
            {
                "question": "What is your biggest weakness?",
                "type": "trap",
                "difficulty": "medium",
                "is_trap": True,
                "trap_reason": "Testing self-awareness and whether you're honest or giving a canned answer",
                "strong_answer": "Name a real weakness you've actively worked on, with evidence of improvement.",
                "avoid_saying": "I'm a perfectionist or I work too hard",
                "time_estimate": "1 minute",
            },
        ],
        "core_themes": ["Technical competency", "Past performance", "Culture fit"],
        "must_prepare_stories": ["Most impactful project", "A conflict you resolved", "A time you failed and recovered"],
        "smart_questions_to_ask": [
            "What does success look like in the first 90 days?",
            "What are the team's biggest challenges right now?",
        ],
        "red_flag_topics": ["Reason for leaving previous role", "Salary expectations"],
    }


def _fallback_cold_email(company: str, role: str) -> dict:
    return {
        "email": {
            "subject": f"Experienced {role} — worth 5 minutes?",
            "body": (
                f"Hi [Name],\n\n"
                f"I came across {company}'s work on [specific initiative] — it aligns closely with what I've been building.\n\n"
                f"I recently helped [similar company] achieve [specific result]. I'd love to explore if there's a fit.\n\n"
                f"Would a 15-minute call this week work?"
            ),
            "ps_line": "",
        },
        "linkedin_connection_note": f"Hi [Name] — I'm a {role} and I've been following {company}'s work. I'd love to connect.",
        "voice_note_script": f"Hi [Name], this is [Your Name]. I'm a {role} — I've been following {company}'s work closely. I'd love 15 minutes to share how I helped [Company] achieve [result]. Happy to work around your schedule.",
        "follow_up_sequence": [
            {"day": 3, "channel": "linkedin", "message": "Just following up on my note — still very interested in connecting."},
            {"day": 7, "channel": "email", "message": "I know you're busy — happy to keep this to 10 minutes when convenient."},
            {"day": 14, "channel": "email", "message": "Last follow-up from me. If the timing isn't right, I completely understand. Best of luck."},
        ],
        "send_timing": "Tuesday–Thursday, 9–11am local time for highest open rates.",
        "personalization_hooks": [f"Reference a recent {company} product launch, press release, or LinkedIn post"],
    }


def _fallback_offer_negotiator() -> dict:
    return {
        "market_assessment": "Review market data on levels.fyi, Glassdoor, and LinkedIn Salary for comparable roles.",
        "counter_offer": {
            "recommended_base": 0,
            "justification": "Based on market data and your experience level, the counter should reflect fair value.",
            "live_call_script": "Thank you so much — I'm genuinely excited about this opportunity. I'd love to take 24 hours to review the full package. Is that okay?",
            "counter_script": "After reviewing the details, I was hoping we could get to [amount]. Based on my [experience] and [achievement], I believe this reflects fair market value.",
        },
        "if_they_say_best_offer": "I completely understand. Could we look at other elements — perhaps a sign-on bonus or an extra week of PTO?",
        "alternative_levers": {
            "equity": "Ask about accelerated vesting schedule or additional RSU grant.",
            "sign_on_bonus": "A one-time sign-on bridges the gap without affecting their salary band.",
            "pto": "Request 5 additional days or ask about their unlimited PTO culture.",
            "title": "Senior vs. Mid-level affects future earning trajectory for years.",
            "remote_work": "3+ remote days/week offsets salary gap with real financial value.",
            "start_date": "A later start date signals high demand and gives you time for other offers.",
        },
        "counter_offer_email": "Dear [Name],\n\nThank you for the offer — I'm very excited to join [Company]. After reviewing the details, I'd like to respectfully propose [amount] based on [justification]. I'm confident this reflects both market data and the value I'll bring from day one.\n\nLooking forward to your response.",
        "red_flags": ["Below-median salary justified with 'great culture'", "No equity in a growth-stage company"],
        "walk_away_threshold": "If total comp is more than 15% below target and no lever is moveable, it's okay to decline respectfully.",
    }


def _fallback_gap_killer() -> dict:
    return {
        "cover_letter_sentences": "During my career break, I took deliberate steps to deepen my expertise — completing [relevant activity] and staying current with industry developments. This period reinforced my commitment to [target role] and gave me fresh perspective I'm eager to bring to your team.",
        "interview_answer": "I took time away to [honest reason]. During that period, I [what you did productively]. I'm now fully focused and excited to bring that experience to [target role].",
        "linkedin_reframe": "I took an intentional career break to [reason], during which I [activity]. Now I'm actively seeking [target role] opportunities.",
        "narrative_strategy": "Own the break with confidence. Brief, honest, pivot immediately to what you gained and what you're bringing.",
        "gap_type_playbook": "Be honest and brief. State the reason in one sentence, focus the rest on what you did and what you're bringing forward.",
        "when_to_address_proactively": "Gap is over 6 months or clearly visible on your resume.",
        "when_to_wait": "Gap is under 3 months or during initial phone screening calls.",
        "skills_gained": ["Self-direction", "Strategic reflection", "Perspective outside the industry bubble"],
        "language_to_avoid": ["I couldn't find anything", "I was just taking time off", "I was figuring things out"],
        "reframe_as_strength": "The break gave you unique perspective and intentionality that many active candidates lack.",
    }


def _fallback_attack_plan(role: str) -> dict:
    return {
        "target_companies": [
            {
                "company_type": "Series B/C startups in your target sector",
                "why_strong_fit": "Growing fast, need experienced hires, move quickly on decisions",
                "linkedin_search_string": f'"{role}" company:"target company" title:"Hiring Manager"',
                "insider_tip": "Check their LinkedIn page for recent job posts — high posting volume = active hiring",
            }
        ],
        "linkedin_post": {
            "full_content": f"I'm actively exploring {role} opportunities and would love your help.\n\nI bring [key strength] and have [quantified achievement]. I'm open to [location/remote].\n\nIf you know of any openings or can make an introduction, I'd be incredibly grateful. Happy to return the favor.",
            "hashtags": ["#OpenToWork", "#JobSearch", "#Networking"],
            "best_posting_time": "Tuesday or Wednesday, 9–10am local time",
        },
        "referral_outreach": {
            "subject_line": "Quick favor — would love your help",
            "message_template": "Hi [Name], hope you're well! I'm actively exploring [role] opportunities and thought of you given your network in [industry/company]. Any chance you know of openings or could make an intro? Happy to share my resume. And always happy to return the favor!",
        },
        "hour_by_hour": {
            "hour_0_to_4": ["Update LinkedIn headline with target role keywords", "Identify 10 target companies", "Connect with 5 relevant recruiters"],
            "hour_4_to_12": ["Apply to 3 highest-priority roles", "Send referral messages to 5 contacts", "Publish LinkedIn post"],
            "hour_12_to_24": ["Research each target company deeply", "Customize resume for top 3 roles", "Schedule 2 informational interviews"],
            "hour_24_to_48": ["Follow up on all applications", "Engage with industry content on LinkedIn", "Set up job alerts on LinkedIn, Indeed, Glassdoor"],
        },
        "success_checkpoints": {
            "at_24_hours": ["5+ applications submitted", "LinkedIn post published with 10+ engagements", "3+ outreach messages sent"],
            "at_48_hours": ["1+ response from outreach", "10+ recruiter connections sent", "Job alerts configured on all platforms"],
        },
        "momentum_killers": [
            "Spending all 48 hours perfecting the resume instead of applying",
            "Only applying through job boards and not doing direct outreach",
            "Sending generic messages instead of personalized ones",
        ],
    }


def _fallback_job_evaluator() -> dict:
    return {
        "score": 3.0,
        "block_a_summary": {
            "archetype": "General Software Engineering",
            "domain": "Enterprise Tech",
            "level": "Mid-to-Senior",
            "tldr": "Standard engineering role with mixed requirements."
        },
        "block_b_match": {
            "strengths": ["General programming experience", "Domain familiarity"],
            "gaps": [
                {
                    "gap": "Specific proprietary technology mentioned in JD",
                    "severity": "nice_to_have",
                    "mitigation": "Highlight fast learning curve with adjacent tech."
                }
            ]
        },
        "block_c_level": {
            "natural_level": "Mid-level",
            "strategy_sell_senior": "Focus on system design contributions rather than just ticket execution.",
            "strategy_downlevel": "Accept lower title if compensation is adjusted with clear promotion path."
        },
        "block_d_comp": {
            "estimated_range": "Market average for locale",
            "market_demand": "Medium"
        },
        "block_e_personalization": [
            {
                "section": "Summary",
                "current": "Experienced developer...",
                "proposed": "Product-minded developer with focus on delivery...",
                "rationale": "Aligns better with the operational focus of the JD."
            }
        ],
        "block_f_interview": {
            "star_stories": [
                {
                    "requirement": "Cross-functional collaboration",
                    "story_theme": "Time you helped product/design resolve a blocker",
                    "reflection": "Learned that early communication prevents late technical debt."
                }
            ],
            "red_flags": ["They might ask why you've only worked in X language so far."]
        }
    }

"""
Server-Sent Events (SSE) streaming endpoints for LLM-generated content.
Provides real-time token streaming for cover letters and resume bullets,
dramatically improving perceived performance vs. waiting for full response.
"""
import json
import logging
from typing import AsyncGenerator, Dict, Any
from fastapi import APIRouter, Body, HTTPException
from fastapi.responses import StreamingResponse
from core.config import settings
from knowledge.resume_guidelines import resume_guidance_block

logger = logging.getLogger(__name__)
router = APIRouter()


async def _stream_from_provider(system_prompt: str, user_prompt: str, temperature: float = 0.6) -> AsyncGenerator[str, None]:
    """Stream tokens from the first available provider that supports streaming."""

    def _sse(data: str) -> str:
        return f"data: {json.dumps({'token': data})}\n\n"

    def _sse_done() -> str:
        return "data: [DONE]\n\n"

    def _sse_error(msg: str) -> str:
        return f"data: {json.dumps({'error': msg})}\n\n"

    # Try Anthropic streaming first
    if settings.ANTHROPIC_API_KEY:
        try:
            from anthropic import AsyncAnthropic
            client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
            async with client.messages.stream(
                model=settings.ANTHROPIC_MODEL,
                max_tokens=1500,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
                temperature=temperature,
            ) as stream:
                async for text in stream.text_stream:
                    yield _sse(text)
            yield _sse_done()
            return
        except Exception as e:
            logger.warning(f"Anthropic streaming failed: {e}")

    # Try OpenAI streaming
    if settings.OPENAI_API_KEY:
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            stream = await client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                max_tokens=1500,
                temperature=temperature,
                stream=True,
            )
            async for chunk in stream:
                token = chunk.choices[0].delta.content or ""
                if token:
                    yield _sse(token)
            yield _sse_done()
            return
        except Exception as e:
            logger.warning(f"OpenAI streaming failed: {e}")

    # Try Groq streaming
    if settings.GROQ_API_KEY:
        try:
            from groq import AsyncGroq
            client = AsyncGroq(api_key=settings.GROQ_API_KEY)
            stream = await client.chat.completions.create(
                model=settings.GROQ_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                max_tokens=1500,
                temperature=temperature,
                stream=True,
            )
            async for chunk in stream:
                token = chunk.choices[0].delta.content or ""
                if token:
                    yield _sse(token)
            yield _sse_done()
            return
        except Exception as e:
            logger.warning(f"Groq streaming failed: {e}")

    # Fallback: non-streaming via smart_chat
    try:
        from core.llm import smart_chat
        result = await smart_chat(system_prompt, user_prompt, temperature=temperature, cache_ttl=0)
        # Simulate streaming by chunking the response
        chunk_size = 4
        for i in range(0, len(result), chunk_size):
            yield _sse(result[i:i + chunk_size])
        yield _sse_done()
    except Exception as e:
        yield _sse_error(str(e))
        yield _sse_done()


_COVER_LETTER_SYSTEM = """You are an expert career coach writing highly personalized cover letters
for QA/SDET professionals. Write a compelling, concise cover letter (3 paragraphs, ~200 words)
that mirrors the job description language. Do not use generic phrases like "I am a team player".
Focus on specific technical achievements and alignment with the company's engineering culture.
Return only the cover letter text, no subject line, no sign-off instructions."""

_RESUME_BULLETS_SYSTEM = f"""You are a World-Class ATS Resume Optimization Specialist.
Write exactly 5 quantified experience bullets using the Problem-Action-Result (PAR) framework.
- Use strong action verbs (Spearheaded, Optimized, Orchestrated, Architected).
- MUST include metrics (%, $, time, scale).
- Mirror the job description's exact technical terminology.
- Apply this knowledge base:
{resume_guidance_block()}
- Use only truthful, defensible impact statements. Do not fabricate tools, scope, or outcomes.
Return ONLY the 5 bullets as a numbered list, nothing else."""


@router.post("/cover-letter")
async def stream_cover_letter(payload: Dict[str, Any] = Body(...)):
    """
    Stream a personalized cover letter token-by-token via SSE.
    Payload: { profile: {...}, job: {...} }
    Frontend: use EventSource or fetch with ReadableStream to consume.
    """
    profile = payload.get("profile", {})
    job = payload.get("job", {})

    name = profile.get("name", "Candidate")
    role = profile.get("current_role", "QA Engineer")
    exp = profile.get("experience_years", 5)
    skills = (profile.get("skills") or [])[:4]
    job_title = job.get("title", "the role")
    org = job.get("organization", "your company")
    jd = job.get("description", "")
    techs = (job.get("technologies") or [])[:3]

    user_prompt = (
        f"Candidate: {name}, {role}, {exp} years exp, skills: {', '.join(skills)}\n"
        f"Target role: {job_title} at {org}\n"
        f"Key technologies required: {', '.join(techs)}\n"
        f"Job Description excerpt: {jd[:600]}\n\n"
        "Write the cover letter body (3 paragraphs, ~200 words)."
    )

    return StreamingResponse(
        _stream_from_provider(_COVER_LETTER_SYSTEM, user_prompt, temperature=0.7),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.post("/resume-bullets")
async def stream_resume_bullets(payload: Dict[str, Any] = Body(...)):
    """
    Stream ATS resume bullets token-by-token via SSE.
    Payload: { profile: {...}, job: {...} }
    """
    profile = payload.get("profile", {})
    job = payload.get("job", {})

    tech_stack = job.get("technologies") or []
    jd = job.get("description", "")

    user_prompt = (
        f"Candidate Role: {profile.get('current_role', 'QA Engineer')}\n"
        f"Experience: {profile.get('experience_years', 5)} years\n"
        f"Profile Skills: {', '.join((profile.get('skills') or []))}\n"
        f"Target Tech Stack: {', '.join(tech_stack[:10])}\n\n"
        f"Job Description (snippet):\n{jd[:1000]}\n\n"
        "Write 5 quantified PAR-format resume bullets tailored to this job."
    )

    return StreamingResponse(
        _stream_from_provider(_RESUME_BULLETS_SYSTEM, user_prompt, temperature=0.5),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ── Power Tool System Prompts ─────────────────────────────────────────────────

_HIRING_DECODER_SYSTEM = """You are a veteran tech recruiting insider who spent 15 years at FAANG companies.
You decode job descriptions with brutal honesty, exposing what hiring managers ACTUALLY want vs. what they wrote.

Structure your analysis EXACTLY as:
## What They REALLY Want
[3-5 bullet points exposing hidden requirements, culture fit signals, and unstated priorities]

## Red Flags in This JD
[Any concerning language: "fast-paced", "wear many hats", unrealistic expectations, etc.]

## Secret Keywords to Mirror
[Top 8-10 exact phrases from the JD the resume and cover letter MUST contain to pass ATS]

## The Insider Angle
[1 paragraph on how to position yourself based on what this team is likely struggling with]

Be direct, use insider language, no corporate fluff."""

_RESUME_SURGEON_SYSTEM = f"""You are a ruthless resume surgeon who has reviewed 50,000+ tech resumes.
You give specific, actionable surgery instructions — not generic advice.
Apply this shared resume knowledge base:
{resume_guidance_block()}

Structure your output EXACTLY as:
## Critical Cuts (Must Fix)
[3-5 specific problems killing this resume's chances — be brutal and specific]

## Transplants Needed
[Exact rewrites for 2-3 weak bullets — show before/after]

## ATS Implants
[Specific keywords missing that the JD requires — exact terms to add]

## Positioning Operation
[How to reframe their experience narrative for THIS specific role]

## Prognosis
[One-line verdict: Ready / Needs work / Major surgery required]

Be surgical, specific, and brutally honest."""

_LINKEDIN_INFILTRATOR_SYSTEM = """You are a LinkedIn growth hacker who helped 500+ professionals land FAANG roles.
You know exactly how LinkedIn's algorithm works and how recruiters search.

Structure your output EXACTLY as:
## Headline Surgery
[3 alternative headline options using recruiter search terms — ranked best to worst]

## About Section Hook
[First 3 lines of About section that stop the scroll — must include keywords]

## Algorithm Triggers
[5 specific actions to take this week to boost profile visibility for recruiters]

## Infiltration Strategy
[How to get inside the target company's LinkedIn network in 7 days]

## Connection Message Templates
[2 personalized connection request templates for: 1) recruiter at target company, 2) engineer at target company]

Use specific, tactical advice — not generic LinkedIn tips."""

_INTERVIEW_TRAP_SYSTEM = """You are a veteran interviewer who has conducted 2,000+ technical interviews at top tech companies.
You identify every trap, trick question, and hidden evaluation criteria before the candidate walks in.

Structure your output EXACTLY as:
## Hidden Evaluation Criteria
[What they're REALLY measuring beyond the stated requirements]

## Trap Questions to Expect
[5 likely trick questions for this role with why they're asked and what the right answer signals]

## Culture Fit Landmines
[3-5 questions that seem innocent but are actually culture screening — what wrong answers look like]

## Your Killer Questions to Ask THEM
[5 questions that signal seniority, strategic thinking, and genuine interest]

## Interview Game Plan
[Day-of strategy: what to emphasize, what to downplay, how to handle the comp question]

Be specific to the role and company, not generic interview advice."""

_COLD_EMAIL_SYSTEM = """You are a direct response copywriter who specializes in cold outreach for job seekers.
Your emails get 40%+ reply rates because they're specific, short, and lead with value.

Write TWO versions:

## Version A: The Direct Ask (to Hiring Manager)
[Subject line + 4-sentence email — lead with a specific insight about their team/product, one relevant achievement, clear ask]

## Version B: The Warm Intro (to Team Engineer)
[Subject line + 4-sentence email — peer-to-peer tone, specific technical observation, informal ask for 15-min chat]

## LinkedIn DM Version
[Under 300 characters — for LinkedIn InMail — punchy, specific]

## Follow-Up Template (Day 7)
[3-sentence follow-up if no reply — add new value, don't just "bump"]

Rules: No "I hope this email finds you well". No resume attachments. No generic openers. Be specific."""

_OFFER_NEGOTIATOR_SYSTEM = """You are a compensation negotiation expert who has helped 1,000+ engineers negotiate $20k-$100k+ more.
You understand total compensation, equity vesting, and leverage psychology.

Structure your output EXACTLY as:
## Your Leverage Assessment
[Honest analysis of negotiating position: strong/moderate/weak and why]

## The Opening Counter
[Exact script for the counter-offer call — word-for-word opening line and key points to hit]

## Total Comp Breakdown
[What to negotiate beyond base: equity, signing bonus, remote flexibility, review timeline, equipment]

## Objection Handlers
[Exact responses to: "This is our max", "Band doesn't go higher", "We have other candidates"]

## Walk-Away Calculus
[How to evaluate if the final offer is worth accepting — specific decision framework]

## Email Template
[Professional counter-offer email — fill-in-the-blanks format]

Be specific with numbers and scripts, not principles."""

_GAP_KILLER_SYSTEM = """You are a tech career strategist who has helped 300+ professionals close skill gaps and land roles above their current level.
You create ruthlessly prioritized learning plans that fit around a full-time job.

Structure your output EXACTLY as:
## Gap Priority Matrix
[Rank gaps as: 🔴 Blocker / 🟡 Differentiator / 🟢 Nice-to-have — with rationale]

## 30-Day Sprint Plan
[Week-by-week breakdown — specific courses, projects, GitHub commits — max 1hr/day]

## Proof-of-Work Projects
[2-3 portfolio projects that demonstrate the critical gaps — include tech stack and GitHub description]

## Fast Credentialing
[Certifications or micro-credentials that signal competence quickly — with exam pass time]

## Narrative Bridge
[How to frame gaps positively in interviews before they're fully closed]

Be specific: name actual courses (Coursera, Udemy, freeCodeCamp), repos, and timelines."""

_ATTACK_PLAN_SYSTEM = """You are a military-grade job search strategist who treats job hunting like a special ops mission.
You create 30-60-90 day plans that are measurable, accountable, and ruthlessly efficient.

Structure your output EXACTLY as:
## Mission Briefing
[Target role, realistic timeline assessment, success probability and what determines it]

## Week 1-2: Intelligence Phase
[Specific daily actions: research targets, build hit list, optimize digital presence — with hour estimates]

## Days 15-30: Infiltration Phase
[Outreach targets per week, networking events, application cadence, LinkedIn actions]

## Days 31-60: Engagement Phase
[Interview prep milestones, portfolio completion, offer timeline management]

## Days 61-90: Closing Phase
[Decision framework, counter-offer strategy, start date negotiation]

## Daily Non-Negotiables
[5 actions to do EVERY DAY regardless of stage]

## KPIs to Track Weekly
[Specific metrics: applications, responses, interviews, offers — with target rates]

Be tactical and specific — no motivational fluff."""


def _sse_response(generator) -> StreamingResponse:
    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.post("/hiring-decoder")
async def stream_hiring_decoder(payload: Dict[str, Any] = Body(...)):
    """
    Decode what a hiring manager REALLY wants from a JD.
    Payload: { job: { title, organization, description, technologies }, profile: {...} }
    """
    job = payload.get("job", {})
    profile = payload.get("profile", {})

    user_prompt = (
        f"Job Title: {job.get('title', 'Software Engineer')}\n"
        f"Company: {job.get('organization', 'Unknown')}\n"
        f"Candidate: {profile.get('current_role', 'Engineer')} with {profile.get('experience_years', 5)} yrs exp\n\n"
        f"Full Job Description:\n{job.get('description', '')[:2000]}\n\n"
        "Decode this job description with insider knowledge."
    )
    return _sse_response(_stream_from_provider(_HIRING_DECODER_SYSTEM, user_prompt, temperature=0.65))


@router.post("/resume-surgeon")
async def stream_resume_surgeon(payload: Dict[str, Any] = Body(...)):
    """
    Deep resume surgery against a specific job.
    Payload: { profile: {...}, resume_text: "...", job: { title, description } }
    """
    profile = payload.get("profile", {})
    resume_text = payload.get("resume_text", "")
    job = payload.get("job", {})

    user_prompt = (
        f"Target Role: {job.get('title', 'Engineer')} at {job.get('organization', 'target company')}\n"
        f"JD snippet:\n{job.get('description', '')[:800]}\n\n"
        f"Candidate: {profile.get('current_role', 'Engineer')}, {profile.get('experience_years', 5)} yrs\n"
        f"Skills: {', '.join((profile.get('skills') or [])[:10])}\n\n"
        f"Resume Content:\n{resume_text[:2000] if resume_text else '[No resume text provided — assess profile only]'}\n\n"
        "Perform surgical resume analysis."
    )
    return _sse_response(_stream_from_provider(_RESUME_SURGEON_SYSTEM, user_prompt, temperature=0.5))


@router.post("/linkedin-infiltrator")
async def stream_linkedin_infiltrator(payload: Dict[str, Any] = Body(...)):
    """
    LinkedIn profile + outreach infiltration strategy.
    Payload: { profile: {...}, target_company: "...", target_role: "..." }
    """
    profile = payload.get("profile", {})
    target_company = payload.get("target_company", "")
    target_role = payload.get("target_role", "")

    user_prompt = (
        f"Candidate: {profile.get('name', 'Candidate')}, {profile.get('current_role', 'Engineer')}\n"
        f"Experience: {profile.get('experience_years', 5)} years\n"
        f"Current LinkedIn headline (if any): {profile.get('linkedin_headline', 'Not provided')}\n"
        f"Top Skills: {', '.join((profile.get('skills') or [])[:8])}\n"
        f"Target Role: {target_role}\n"
        f"Target Company: {target_company}\n\n"
        "Build a LinkedIn infiltration strategy to get noticed and hired."
    )
    return _sse_response(_stream_from_provider(_LINKEDIN_INFILTRATOR_SYSTEM, user_prompt, temperature=0.7))


@router.post("/interview-trap-detector")
async def stream_interview_trap_detector(payload: Dict[str, Any] = Body(...)):
    """
    Detect interview traps and hidden evaluation criteria.
    Payload: { job: { title, organization, description }, profile: {...} }
    """
    job = payload.get("job", {})
    profile = payload.get("profile", {})

    user_prompt = (
        f"Role: {job.get('title', 'Engineer')} at {job.get('organization', 'company')}\n"
        f"Candidate level: {profile.get('experience_years', 5)} years as {profile.get('current_role', 'Engineer')}\n\n"
        f"Full JD:\n{job.get('description', '')[:2000]}\n\n"
        "Identify every trap, hidden criterion, and trick question I should prepare for."
    )
    return _sse_response(_stream_from_provider(_INTERVIEW_TRAP_SYSTEM, user_prompt, temperature=0.6))


@router.post("/cold-email-weapon")
async def stream_cold_email_weapon(payload: Dict[str, Any] = Body(...)):
    """
    Generate cold outreach emails and DMs to hiring managers/engineers.
    Payload: { profile: {...}, target_company: "...", target_role: "...", target_person: "..." }
    """
    profile = payload.get("profile", {})
    target_company = payload.get("target_company", "")
    target_role = payload.get("target_role", "")
    target_person = payload.get("target_person", "Hiring Manager")

    user_prompt = (
        f"Sender: {profile.get('name', 'Candidate')}, {profile.get('current_role', 'Engineer')}, "
        f"{profile.get('experience_years', 5)} yrs exp\n"
        f"Top achievements: {profile.get('top_achievement', 'not specified')}\n"
        f"Key skills: {', '.join((profile.get('skills') or [])[:6])}\n\n"
        f"Target: {target_person} at {target_company}\n"
        f"Target Role: {target_role}\n\n"
        "Write cold outreach emails and DMs that get replies."
    )
    return _sse_response(_stream_from_provider(_COLD_EMAIL_SYSTEM, user_prompt, temperature=0.75))


@router.post("/offer-negotiator")
async def stream_offer_negotiator(payload: Dict[str, Any] = Body(...)):
    """
    Generate negotiation scripts and strategy for a job offer.
    Payload: { offer: { base, equity, bonus, company }, profile: {...}, competing_offers: [...] }
    """
    offer = payload.get("offer", {})
    profile = payload.get("profile", {})
    competing = payload.get("competing_offers", [])

    competing_str = ""
    if competing:
        parts = [f"{o.get('company', '?')} ${o.get('base', 0)}k" for o in competing[:3]]
        competing_str = f"\nCompeting offers: {', '.join(parts)}"

    user_prompt = (
        f"Offer from: {offer.get('company', 'Company')}\n"
        f"Base: ${offer.get('base', 0)}k | Equity: {offer.get('equity', 'N/A')} | Bonus: {offer.get('bonus', 'N/A')}\n"
        f"Role: {offer.get('role', profile.get('current_role', 'Engineer'))}\n"
        f"Candidate: {profile.get('experience_years', 5)} yrs exp, currently at {profile.get('current_company', 'current employer')}{competing_str}\n"
        f"Market salary context: {offer.get('market_context', 'mid-range for the role')}\n\n"
        "Build a complete negotiation strategy and scripts."
    )
    return _sse_response(_stream_from_provider(_OFFER_NEGOTIATOR_SYSTEM, user_prompt, temperature=0.6))


@router.post("/gap-killer")
async def stream_gap_killer(payload: Dict[str, Any] = Body(...)):
    """
    Build a prioritized plan to close skill gaps for a target role.
    Payload: { profile: {...}, target_role: "...", skill_gaps: [...], timeline_weeks: 12 }
    """
    profile = payload.get("profile", {})
    target_role = payload.get("target_role", "")
    skill_gaps = payload.get("skill_gaps", [])
    timeline_weeks = payload.get("timeline_weeks", 12)

    user_prompt = (
        f"Candidate: {profile.get('current_role', 'Engineer')}, {profile.get('experience_years', 5)} yrs exp\n"
        f"Current Skills: {', '.join((profile.get('skills') or [])[:10])}\n"
        f"Target Role: {target_role}\n"
        f"Identified Gaps: {', '.join(skill_gaps) if skill_gaps else 'To be determined from target role'}\n"
        f"Available Timeline: {timeline_weeks} weeks (max 1hr/day on top of day job)\n\n"
        "Build a gap-killer action plan with specific resources and proof-of-work projects."
    )
    return _sse_response(_stream_from_provider(_GAP_KILLER_SYSTEM, user_prompt, temperature=0.6))


@router.post("/attack-plan")
async def stream_attack_plan(payload: Dict[str, Any] = Body(...)):
    """
    Generate a 30-60-90 day military-grade job search attack plan.
    Payload: { profile: {...}, target_role: "...", target_companies: [...], urgency: "asap|3mo|6mo" }
    """
    profile = payload.get("profile", {})
    target_role = payload.get("target_role", "")
    target_companies = payload.get("target_companies", [])
    urgency = payload.get("urgency", "3mo")

    urgency_map = {"asap": "immediately (within 30 days)", "3mo": "within 3 months", "6mo": "within 6 months"}
    timeline_str = urgency_map.get(urgency, urgency)

    user_prompt = (
        f"Candidate: {profile.get('name', 'Candidate')}, {profile.get('current_role', 'Engineer')}\n"
        f"Experience: {profile.get('experience_years', 5)} years\n"
        f"Current Company: {profile.get('current_company', 'current employer')}\n"
        f"Skills: {', '.join((profile.get('skills') or [])[:8])}\n\n"
        f"Mission Objective: Land {target_role} role {timeline_str}\n"
        f"Target Companies: {', '.join(target_companies[:8]) if target_companies else 'Open to best opportunities'}\n\n"
        "Build a 30-60-90 day attack plan with daily non-negotiables and weekly KPIs."
    )
    return _sse_response(_stream_from_provider(_ATTACK_PLAN_SYSTEM, user_prompt, temperature=0.65))


# ─────────────────────────────────────────────────────────────────────────────
# Deep Company Research (ported from career-ops/modes/deep.md)
# ─────────────────────────────────────────────────────────────────────────────

_DEEP_RESEARCH_SYSTEM = """\
You are a senior tech recruiter and competitive intelligence analyst.
Generate a structured 6-axis deep research brief for a candidate evaluating a job opportunity.
Be specific, actionable, and opinionated — not generic.
Format with clear markdown headers, bullet points, and bold key facts.
Focus on what the candidate needs to know to ace the interview and negotiate well.
"""


@router.post("/deep-research")
async def stream_deep_research(payload: Dict[str, Any] = Body(...)):
    """
    Generate a 6-axis deep company research brief for interview preparation.
    Payload: { company: "...", role: "...", profile: {...} }
    """
    company = payload.get("company", "")
    role = payload.get("role", "")
    profile = payload.get("profile", {})

    candidate_summary = (
        f"{profile.get('name', 'Candidate')}, {profile.get('current_role', 'Engineer')}, "
        f"{profile.get('experience_years', 5)} years experience, "
        f"skills: {', '.join((profile.get('skills') or [])[:6])}"
    )

    user_prompt = (
        f"## Deep Research Brief: {company} — {role}\n\n"
        f"**Candidate:** {candidate_summary}\n\n"
        "Generate a complete 6-axis research brief covering:\n\n"
        "### 1. AI Strategy\n"
        f"- What products/features does {company} use AI/ML for?\n"
        "- Their AI stack (models, infra, tools)\n"
        "- Engineering blog topics / published papers / conference talks\n\n"
        "### 2. Recent Moves (last 6 months)\n"
        "- Key hires in AI/ML/product leadership\n"
        "- Acquisitions, partnerships, product launches\n"
        "- Funding rounds or leadership changes\n\n"
        "### 3. Engineering Culture\n"
        "- Deploy cadence and CI/CD approach\n"
        "- Tech stack (languages, frameworks, infra)\n"
        "- Remote vs office policy\n"
        "- Glassdoor/Blind sentiment on engineering culture\n\n"
        "### 4. Likely Challenges\n"
        "- Scaling, reliability, latency, or cost challenges\n"
        "- Active migrations or architectural shifts\n"
        "- Pain points mentioned in employee reviews\n\n"
        "### 5. Competitive Landscape\n"
        f"- {company}'s main competitors\n"
        "- Their moat / key differentiator\n"
        "- Positioning vs competition\n\n"
        "### 6. Candidate Angle\n"
        f"Given the candidate profile above applying for {role} at {company}:\n"
        "- What unique value does this candidate bring?\n"
        "- Which of their projects/skills are most relevant?\n"
        "- What story should they tell in the interview?\n"
        "- What questions should they ask?\n"
    )
    return _sse_response(_stream_from_provider(_DEEP_RESEARCH_SYSTEM, user_prompt, temperature=0.6))

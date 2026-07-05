"""Resume guidance distilled from the NxtJob resume guide.

The source document is intentionally summarized into product rules so the app
can apply the guidance without embedding the full copyrighted guide.
"""

RESUME_KNOWLEDGE_VERSION = "nxtjob-resume-guide-2026-07"

NXTJOB_RESUME_PRINCIPLES = """
NxtJob resume operating principles:
- Treat the resume as a targeted sales document, not a biography.
- Optimize every resume for two outcomes: relevance to the exact JD and proof of top-decile impact.
- Keep the canonical resume order to five sections only: Personal Details, Summary, Skills, Professional Experience, Education and Certifications.
- Avoid separate Projects, Achievements, Hobbies, Volunteer, Declaration, Reference, photo, age, marital, or health sections unless the target role explicitly requires them.
- Use the JD to decide what to include, what to omit, and which exact keywords must appear.
- Target an ATS/job-match score of at least 70 before applying; aim for a resume quality score above 90.

Personal details rules:
- Include full name, professional email, mobile, LinkedIn, city-only location, and high-value proof links only when relevant.
- Add relocation, remote-work, visa, or language signals only when they improve fit for the target job.
- Use a title line that combines the target job title with the candidate's strongest credible differentiators.

Summary rules:
- Make the summary a hook that proves relevance and brilliance quickly.
- Formula: Accomplished {target job title} with {years} years of experience and expertise in {3-4 top JD skills}. Achieved {largest relevant quantified achievement} for {company/context}.
- For 15+ years of experience, allow 2-3 tight achievement bullets, but never let the summary replace the experience section.
- Always include company/context for major achievements.

Skills rules:
- Categorize skills into 2-4 readable groups instead of a keyword dump.
- Use must-have keywords from the JD and validated market skills from multiple real JDs.
- Do not use self-rated star levels or subjective proficiency ratings.
- Missing high-priority JD skills should be highlighted as gaps rather than fabricated.

Experience rules:
- Experience is the primary proof section. Each bullet should show a specific skill applied to create business or technical impact.
- Use a Before-After / Problem-Action-Result pattern: name the broken or costly situation, the action taken, and the measurable result.
- Strong bullets should be crisp, defensible, and metric-backed. Prefer revenue, cost, time, quality, uptime, accuracy, coverage, scale, compliance, productivity, or cycle-time numbers.
- Start bullets with strong action verbs, include the exact relevant tool/process/skill, and end with the measurable result when possible.
- Never invent fictional outcomes, tools, or scope the candidate cannot defend in interview.
- Older roles should have fewer bullets, focused on the strongest impact.
- Show soft skills through evidence, not claims. Avoid direct claims like excellent communicator, team player, proven leader, or results-oriented.

Education and certification rules:
- Keep education at the end.
- Write degrees in full and abbreviated forms when useful for ATS matching.
- Include only relevant, credible certifications; avoid low-signal course certificates unless directly required.
- Do not include school marks or GPA unless truly exceptional or explicitly requested.

Final polish rules:
- Keep the resume to 1-2 pages with restrained, professional design and demure colors.
- Prefer ATS-safe formatting, readable section hierarchy, and concise bullets that do not spill awkwardly.
- Run grammar and spelling checks before finalizing.
"""


def resume_guidance_block() -> str:
    """Return shared resume guidance for LLM prompts."""
    return NXTJOB_RESUME_PRINCIPLES.strip()

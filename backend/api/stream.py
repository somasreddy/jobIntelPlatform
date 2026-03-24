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

_RESUME_BULLETS_SYSTEM = """You are a World-Class ATS Resume Optimization Specialist.
Write exactly 5 quantified experience bullets using the Problem-Action-Result (PAR) framework.
- Use strong action verbs (Spearheaded, Optimized, Orchestrated, Architected).
- MUST include metrics (%, $, time, scale).
- Mirror the job description's exact technical terminology.
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

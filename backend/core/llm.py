from __future__ import annotations

from typing import Any
import httpx
import hashlib
import json
import logging
import asyncio
from typing import List, Dict, Optional
from core.config import settings

logger = logging.getLogger(__name__)

# --- Client Singletons ---
_anthropic_client: Any | None = None
_openai_client: Any | None = None
_groq_client: Any | None = None
_google_client: Any | None = None
_perplexity_client: Any | None = None
_deepseek_client: Any | None = None
_openrouter_client: Any | None = None
_redis_client = None


def get_redis_client():
    global _redis_client
    if _redis_client is None:
        try:
            import redis.asyncio as aioredis
            _redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        except Exception as e:
            logger.warning(f"Redis client init failed: {e}")
    return _redis_client


def _cache_key(system_prompt: str, user_prompt: str, provider: str = "", model: str = "") -> str:
    raw = f"{system_prompt}||{user_prompt}||{provider}||{model}"
    return f"llm_cache:{hashlib.sha256(raw.encode()).hexdigest()}"


async def _cache_get(key: str) -> str | None:
    try:
        client = get_redis_client()
        if client:
            return await client.get(key)
    except Exception:
        pass
    return None


async def _cache_set(key: str, value: str, ttl: int = 900) -> None:
    try:
        client = get_redis_client()
        if client:
            await client.setex(key, ttl, value)
    except Exception:
        pass

def get_anthropic_client() -> Any:
    global _anthropic_client
    if _anthropic_client is None:
        from anthropic import AsyncAnthropic
        _anthropic_client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _anthropic_client

def get_openai_client() -> Any:
    global _openai_client
    if _openai_client is None:
        from openai import AsyncOpenAI
        _openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    return _openai_client

def get_groq_client() -> Any:
    global _groq_client
    if _groq_client is None:
        from groq import AsyncGroq
        _groq_client = AsyncGroq(api_key=settings.GROQ_API_KEY)
    return _groq_client

def get_google_client() -> Any:
    global _google_client
    if _google_client is None:
        from google import genai
        _google_client = genai.Client(api_key=settings.GOOGLE_API_KEY)
    return _google_client

def get_perplexity_client() -> Any:
    global _perplexity_client
    if _perplexity_client is None:
        from openai import AsyncOpenAI
        _perplexity_client = AsyncOpenAI(api_key=settings.PERPLEXITY_API_KEY, base_url="https://api.perplexity.ai")
    return _perplexity_client

def get_deepseek_client() -> Any:
    global _deepseek_client
    if _deepseek_client is None:
        from openai import AsyncOpenAI
        _deepseek_client = AsyncOpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url="https://api.deepseek.com")
    return _deepseek_client

def get_openrouter_client() -> Any:
    global _openrouter_client
    if _openrouter_client is None:
        from openai import AsyncOpenAI
        _openrouter_client = AsyncOpenAI(api_key=settings.OPENROUTER_API_KEY, base_url="https://openrouter.ai/api/v1")
    return _openrouter_client

# --- Core Chat Logic ---

async def chat(
    system_prompt: str,
    user_prompt: str,
    provider: str | None = None,
    model: str | None = None,
    max_tokens: int = 2000,
    temperature: float = 0.7,
    cache_ttl: int = 900,
) -> str:
    """Multi-provider chat call. Implements fallback logic and Redis caching."""

    # Cache lookup (skip cache for temperature > 0.5 to preserve creativity)
    use_cache = cache_ttl > 0 and temperature <= 0.5
    cache_k = _cache_key(system_prompt, user_prompt, provider or "", model or "")
    if use_cache:
        cached = await _cache_get(cache_k)
        if cached:
            logger.debug("LLM cache hit")
            return cached

    # If a specific provider is requested, attempt ONLY that one
    if provider:
        result = await _execute_provider_call(provider, model, system_prompt, user_prompt, max_tokens, temperature)
        if use_cache and not result.startswith("Error:"):
            await _cache_set(cache_k, result, cache_ttl)
        return result

    # Otherwise, follow the fallback chain from settings
    fallback_chain = settings.LLM_FALLBACK_ORDER.split(",")
    last_error = "No providers configured"

    for p in fallback_chain:
        p = p.strip().lower()
        key_attr = f"{p.upper()}_API_KEY"
        if not getattr(settings, key_attr, None):
            continue
        try:
            result = await _execute_provider_call(p, None, system_prompt, user_prompt, max_tokens, temperature)
            if use_cache and not result.startswith("Error:"):
                await _cache_set(cache_k, result, cache_ttl)
            return result
        except Exception as e:
            logger.warning(f"LLM Provider {p} failed: {e}. Trying next in chain...")
            last_error = str(e)
            continue

    return f"Error: All LLM providers failed. Last error: {last_error}"

async def _execute_provider_call(provider: str, model: str | None, system_prompt: str, user_prompt: str, max_tokens: int, temperature: float) -> str:
    """Internal execution of a single provider call."""
    p = provider.lower()
    
    if p == "openai":
        client = get_openai_client()
        response = await client.chat.completions.create(
            model=model or settings.OPENAI_MODEL,
            messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
            max_tokens=max_tokens, temperature=temperature
        )
        return response.choices[0].message.content or ""
        
    elif p == "groq":
        client = get_groq_client()
        response = await client.chat.completions.create(
            model=model or settings.GROQ_MODEL,
            messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
            max_tokens=max_tokens, temperature=temperature
        )
        return response.choices[0].message.content or ""

    elif p == "google":
        client = get_google_client()
        target_model = model or settings.GOOGLE_MODEL or "gemini-2.0-flash"
        from google.genai import types as genai_types

        def _sync_google_call(mdl: str, sys_prompt: str, usr_prompt: str) -> str:
            cfg = genai_types.GenerateContentConfig(
                system_instruction=sys_prompt,
                max_output_tokens=max_tokens,
                temperature=temperature,
            )
            resp = client.models.generate_content(model=mdl, config=cfg, contents=usr_prompt)
            return resp.text or ""

        try:
            return await asyncio.to_thread(_sync_google_call, target_model, system_prompt, user_prompt)
        except Exception as e:
            err_lower = str(e).lower()
            if any(k in err_lower for k in ("not found", "not supported", "deprecated")):
                fallback_model = "gemini-2.0-flash"
                logger.warning(f"Google model {target_model} unavailable, falling back to {fallback_model}")
                return await asyncio.to_thread(_sync_google_call, fallback_model, system_prompt, user_prompt)
            raise

    elif p == "deepseek":
        client = get_deepseek_client()
        response = await client.chat.completions.create(
            model=model or settings.DEEPSEEK_MODEL,
            messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
            max_tokens=max_tokens, temperature=temperature
        )
        return response.choices[0].message.content or ""

    elif p == "openrouter":
        client = get_openrouter_client()
        target_model = model or settings.OPENROUTER_MODEL
        
        # Implement retry logic specifically for OpenRouter free models
        max_retries = 3
        wait_seconds = 15
        
        for attempt in range(max_retries):
            try:
                response = await client.chat.completions.create(
                    model=target_model,
                    messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
                    max_tokens=max_tokens, temperature=temperature
                )
                return response.choices[0].message.content or ""
            except Exception as e:
                err_str = str(e)
                if "429" in err_str and attempt < max_retries - 1:
                    logger.warning(f"OpenRouter Rate Limited. Attempt {attempt+1}/{max_retries}. Waiting {wait_seconds}s...")
                    await asyncio.sleep(wait_seconds)
                    continue
                raise e

    elif p == "mistral":
        try:
            from mistralai import Mistral # Lazy import
            client = Mistral(api_key=settings.MISTRAL_API_KEY)
            response = client.chat.complete(
                model=model or settings.MISTRAL_MODEL,
                messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}]
            )
            return response.choices[0].message.content if response.choices else ""
        except ImportError:
            # Fallback to REST if lib not installed
            async with httpx.AsyncClient() as c:
                resp = await c.post("https://api.mistral.ai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.MISTRAL_API_KEY}"},
                    json={"model": model or settings.MISTRAL_MODEL, "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}]}
                )
                return resp.json()["choices"][0]["message"]["content"]

    elif p == "cohere":
        import cohere
        co = cohere.Client(settings.COHERE_API_KEY)
        response = co.chat(model=model or settings.COHERE_MODEL, message=f"{system_prompt}\n\n{user_prompt}")
        return response.text

    elif p == "together":
        from together import Together
        client = Together(api_key=settings.TOGETHER_API_KEY)
        response = client.chat.completions.create(
            model=model or settings.TOGETHER_MODEL,
            messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}]
        )
        return response.choices[0].message.content or ""

    elif p == "huggingface":
        async with httpx.AsyncClient() as c:
            resp = await c.post(
                f"https://api-inference.huggingface.co/models/{model or settings.HUGGINGFACE_MODEL}",
                headers={"Authorization": f"Bearer {settings.HUGGINGFACE_API_KEY}"},
                json={"inputs": f"{system_prompt}\n\n{user_prompt}"}
            )
            res = resp.json()
            return res[0].get("generated_text", str(res)) if isinstance(res, list) else str(res)

    elif p == "anthropic":
        client = get_anthropic_client()
        response = await client.messages.create(
            model=model or settings.ANTHROPIC_MODEL,
            max_tokens=max_tokens, system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}]
        )
        return response.content[0].text if response.content else ""
        
    else:
        raise ValueError(f"Unknown provider: {p}")

_SYNTHESIS_PROMPTS: dict[str, str] = {
    "resume": (
        "You are an expert resume writer. Multiple AI models have generated resume content. "
        "Synthesize the BEST elements from each response into a single superior JSON output. "
        "Pick the most impactful bullets, clearest summary, and most complete skills_grouped. "
        "Return ONLY valid JSON."
    ),
    "cover_letter": (
        "You are an expert cover letter editor. Multiple AI models have drafted a cover letter. "
        "Synthesize the BEST version: most compelling opening, strongest technical alignment, "
        "most confident closing. Return only the final cover letter text."
    ),
    "interview": (
        "You are a senior technical recruiter. Multiple AI models have generated interview questions. "
        "Synthesize the BEST and most diverse set of 8-10 questions, eliminating duplicates and "
        "keeping the hardest/most insightful ones. Return ONLY valid JSON with a 'questions' key."
    ),
    "skill_gap": (
        "You are a senior engineering career coach. Multiple AI models have analyzed a skill gap. "
        "Synthesize the BEST roadmap: most actionable phases, most accurate market insights, "
        "most practical quick wins. Return ONLY valid JSON."
    ),
    "outreach": (
        "You are a LinkedIn messaging expert. Multiple AI models have drafted an outreach message. "
        "Pick the most concise, confident, and compelling version under 100 words. "
        "Return only the final message text."
    ),
    "negotiation": (
        "You are a compensation negotiation expert. Multiple AI models have generated negotiation advice. "
        "Synthesize the strongest counter-offer rationale, most persuasive talking points, and "
        "most professional email template. Return ONLY valid JSON."
    ),
    # ── Power Tool synthesis prompts ──────────────────────────────────────────
    "hiring_decoder": (
        "You are an expert hiring manager analyst. Multiple AI models have decoded a job description. "
        "Synthesize the most insightful real_problem, the sharpest instant_forward signals, the most accurate "
        "instant_reject signals, and the most revealing culture_signals. "
        "Pick the most specific and actionable insights from each response. Return ONLY valid JSON."
    ),
    "resume_surgeon": (
        "You are a world-class executive resume writer. Multiple AI models have rewritten a resume. "
        "Synthesize the BEST version: most impactful summary using JD language, most powerful and specific "
        "experience bullets (each starting with a strong verb and ending with a metric), "
        "most complete skills section. Return ONLY valid JSON."
    ),
    "linkedin_infiltrator": (
        "You are a LinkedIn recruiter and SEO expert. Multiple AI models have optimized a LinkedIn profile. "
        "Synthesize: the most precise boolean_search, the most keyword-rich optimized_headline under 120 chars, "
        "the most compelling and discoverable optimized_about section, and the sharpest profile_quick_wins. "
        "Return ONLY valid JSON."
    ),
    "interview_trap": (
        "You are a senior technical interviewer. Multiple AI models have generated interview questions. "
        "Synthesize the 10 best and most diverse questions — keep the hardest traps, best behavioral questions, "
        "most technical situational questions. Eliminate duplicates. "
        "Ensure each question has a natural, human-sounding strong_answer. Return ONLY valid JSON."
    ),
    "cold_email": (
        "You are a headhunter and copywriter. Multiple AI models have created cold outreach assets. "
        "Synthesize: the most compelling email subject line, the tightest 4-line email body, "
        "the most natural voice_note_script, and the best follow_up_sequence. "
        "Every word must earn its place. Return ONLY valid JSON."
    ),
    "offer_negotiator": (
        "You are a compensation negotiation expert. Multiple AI models have created negotiation scripts. "
        "Synthesize: the most precise market_assessment, the strongest counter_offer with best justification, "
        "the most effective live_call_script, the best if_they_say_best_offer response, "
        "and the most professional counter_offer_email. Return ONLY valid JSON."
    ),
    "gap_killer": (
        "You are a career coach specializing in gap reframing. Multiple AI models have addressed an employment gap. "
        "Synthesize: the most confident and natural interview_answer under 45 seconds when spoken, "
        "the most positive cover_letter_sentences, and the most compelling reframe_as_strength. "
        "Keep everything honest and forward-looking. Return ONLY valid JSON."
    ),
    "attack_plan": (
        "You are a job search strategist. Multiple AI models have created a 48-hour attack plan. "
        "Synthesize: the most specific target_companies with best insider tips, "
        "the most engaging and shareable linkedin_post, the most effective referral_outreach template, "
        "and the most actionable hour_by_hour breakdown. Return ONLY valid JSON."
    ),
    "job_evaluator": (
        "You are an elite career strategist. Multiple AI models have performed a 6-Block Job Evaluation. "
        "Synthesize the BEST analysis: most accurate archetype classification, most thorough strengths/gaps analysis, "
        "strongest level strategy, most realistic compensation range, most impactful resume personalization edits, "
        "and most insightful STAR+R interview stories. Resolve conflicting scores by averaging. Return ONLY valid JSON."
    ),
    "ats_gap": (
        "You are an ATS optimization expert. Multiple AI models have analyzed a skill gap. "
        "Synthesize the most accurate matched/missing skills and the most actionable suggestions. "
        "Return ONLY valid JSON with keys: matched, missing, suggestions."
    ),
    "resume_parse": (
        "You are an expert resume parser. Multiple AI models have extracted profile data from a resume. "
        "Synthesize the most complete and accurate profile: use the most complete name, most specific role, "
        "highest experience_years, most comprehensive skills/frameworks/languages/cicd_tools/ai_tools arrays, "
        "most complete certifications list, and most specific location. Return ONLY valid JSON."
    ),
    "default": (
        "You are an expert synthesizer. Multiple AI models have responded to the same prompt. "
        "Combine the best insights from each into a single, superior, coherent response. "
        "Remove redundancy. Preserve all unique and high-quality content."
    ),
}


async def smart_chat(
    system_prompt: str,
    user_prompt: str,
    max_tokens: int = 2000,
    temperature: float = 0.7,
    task_type: str = "default",
    cache_ttl: int = 900,
) -> str:
    """Calls consolidated_chat or chat depending on CONSOLIDATED_MODE setting."""
    if settings.CONSOLIDATED_MODE:
        return await consolidated_chat(
            system_prompt, user_prompt,
            max_tokens=max_tokens, temperature=temperature,
            task_type=task_type, cache_ttl=cache_ttl,
        )
    return await chat(system_prompt, user_prompt, max_tokens=max_tokens, temperature=temperature, cache_ttl=cache_ttl)


async def consolidated_chat(
    system_prompt: str,
    user_prompt: str,
    providers: List[str] | None = None,
    max_tokens: int = 2000,
    temperature: float = 0.7,
    task_type: str = "default",
    cache_ttl: int = 900,
) -> str:
    """Fetch from multiple providers in parallel, then synthesize with task-aware prompt."""
    target_providers = providers or ["groq", "openai", "google", "anthropic"]
    active_providers = [p for p in target_providers if getattr(settings, f"{p.upper()}_API_KEY", None)]

    if not active_providers:
        return await chat(system_prompt, user_prompt, max_tokens=max_tokens, temperature=temperature, cache_ttl=cache_ttl)

    tasks = [
        chat(system_prompt, user_prompt, provider=p, max_tokens=max_tokens, temperature=temperature, cache_ttl=cache_ttl)
        for p in active_providers
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    valid_results = [
        f"--- Provider: {active_providers[i]} ---\n{res}"
        for i, res in enumerate(results)
        if isinstance(res, str) and res.strip() and not res.startswith("Error:")
    ]

    if not valid_results:
        return "Error: All providers failed."

    # Single provider result — no synthesis needed
    if len(valid_results) == 1:
        return valid_results[0].split("\n", 1)[1].strip()

    synthesis_prompt = _SYNTHESIS_PROMPTS.get(task_type, _SYNTHESIS_PROMPTS["default"])
    return await chat(
        system_prompt=synthesis_prompt,
        user_prompt="\n\n".join(valid_results),
        provider=active_providers[0],
        max_tokens=max_tokens,
        temperature=0.3,
        cache_ttl=0,  # synthesis is always fresh
    )

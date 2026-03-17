from anthropic import AsyncAnthropic
from openai import AsyncOpenAI
from groq import AsyncGroq
import google.generativeai as genai

from core.config import settings

_anthropic_client: AsyncAnthropic | None = None
_openai_client: AsyncOpenAI | None = None
_groq_client: AsyncGroq | None = None
_perplexity_client: AsyncOpenAI | None = None


def get_anthropic_client() -> AsyncAnthropic:
    global _anthropic_client
    if _anthropic_client is None:
        _anthropic_client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _anthropic_client


def get_openai_client() -> AsyncOpenAI:
    global _openai_client
    if _openai_client is None:
        _openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    return _openai_client


def get_groq_client() -> AsyncGroq:
    global _groq_client
    if _groq_client is None:
        _groq_client = AsyncGroq(api_key=settings.GROQ_API_KEY)
    return _groq_client


def get_perplexity_client() -> AsyncOpenAI:
    global _perplexity_client
    if _perplexity_client is None:
        _perplexity_client = AsyncOpenAI(
            api_key=settings.PERPLEXITY_API_KEY,
            base_url="https://api.perplexity.ai"
        )
    return _perplexity_client


import asyncio
from typing import List, Dict

async def chat(
    system_prompt: str,
    user_prompt: str,
    provider: str | None = None,
    model: str | None = None,
    max_tokens: int = 2000,
    temperature: float = 0.7,
) -> str:
    """Multi-provider chat call. Respects CONSOLIDATED_MODE if provider is not forced."""
    # If consolidated mode is ON and we're not forcing a specific provider, use it
    if settings.CONSOLIDATED_MODE and provider is None:
        return await consolidated_chat(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            max_tokens=max_tokens,
            temperature=temperature
        )

    target_provider = provider or settings.LLM_PROVIDER
    
    if target_provider == "openai":
        client = get_openai_client()
        target_model = model or settings.OPENAI_MODEL
        response = await client.chat.completions.create(
            model=target_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return response.choices[0].message.content or ""
    elif target_provider == "groq":
        client = get_groq_client()
        target_model = model or settings.GROQ_MODEL
        response = await client.chat.completions.create(
            model=target_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return response.choices[0].message.content or ""
    elif target_provider == "google":
        genai.configure(api_key=settings.GOOGLE_API_KEY)
        target_model = model or settings.GOOGLE_MODEL
        client = genai.GenerativeModel(
            model_name=target_model,
            system_instruction=system_prompt,
        )
        response = await client.generate_content_async(
            user_prompt,
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=max_tokens,
                temperature=temperature,
            ),
        )
        return response.text
    elif target_provider == "perplexity":
        client = get_perplexity_client()
        target_model = model or settings.PERPLEXITY_MODEL
        response = await client.chat.completions.create(
            model=target_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return response.choices[0].message.content or ""
    else:
        # Fallback to Anthropic if explicitly asked or as ultimate fallback
        client = get_anthropic_client()
        target_model = model or settings.ANTHROPIC_MODEL
        response = await client.messages.create(
            model=target_model,
            max_tokens=max_tokens,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        return response.content[0].text if response.content else ""

async def consolidated_chat(
    system_prompt: str,
    user_prompt: str,
    providers: List[str] | None = None,
    max_tokens: int = 2000,
    temperature: float = 0.7,
) -> str:
    """Fetch from multiple providers in parallel and consolidate."""
    target_providers = providers or ["anthropic", "openai", "google", "groq", "perplexity"]
    
    # Filter only providers with keys configured
    active_providers = []
    if "anthropic" in target_providers and settings.ANTHROPIC_API_KEY: active_providers.append("anthropic")
    if "openai" in target_providers and settings.OPENAI_API_KEY: active_providers.append("openai")
    if "google" in target_providers and settings.GOOGLE_API_KEY: active_providers.append("google")
    if "groq" in target_providers and settings.GROQ_API_KEY: active_providers.append("groq")
    if "perplexity" in target_providers and settings.PERPLEXITY_API_KEY: active_providers.append("perplexity")
    
    # If only one or zero active providers, just use the normal chat
    if len(active_providers) <= 1:
        return await chat(system_prompt, user_prompt, max_tokens=max_tokens, temperature=temperature, provider=active_providers[0] if active_providers else None)

    # Fetch in parallel
    tasks = [
        chat(system_prompt, user_prompt, provider=p, max_tokens=max_tokens, temperature=temperature)
        for p in active_providers
    ]
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    valid_results = []
    for i, res in enumerate(results):
        if isinstance(res, str) and res.strip():
            valid_results.append(f"--- Provider: {active_providers[i]} ---\n{res}")
    
    if not valid_results:
        return "Error: All LLM providers failed to return a result."

    # Final consolidation step using the primary provider (force provider to avoid recursion)
    consolidation_prompt = f"Consolidate the following responses from different AI models into one high-quality, comprehensive answer. Maintain the best parts of each while removing redundancies:\n\n" + "\n\n".join(valid_results)
    
    return await chat(
        system_prompt="You are a Master AI Aggregator. Your job is to take multiple AI responses and combine them into a single, perfect version.",
        user_prompt=consolidation_prompt,
        provider=active_providers[0], # Use the first available provider as the synthesizer
        max_tokens=max_tokens,
        temperature=0.3
    )

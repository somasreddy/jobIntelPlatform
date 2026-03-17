from anthropic import AsyncAnthropic
from openai import AsyncOpenAI

from core.config import settings

_anthropic_client: AsyncAnthropic | None = None
_openai_client: AsyncOpenAI | None = None


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


async def chat(
    system_prompt: str,
    user_prompt: str,
    model: str | None = None,
    max_tokens: int = 1500,
    temperature: float = 0.7,
) -> str:
    """Multi-provider chat call."""
    if settings.LLM_PROVIDER == "openai":
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
    else:
        client = get_anthropic_client()
        target_model = model or settings.ANTHROPIC_MODEL
        response = await client.messages.create(
            model=target_model,
            max_tokens=max_tokens,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        return response.content[0].text if response.content else ""

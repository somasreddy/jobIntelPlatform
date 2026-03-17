from anthropic import AsyncAnthropic

from core.config import settings

_client: AsyncAnthropic | None = None


def get_llm_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        _client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _client


async def chat(
    system_prompt: str,
    user_prompt: str,
    model: str = settings.ANTHROPIC_MODEL,
    max_tokens: int = 1500,
    temperature: float = 0.7,
) -> str:
    """Single-turn LLM call. Returns content string."""
    client = get_llm_client()
    response = await client.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )
    return response.content[0].text if response.content else ""

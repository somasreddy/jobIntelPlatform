from typing import List, Union
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings


def _normalize_async_database_url(value: str) -> tuple[str, bool]:
    """Return a SQLAlchemy asyncpg URL and whether SSL should be forced."""
    url = (value or "").strip()
    if not url:
        return url, False

    if url.startswith("postgres://"):
        url = "postgresql+asyncpg://" + url[len("postgres://"):]
    elif url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://"):]
    elif url.startswith("postgresql+psycopg://") or url.startswith("postgresql+psycopg2://"):
        url = "postgresql+asyncpg://" + url.split("://", 1)[1]

    parts = urlsplit(url)
    query_items: list[tuple[str, str]] = []
    force_ssl = False
    uses_pooler = parts.port == 6543

    for key, val in parse_qsl(parts.query, keep_blank_values=True):
        lower = key.lower()
        if lower == "sslmode":
            force_ssl = val.lower() in {"require", "verify-ca", "verify-full"}
            continue
        if lower in {"pgbouncer", "connection_limit", "pool_timeout"}:
            uses_pooler = uses_pooler or lower == "pgbouncer"
            continue
        query_items.append((key, val))

    if uses_pooler and not any(k == "prepared_statement_cache_size" for k, _ in query_items):
        query_items.append(("prepared_statement_cache_size", "0"))

    normalized = urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query_items), parts.fragment))
    return normalized, force_ssl

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Job Intelligence API"
    CORS_ORIGINS: Union[List[str], str] = ["http://localhost:3000", "http://localhost:3001"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, str) and v.startswith("["):
            import json
            return json.loads(v)
        return v

    @model_validator(mode="after")
    def assemble_database_url(self):
        default_url = "postgresql+asyncpg://postgres:postgres@localhost:5432/job_platform"
        if not self.DATABASE_URL or self.DATABASE_URL == default_url:
            self.DATABASE_URL = (
                self.POSTGRES_URL
                or self.POSTGRES_PRISMA_URL
                or self.POSTGRES_URL_NON_POOLING
                or self.DATABASE_URL
            )
        self.DATABASE_URL, self.DATABASE_SSL_REQUIRED = _normalize_async_database_url(self.DATABASE_URL)
        if self.DIRECT_URL:
            self.DIRECT_URL, _ = _normalize_async_database_url(self.DIRECT_URL)
        return self

    # Database
    # Vercel/Supabase integrations usually expose POSTGRES_URL variables.
    # DATABASE_URL remains supported and wins when explicitly configured.
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/job_platform"
    DIRECT_URL: str = ""
    POSTGRES_URL: str = ""
    POSTGRES_PRISMA_URL: str = ""
    POSTGRES_URL_NON_POOLING: str = ""
    DATABASE_SSL_REQUIRED: bool = False
    # Comma-separated break-glass/local admin allowlist; database role remains authoritative.
    ADMIN_EMAILS: str = "demo@jobintel.ai"
    ENVIRONMENT: str = "development"
    REQUIRE_AUTH: str = "false"
    ENABLE_STARTUP_SCHEMA_SYNC: bool = False
    ENABLE_CONTRACT_CONNECTORS: bool = True
    ENABLE_DETERMINISTIC_RANKING: bool = True
    ENABLE_PROFILE_INTELLIGENCE: bool = True
    ENABLE_ADMIN_OPERATIONS: bool = True


    # Redis / Celery
    REDIS_URL: str = "redis://localhost:6379/0"

    # LLM API
    LLM_PROVIDER: str = "openai"  # "anthropic", "openai", "google", "groq", or "perplexity"
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-3-5-sonnet-20241022"

    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o"

    GOOGLE_API_KEY: str = ""
    GOOGLE_MODEL: str = "gemini-1.5-flash"

    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    PERPLEXITY_API_KEY: str = ""
    PERPLEXITY_MODEL: str = "sonar-reasoning-pro"

    # New Providers (Alternative Free/Cheap)
    MISTRAL_API_KEY: str = ""
    MISTRAL_MODEL: str = "mistral-small-latest"

    COHERE_API_KEY: str = ""
    COHERE_MODEL: str = "command-r"

    TOGETHER_API_KEY: str = ""
    TOGETHER_MODEL: str = "meta-llama/Llama-3-70b-chat-hf"

    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_MODEL: str = "deepseek-chat"

    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "meta-llama/llama-3.3-70b-instruct:free"

    HUGGINGFACE_API_KEY: str = ""
    HUGGINGFACE_MODEL: str = "Qwen/Qwen2.5-72B-Instruct"

    LLM_FALLBACK_ORDER: str = "groq,deepseek,mistral,openrouter,openai,anthropic,google"

    CONSOLIDATED_MODE: bool = True

    # Job Discovery API Keys
    ADZUNA_APP_ID: str = ""   # https://developer.adzuna.com/
    ADZUNA_APP_KEY: str = ""
    JSEARCH_API_KEY: str = "" # https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch (aggregates LinkedIn/Indeed/Glassdoor/Naukri)

    class Config:
        import os
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        env_file = os.path.join(base_dir, ".env")
        case_sensitive = True
        extra = "ignore"

settings = Settings()

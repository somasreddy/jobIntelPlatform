from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings

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

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/job_platform"

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

settings = Settings()

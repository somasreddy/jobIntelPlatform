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
    ANTHROPIC_MODEL: str = "claude-haiku-4-5-20251001"
    
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    
    GOOGLE_API_KEY: str = ""
    GOOGLE_MODEL: str = "gemini-1.5-pro"
    
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    
    PERPLEXITY_API_KEY: str = ""
    PERPLEXITY_MODEL: str = "sonar-reasoning"
    
    CONSOLIDATED_MODE: bool = False
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()

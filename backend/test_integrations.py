import asyncio
import os
import sys
from unittest.mock import MagicMock # Keep this import as it's not explicitly removed and the replacement is malformed
import pytest

pytestmark = pytest.mark.integration

# Add current directory to path for imports (priority)
project_root = os.path.dirname(os.path.abspath(__file__))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from core.llm import chat, settings
from job_discovery.service_v2 import JobDiscoveryService

async def test_llms():
    print("\n--- Testing LLM Providers ---")
    
    # Disable consolidated mode for manual testing of each provider
    original_consolidated = settings.CONSOLIDATED_MODE
    settings.CONSOLIDATED_MODE = False
    
    # Default to a stable model for testing if not set
    if not settings.GOOGLE_MODEL:
        settings.GOOGLE_MODEL = "gemini-1.5-flash"
    
    # Expanded list of providers to test
    providers = ["openai", "google", "groq", "deepseek", "openrouter"]
    for provider in providers:
        print(f"Testing {provider}...")
        try:
            # Simple prompt to test connectivity
            response = await chat(
                system_prompt="You are a helpful assistant.",
                user_prompt=f"Say 'Connected to {provider}' briefly.",
                provider=provider
            )
            print(f"Response from {provider}: {response.strip()}")
        except Exception as e:
            print(f"Error testing {provider}: {e}")
    
    settings.CONSOLIDATED_MODE = original_consolidated

async def test_llm_fallback():
    print("\n--- Testing LLM Fallback Chain ---")
    # Temporarily force a fallback chain starting with a missing/fake provider
    original_chain = settings.LLM_FALLBACK_ORDER
    # We'll put 'groq' at the end since we know it works, and fake ones before it
    settings.LLM_FALLBACK_ORDER = "fake_provider, groq"
    
    try:
        print("Attempting chat with fallback (expecting 'fake_provider' to fail and skip to 'groq')...")
        response = await chat(
            system_prompt="You are a fallback test.",
            user_prompt="Say 'Fallback Success' briefly."
        )
        print(f"Fallback Response: {response.strip()}")
    except Exception as e:
        print(f"Fallback Test Failed: {e}")
    finally:
        settings.LLM_FALLBACK_ORDER = original_chain

async def test_job_discovery():
    print("\n--- Testing Job Discovery ---")
    svc = JobDiscoveryService(
        adzuna_app_id=settings.ADZUNA_APP_ID,
        adzuna_app_key=settings.ADZUNA_APP_KEY,
        jsearch_api_key=settings.JSEARCH_API_KEY,
    )
    
    print("Discovering 'Python Developer' in 'Remote'...")
    try:
        jobs = await svc.discover_jobs(
            role="Python Developer",
            location="Remote",
            run_verification=False # Skip for speed
        )
        print(f"Found {len(jobs)} jobs total.")
        
        # Count by source
        sources = {}
        for j in jobs:
            s = j.get("source", "Unknown")
            sources[s] = sources.get(s, 0) + 1
        
        print("Jobs by source:")
        for s, count in sources.items():
            print(f" - {s}: {count}")
            
    except Exception as e:
        print(f"Error in job discovery: {e}")

async def main():
    # Ensure env is loaded (pydantic-settings does this automatically via settings)
    print(f"Loaded Anthropic Key starts with: {settings.ANTHROPIC_API_KEY[:8]}...")
    
    await test_llms()
    await test_llm_fallback()
    await test_job_discovery()

if __name__ == "__main__":
    asyncio.run(main())

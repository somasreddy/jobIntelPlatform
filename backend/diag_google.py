import asyncio
import google.generativeai as genai
from core.config import settings

async def list_google_models():
    print("--- Diagnostic: Listing Google Models ---")
    try:
        genai.configure(api_key=settings.GOOGLE_API_KEY)
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                print(f"Model: {m.name}")
    except Exception as e:
        print(f"Error listing models: {e}")

if __name__ == "__main__":
    asyncio.run(list_google_models())

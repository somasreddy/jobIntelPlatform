# Deployment Guide: AI Job Intelligence Platform

Follow these steps to deploy the platform live.

## Prerequisites

1. **Render Backend URL**: `https://jobintelplatform.onrender.com`
2. **Neon PostgreSQL**: Connection string ready.
    - *Format*: `postgresql+asyncpg://user:pass@ep-xxx.neon.tech/neondb?ssl=require`
3. **Redis**: Sign up at [upstash.com](https://upstash.com), create a Redis database, and copy the `rediss://` URL.
4. **Anthropic API**: Get your API key from [console.anthropic.com](https://console.anthropic.com).

## 1. Backend Deployment (Render.com)

1. Create a **New Web Service** on [Render](https://render.com) and connect your GitHub repo.
2. **Root Directory**: `backend` (or `job-intelligence-platform/backend` if not at root).
3. **Build Command**: `pip install -r requirements.txt`
4. **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. **Environment Variables** — see full variable list below in the Environment Variables Reference section.

## 2. Frontend Deployment (Vercel.com)

1. Import your Git repository to [Vercel](https://vercel.com).
2. **Root Directory**: `frontend`.
3. **Framework Preset**: Next.js (auto-detected).
4. **Environment Variables**:
    - `NEXT_PUBLIC_API_URL`: Your Render backend URL (e.g., `https://job-intel-api.onrender.com`).

## Technical Notes

- **LLM Model**:
  - To use Anthropic (Enterprise): Set `LLM_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`, and `ANTHROPIC_MODEL`. [Dashboard](https://console.anthropic.com/settings/keys)
  - To use OpenAI: Set `LLM_PROVIDER=openai`, `OPENAI_API_KEY`, and `OPENAI_MODEL`. [Dashboard](https://platform.openai.com/api-keys)
  - To use Google Gemini: Set `LLM_PROVIDER=google`, `GOOGLE_API_KEY`, and `GOOGLE_MODEL`. [Dashboard](https://aistudio.google.com/app/apikey)
  - To use Groq: Set `LLM_PROVIDER=groq`, `GROQ_API_KEY`, and `GROQ_MODEL`. [Dashboard](https://console.groq.com/keys)
  - To use Perplexity: Set `LLM_PROVIDER=perplexity`, `PERPLEXITY_API_KEY`, and `PERPLEXITY_MODEL`. [Dashboard](https://www.perplexity.ai/settings/api)
- **Consolidated Mode**: Set `CONSOLIDATED_MODE=true` to fetch data from ALL configured providers in parallel and consolidate the results into a single high-quality response. (Requires at least two API keys).
- **Static Export**: The project is configured for standard Next.js deployment (SSR/ISR) on Vercel. Static export (`output: export`) is disabled to support dynamic job detail pages.

---

## Environment Variables Reference (Render)

### Required

```env
DATABASE_URL=postgresql+asyncpg://<user>:<pass>@<host>.neon.tech/<db>?sslmode=require
REDIS_URL=rediss://default:<pass>@<host>.upstash.io:6379
CORS_ORIGINS=["https://your-app.vercel.app","http://localhost:3000"]
```

### LLM Keys (add whichever you have — at least one required)

```env
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-proj-...
GOOGLE_API_KEY=AIza...
GROQ_API_KEY=gsk_...
MISTRAL_API_KEY=...
DEEPSEEK_API_KEY=sk-...
OPENROUTER_API_KEY=sk-or-...
COHERE_API_KEY=...
TOGETHER_API_KEY=tgp_v1_...
HUGGINGFACE_API_KEY=hf_...
PERPLEXITY_API_KEY=pplx-...
```

### LLM Models

```env
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
OPENAI_MODEL=gpt-4o
GOOGLE_MODEL=gemini-2.0-flash
GROQ_MODEL=llama-3.3-70b-versatile
MISTRAL_MODEL=mistral-small-latest
DEEPSEEK_MODEL=deepseek-chat
OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free
COHERE_MODEL=command-r
TOGETHER_MODEL=meta-llama/Llama-3-70b-chat-hf
HUGGINGFACE_MODEL=Qwen/Qwen2.5-72B-Instruct
PERPLEXITY_MODEL=sonar-reasoning-pro
```

### Strategy & Features

```env
LLM_FALLBACK_ORDER=groq,deepseek,mistral,openrouter,openai,anthropic,google
CONSOLIDATED_MODE=true
```

### Job Discovery (optional)

```env
ADZUNA_APP_ID=...
ADZUNA_APP_KEY=...
JSEARCH_API_KEY=...
```

### Initialize Database

After first Render deploy, paste `database/schema.sql` into your **Neon SQL Editor** at console.neon.tech.

### Celery Workers (optional — background job discovery)

Create a **Background Worker** service on Render with:

- Build: `pip install -r requirements.txt`
- Start: `celery -A workers.celeryconfig worker --loglevel=info`

Create a second **Background Worker** for the beat scheduler:

- Start: `celery -A workers.celeryconfig beat --loglevel=info`

Both workers use the same environment variables as the web service.

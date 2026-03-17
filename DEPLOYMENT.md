# Deployment Guide: AI Job Intelligence Platform

Follow these steps to deploy the platform live.

## Prerequisites

1. **PostgreSQL**: Sign up at [neon.tech](https://neon.tech), create a project, and copy the **connection string**.
    - *Format*: `postgresql+asyncpg://user:pass@ep-xxx.neon.tech/neondb?ssl=require`
2. **Redis**: Sign up at [upstash.com](https://upstash.com), create a Redis database, and copy the `rediss://` URL.
3. **Anthropic API**: Get your API key from [console.anthropic.com](https://console.anthropic.com).

## 1. Backend Deployment (Render.com)

1. Create a **New Web Service** on [Render](https://render.com) and connect your GitHub repo.
2. **Root Directory**: `backend` (or `job-intelligence-platform/backend` if not at root).
3. **Build Command**: `pip install -r requirements.txt`
4. **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. **Environment Variables**:
    - `DATABASE_URL`: `postgresql+asyncpg://neondb_owner:npg_xr6tAC4eSYVh@ep-morning-sound-a46t8n0d-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require`
    - `REDIS_URL`: `rediss://default:gQAAAAAAAR8mAAIncDI5ZDE4YTM0YTE4YmU0NjQzOWNiZmQ5ZjUwMGIyZmQyNXAyNzM1MTA@viable-gelding-73510.upstash.io:6379`
    - `ANTHROPIC_API_KEY`: Your sk-ant-... key.
    - `CORS_ORIGINS`: `["https://your-app.vercel.app"]` (Update with your Vercel URL later).

## 2. Frontend Deployment (Vercel.com)

1. Import your Git repository to [Vercel](https://vercel.com).
2. **Root Directory**: `frontend`.
3. **Framework Preset**: Next.js (auto-detected).
4. **Environment Variables**:
    - `NEXT_PUBLIC_API_URL`: Your Render backend URL (e.g., `https://job-intel-api.onrender.com`).

## Technical Notes

- **LLM Model**:
  - To use Anthropic (Enterprise): Set `LLM_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`, and `ANTHROPIC_MODEL`.
  - To use OpenAI: Set `LLM_PROVIDER=openai`, `OPENAI_API_KEY`, and `OPENAI_MODEL`.
- **Static Export**: The project is configured for standard Next.js deployment (SSR/ISR) on Vercel. Static export (`output: export`) is disabled to support dynamic job detail pages.

# Job Intelligence Platform - Enterprise Production Audit

Audit date: 2026-07-05

## Executive Readiness Verdict

The app has strong product ambition and broad feature coverage: job discovery, ATS resume generation, career graph, applications pipeline, learning paths, market radar, interview prep, portfolio tooling, and a newly integrated QA dashboard. It is not yet enterprise-production ready. The main blockers are authentication hardening, database migrations, secrets/config governance, durable rate limiting, observability, API contract discipline, test automation, and UX simplification.

## Implementation Status From Recent Work

Completed:
- Added QA Dashboard route and navigation entry.
- Integrated NxtJob resume guide into backend knowledge prompts.
- Added no-key Google-style dork job discovery.
- Added `/api/jobs/dork-query`.
- Rewired active job discovery away from Apify/LinkedIn/API-key dependent paths.
- Added generic role, skills, experience, and location search controls to the QA Dashboard.
- Fixed local PWA/service-worker offline behavior for development.
- Switched frontend dev script to Turbopack for local stability.
- Added explicit Next tracing root to reduce monorepo/OneDrive confusion.
- Added backend CORS safety middleware for error and preflight responses.
- Removed noisy legacy job-discovery debug startup print.

Validated:
- Backend AST parse passed for the changed Python files.
- Frontend TypeScript passed with `tsc -p frontend/tsconfig.json --noEmit`.
- Active no-key discovery import and dork query generation passed.

Known environment limitation:
- PostgreSQL is not currently running/configured locally, so DB-backed endpoints degrade or fail until `DATABASE_URL` points to a working database.

## P0 - Must Fix Before Any Real Production Use

### 1. Authentication can silently fall back to a shared demo user

Risk: Cross-user data exposure in any environment where `REQUIRE_AUTH=true` is not explicitly set. The default secret is also unsafe.

Evidence:
- `backend/core/auth.py` uses default `_SECRET_KEY = "change-me-in-production-use-env-var"`.
- `get_current_user` falls back to `_DEMO_USER_ID` when no bearer token is provided unless `REQUIRE_AUTH=true`.

Required:
- Add `JWT_SECRET_KEY` and `REQUIRE_AUTH` to typed settings.
- Fail startup in non-dev if secret is missing/default.
- Remove demo fallback from production builds.
- Add role/tenant claims and server-side refresh-token rotation.

### 2. Tokens are stored in localStorage

Risk: XSS compromises access and refresh tokens.

Evidence:
- `frontend/lib/AuthContext.tsx` stores `ji_token` and `ji_refresh` in `localStorage`.

Required:
- Move auth to httpOnly, secure, SameSite cookies.
- Add CSRF protection for cookie-auth writes.
- Add refresh-token reuse detection and revocation.

### 3. Database lifecycle is not enterprise-safe

Risk: Auto-created tables drift from source control; no repeatable migrations; local DB failure is hidden in degraded mode.

Evidence:
- `backend/main.py` calls `Base.metadata.create_all`.
- `backend/api/auth.py` creates the `users` table with raw SQL at request time.
- Alembic is in requirements but no migration folder is present.

Required:
- Introduce Alembic migrations for all tables, indexes, constraints, and extensions.
- Remove request-time DDL.
- Add startup migration check.
- Add backup/restore plan, seed scripts, and migration CI gate.

### 4. User data isolation is inconsistent

Risk: Some AI/helper endpoints accept arbitrary payloads without user scoping or auth, and generated documents may be produced from client-supplied data.

Evidence:
- Several endpoints use `Body(...)` without `get_current_user_id`, including salary, recruiter, skill-gap, and multiple stream endpoints.
- Public resume download endpoints accept base64 payloads and return decoded files.

Required:
- Classify endpoints as public, authenticated-user, or admin.
- Enforce auth dependencies consistently.
- Add ownership checks for all IDs.
- Add endpoint-level authorization tests.

### 5. In-memory rate limiting will not work in production

Risk: Rate limits reset per process, are bypassed by horizontal scaling, and can grow unbounded.

Evidence:
- `backend/main.py` stores request timestamps in `_rate_store`.

Required:
- Move rate limiting to Redis or API gateway.
- Add per-user, per-IP, and per-route quotas.
- Add LLM spend controls and circuit breakers.

## P1 - Production Architecture Improvements

### API Contract And Validation

Issues:
- Many endpoints accept raw `dict = Body(...)`.
- Response shapes vary between snake_case and camelCase.
- Frontend API helper still references legacy endpoint paths.
- Errors are mostly generic strings rather than typed error codes.

Required:
- Replace raw dict payloads with Pydantic request/response models.
- Generate OpenAPI clients or shared TypeScript contracts.
- Standardize response casing and pagination.
- Add typed error format: `code`, `message`, `details`, `request_id`.

### Job Discovery Reliability

Issues:
- Search-engine scraping is best-effort and can hit CAPTCHA/rate limits.
- Discovery runs synchronously from API request path.
- Selected portal labels in QA dashboard are UI source families, not hard routing controls.

Required:
- Move discovery to background jobs with Redis/Celery.
- Store query, source, crawl status, error reason, and freshness metadata.
- Add robots.txt/compliance policy and backoff.
- Add result quality scoring, duplicate canonicalization, and manual review queue.

### Observability

Issues:
- No structured logging, tracing, metrics, request IDs, SLOs, or audit events.

Required:
- Add JSON logs with correlation IDs.
- Add OpenTelemetry traces for API, DB, LLM, crawler, and workers.
- Add metrics for latency, error rate, discovery yield, LLM cost, token usage, auth failures, and DB pool saturation.
- Add health checks for DB, Redis, LLM providers, and crawler dependencies.

### Deployment And Runtime

Issues:
- `docker-compose.yml` still exposes default DB credentials and old API-key envs.
- Backend Docker image runs as root and has no healthcheck.
- Frontend has no production Dockerfile or deployment profile.

Required:
- Separate local, staging, and production configs.
- Use non-root containers.
- Add healthchecks, readiness checks, and resource limits.
- Add secret manager integration.
- Add CI/CD pipeline with build, test, migration, scan, and deploy stages.

### Background Workers

Issues:
- Workers exist, but production job semantics are unclear.
- No retry policy, dead-letter queue, idempotency keys, or dashboard.

Required:
- Define queues by workload: discovery, verification, LLM generation, notifications.
- Add idempotency and dedupe keys.
- Add retry/backoff/dead-letter behavior.
- Add worker observability and admin replay tools.

## P2 - Product And UX Enhancements

### Product Strategy

Recommended enterprise positioning:
- Career operating system for senior technical candidates.
- Enterprise-grade career intelligence with evidence-backed recommendations.
- Differentiator: profile-to-market-to-application feedback loop.

Core product loops:
- Profile completeness -> job discovery -> fit scoring -> resume tailoring -> application tracking -> interview prep -> outcome analytics -> learning plan.

Enhancements:
- Add onboarding progress checklist.
- Add “next best action” engine across all modules.
- Add job/source trust score.
- Add application ROI dashboard.
- Add recruiter/contact CRM.
- Add resume versioning with diff and rollback.
- Add role target profiles: QA, SDET, EM, Architect, Product Manager.
- Add explainable fit scoring with missing keywords, seniority mismatch, salary fit, and location fit.

### UX And Information Architecture

Issues:
- Navigation has too many first-level items.
- The visual system is highly decorative for an operational tool.
- Several pages use mock/fallback data without a clear environment badge.
- Dense workflows are split across many modules, increasing cognitive load.

Required:
- Group nav into: Discover, Apply, Prepare, Grow, Insights, Settings.
- Add environment/status banner: demo, offline, degraded DB, live.
- Add empty states with recovery actions.
- Add skeleton loading and error states for every API-driven panel.
- Convert theme-heavy styling into quieter enterprise default.
- Remove visible decorative orbs in production enterprise theme.

### Accessibility

Required:
- Keyboard navigation audit.
- Visible focus rings.
- ARIA labels for icon-only controls.
- Color contrast audit for each theme.
- Reduced-motion support.
- Screen-reader labels for status badges, progress rings, modals, and toasts.

### Data And Analytics

Required:
- Product analytics events with privacy review.
- Funnel metrics: activation, profile completion, first discovery, first application, first resume generated.
- Quality metrics: discovery relevance, apply conversion, interview conversion, offer conversion.
- Admin analytics for crawler quality and provider health.

## P3 - QA And Test Strategy

Minimum test suite:
- Backend unit tests for auth, fit score, dork query builder, salary parsing, profile CRUD, applications CRUD.
- API integration tests using test Postgres.
- Contract tests for frontend/backend response shapes.
- E2E tests for login, onboarding, profile save, job discovery, resume generation, save application, application status update.
- Accessibility tests with axe.
- Visual regression tests for dashboard, jobs, profile, applications, and QA dashboard.
- Security tests for auth bypass, IDOR, CORS, file upload, and rate limits.

CI gates:
- Python lint/type checks.
- Frontend typecheck.
- Unit and integration tests.
- Migration test.
- Docker build.
- Dependency vulnerability scan.
- Secret scan.

## Security Hardening Backlog

Required:
- Strict env validation on startup.
- CORS allowlist per environment.
- CSP headers.
- Secure cookie auth.
- File upload MIME sniffing and malware scanning.
- PDF/DOCX parser sandboxing.
- Prompt-injection defenses for resume/job text.
- LLM data-retention controls.
- Audit logs for sensitive operations.
- PII classification and deletion/export workflows.
- Encryption at rest for generated resumes and profile text.
- Admin-only endpoints for operational controls.

## Data Model Improvements

Required:
- Add `source` to `VerifiedJob` model if used in API responses.
- Add canonical `job_url_hash` unique constraint.
- Add `tenant_id` if enterprise/multi-org support is planned.
- Add indexes for `user_id`, `created_at`, `application_link`, `organization`, `title`, and JSONB skill search.
- Store resume files in object storage, not base64 in DB.
- Add soft delete for user-owned records.
- Add audit columns: `created_by`, `updated_by`, `deleted_at`.

## Recommended Implementation Roadmap

Phase 1 - Stabilize core production readiness:
- Enforce auth and secret validation.
- Add migrations.
- Connect Postgres reliably.
- Replace in-memory rate limiter.
- Add health/readiness endpoints.
- Add basic test suite.

Phase 2 - Make discovery dependable:
- Move job discovery to queued worker.
- Add crawl records, source health, dedupe constraints.
- Add discovery history and manual query preview.
- Add compliance/backoff controls.

Phase 3 - Enterprise UX:
- Simplify nav.
- Add environment/degraded-mode banners.
- Add consistent loading/error/empty states.
- Add accessibility pass.
- Convert mock/demo data into explicit demo mode.

Phase 4 - Observability and operations:
- Add request IDs, structured logs, metrics, traces.
- Add dashboards and alerts.
- Add admin operations panel.
- Add cost and token usage tracking.

Phase 5 - Quality and compliance:
- Add full CI/CD gates.
- Add data retention and privacy controls.
- Add threat model and security test suite.
- Add release checklist and incident runbooks.

## Final Recommendation

Do not market or deploy this as enterprise-grade yet. Treat it as a feature-rich beta. The right next move is not more features; it is hardening the trust layer: auth, database migrations, durable background jobs, observability, and tests. Once that foundation is stable, the product can become genuinely enterprise-grade.

# Enterprise release gates

A release is promotable only when the GitHub workflow, live database verification, and authenticated staging smoke checks all pass.

## Automated gates

- Backend unit/API tests excluding the explicit integration marker.
- Python bytecode compilation for backend and workers.
- Frontend lint, TypeScript, and production build.
- Presence of preflight, migration, seed, verification, profile, and governance SQL artifacts.
- Migration contract checks for canonical application status and backend-only privilege revocation.

## Staging gates

1. Apply the same migration files used in production order.
2. Run database/enterprise_v2_verify.sql and Supabase security/performance advisors.
3. Start the API with ENABLE_STARTUP_SCHEMA_SYNC=false and REQUIRE_AUTH=true.
4. Run backend/scripts/release_smoke.py with JOBINTEL_SMOKE_URL and an admin JOBINTEL_SMOKE_TOKEN.
5. Save a profile and confirm facts plus an immutable snapshot are created.
6. List jobs and verify X-Ranking-Version, X-Candidates-Retrieved, X-Request-ID, and X-Response-Time-Ms.
7. Save an application with a display label, verify lowercase persistence, then read the display-compatible timeline.
8. Queue a source rerun and confirm an ingestion run, outbox event, and audit event are created atomically.
9. Observe API error rate, source drift counts, failed/dead-lettered runs, and outbox_backlog_over_5m for one scheduler cycle.

## Rollback flags

- ENABLE_CONTRACT_CONNECTORS=false stops contracted ATS network fetches.
- ENABLE_DETERMINISTIC_RANKING=false returns retrieval order without ranking.
- ENABLE_PROFILE_INTELLIGENCE=false removes the evidence API routes while retaining data.
- ENABLE_ADMIN_OPERATIONS=false removes operational admin routes.
- ENABLE_STARTUP_SCHEMA_SYNC must remain false outside deliberate local development.

Data-bearing migrations are forward-fix by default. Do not delete audit, snapshot, assessment, ingestion, or outbox records during an application rollback. See ENTERPRISE_ROLLOUT.md for status compatibility and database rollback details.

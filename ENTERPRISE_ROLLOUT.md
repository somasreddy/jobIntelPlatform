# Enterprise v2 database rollout

This rollout is additive except for canonicalizing application statuses to lowercase keys. The API accepts current display labels and legacy aliases, persists lowercase keys, and continues returning the existing display labels plus a statusKey field.

## Promotion sequence

1. Take a managed database backup and record the current application release.
2. Run database/enterprise_v2_preflight.sql. Stop for unknown statuses, duplicate global source URLs, or missing core tables.
3. Apply database/enterprise_v2.sql in development. It uses a five-second lock timeout and a single transaction.
4. Apply database/enterprise_v2_seed.sql.
5. Run database/enterprise_v2_verify.sql and the Supabase security/performance advisors.
6. Run backend tests and an authenticated smoke flow: list jobs, save a job, move it to Shortlisted, read the timeline, and load analytics.
7. Repeat in staging; observe ingestion errors, database locks, API 4xx/5xx rates, and outbox backlog for at least one scheduler cycle.
8. Promote the same artifacts to production during a low-write window. Do not allow ORM startup creation to substitute for this migration.

## Go/no-go criteria

Go only when all required tables exist, invalid_application_statuses is zero, seeded_sources is eight, capability_declared is eight, the default match policy count is one, every listed constraint is validated, and backend-owned tables show RLS enabled with anon_can_select and authenticated_can_select both false.

The RLS-no-policy advisor may still report backend-only tables; that is intentional because Data API privileges are revoked. The public rls_auto_enable security-definer function must no longer be executable by anonymous or authenticated roles.

## Rollback

The migration is transactional, so a statement failure rolls back the schema and status conversion. After a successful release, prefer rolling the application forward. If the application release must be rolled back:

1. Keep the additive enterprise tables and columns in place.
2. Deploy the compatibility-capable API before any database change.
3. Drop applications_status_check, translate lowercase keys back to display labels, restore the Saved default, then add the former display-label constraint.
4. Do not delete audit, event, assessment, or outbox data. Retain it according to policy.
5. Disable affected source_registry entries instead of deleting them.

A tested reverse-status script should be prepared from the production status distribution at rollback time; this avoids silently losing a newly introduced status.

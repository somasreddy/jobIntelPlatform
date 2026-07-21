-- Enterprise v2 additive migration.
-- Safe to rerun. Execute database/enterprise_v2_preflight.sql first.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

CREATE TABLE IF NOT EXISTS source_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    name TEXT NOT NULL,
    source_type TEXT NOT NULL,
    base_url TEXT NOT NULL,
    priority SMALLINT NOT NULL DEFAULT 50,
    crawl_frequency_minutes INTEGER NOT NULL DEFAULT 360,
    parser_name TEXT NOT NULL,
    parser_version TEXT NOT NULL,
    dedupe_rules JSONB NOT NULL DEFAULT '{}',
    adapter_config JSONB NOT NULL DEFAULT '{}',
    compliance_policy JSONB NOT NULL DEFAULT '{}',
    health_score NUMERIC(5,2) NOT NULL DEFAULT 100,
    failure_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    last_success_at TIMESTAMPTZ,
    last_failure_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, base_url)
);
ALTER TABLE source_registry
    ADD COLUMN IF NOT EXISTS adapter_config JSONB NOT NULL DEFAULT '{}';
ALTER TABLE source_registry
    ALTER COLUMN priority SET DEFAULT 50,
    ALTER COLUMN crawl_frequency_minutes SET DEFAULT 360,
    ALTER COLUMN dedupe_rules SET DEFAULT '{}',
    ALTER COLUMN adapter_config SET DEFAULT '{}',
    ALTER COLUMN compliance_policy SET DEFAULT '{}',
    ALTER COLUMN health_score SET DEFAULT 100,
    ALTER COLUMN failure_rate SET DEFAULT 0,
    ALTER COLUMN enabled SET DEFAULT TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS uq_source_registry_global_url
    ON source_registry(base_url) WHERE tenant_id IS NULL;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'source_registry_source_type_check') THEN
        ALTER TABLE source_registry ADD CONSTRAINT source_registry_source_type_check
            CHECK (source_type IN ('ats_api','structured_html','feed','sitemap','career_page','search_seed')) NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'source_registry_priority_check') THEN
        ALTER TABLE source_registry ADD CONSTRAINT source_registry_priority_check
            CHECK (priority BETWEEN 0 AND 100) NOT VALID;
    END IF;
END $$;
ALTER TABLE source_registry VALIDATE CONSTRAINT source_registry_source_type_check;
ALTER TABLE source_registry VALIDATE CONSTRAINT source_registry_priority_check;

ALTER TABLE verified_jobs
    ADD COLUMN IF NOT EXISTS tenant_id UUID,
    ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES source_registry(id),
    ADD COLUMN IF NOT EXISTS external_requisition_id TEXT,
    ADD COLUMN IF NOT EXISTS canonical_url TEXT,
    ADD COLUMN IF NOT EXISTS canonical_fingerprint TEXT,
    ADD COLUMN IF NOT EXISTS normalized_payload JSONB NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS field_provenance JSONB NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS extraction_confidence NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS freshness_score NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS suppressed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS suppression_reason TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_jobs_source_requisition
    ON verified_jobs(source_id, external_requisition_id)
    WHERE external_requisition_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_source_id ON verified_jobs(source_id);
CREATE INDEX IF NOT EXISTS idx_jobs_canonical_url ON verified_jobs(canonical_url);
CREATE INDEX IF NOT EXISTS idx_jobs_fingerprint ON verified_jobs(canonical_fingerprint);
CREATE INDEX IF NOT EXISTS idx_jobs_freshness
    ON verified_jobs(freshness_score DESC, last_verified_at DESC);

CREATE TABLE IF NOT EXISTS ingestion_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES source_registry(id),
    parser_version TEXT NOT NULL,
    correlation_id UUID NOT NULL,
    status TEXT NOT NULL,
    counters JSONB NOT NULL DEFAULT '{}',
    error_code TEXT,
    error_detail TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE ingestion_runs
    ALTER COLUMN counters SET DEFAULT '{}';
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ingestion_runs_status_check') THEN
        ALTER TABLE ingestion_runs ADD CONSTRAINT ingestion_runs_status_check CHECK (
            status IN ('queued','fetching','extracting','normalizing','completed','partial','failed','dead_lettered')
        ) NOT VALID;
    END IF;
END $$;
ALTER TABLE ingestion_runs VALIDATE CONSTRAINT ingestion_runs_status_check;
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_source_id ON ingestion_runs(source_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_status_created ON ingestion_runs(status, created_at DESC);

CREATE TABLE IF NOT EXISTS match_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    rules JSONB NOT NULL,
    status TEXT NOT NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    activated_at TIMESTAMPTZ,
    UNIQUE (tenant_id, name, version)
);
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'match_policies_status_check') THEN
        ALTER TABLE match_policies ADD CONSTRAINT match_policies_status_check
            CHECK (status IN ('draft','active','retired')) NOT VALID;
    END IF;
END $$;
ALTER TABLE match_policies VALIDATE CONSTRAINT match_policies_status_check;

CREATE TABLE IF NOT EXISTS match_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    user_id UUID NOT NULL,
    job_id UUID NOT NULL REFERENCES verified_jobs(id),
    profile_snapshot_id UUID,
    scoring_version TEXT NOT NULL,
    policy_id UUID REFERENCES match_policies(id),
    overall_score SMALLINT NOT NULL,
    eligibility_score SMALLINT NOT NULL,
    relevance_score SMALLINT NOT NULL,
    competitiveness_score SMALLINT NOT NULL,
    completeness_score SMALLINT NOT NULL,
    confidence_score SMALLINT NOT NULL,
    fit_label TEXT NOT NULL,
    reason_trace JSONB NOT NULL,
    input_snapshot JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'match_assessments_overall_score_check') THEN
        ALTER TABLE match_assessments ADD CONSTRAINT match_assessments_overall_score_check
            CHECK (overall_score BETWEEN 0 AND 100) NOT VALID;
    END IF;
END $$;
ALTER TABLE match_assessments VALIDATE CONSTRAINT match_assessments_overall_score_check;
CREATE INDEX IF NOT EXISTS idx_match_user_job
    ON match_assessments(user_id, job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_match_assessments_job_id ON match_assessments(job_id);
CREATE INDEX IF NOT EXISTS idx_match_assessments_policy_id ON match_assessments(policy_id);

-- Refuse unexpected values before canonicalizing the established pipeline.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM applications
        WHERE lower(trim(both '_' FROM regexp_replace(trim(status), '[^a-zA-Z0-9]+', '_', 'g')))
              NOT IN (
                'discovered','saved','shortlisted','tailoring','ready_to_apply','applied',
                'recruiter_contacted','screening','assessment','interview','final_interview',
                'offer','rejected','archived','evaluated','responded','discarded','skip',
                'skipped','negotiating'
              )
    ) THEN
        RAISE EXCEPTION 'applications contains an unmapped status; run enterprise_v2_preflight.sql';
    END IF;
END $$;

ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_status_check;
UPDATE applications AS app
SET status = mapped.canonical
FROM (
    SELECT id,
        CASE lower(trim(both '_' FROM regexp_replace(trim(status), '[^a-zA-Z0-9]+', '_', 'g')))
            WHEN 'evaluated' THEN 'shortlisted'
            WHEN 'responded' THEN 'recruiter_contacted'
            WHEN 'discarded' THEN 'archived'
            WHEN 'skip' THEN 'archived'
            WHEN 'skipped' THEN 'archived'
            WHEN 'negotiating' THEN 'offer'
            ELSE lower(trim(both '_' FROM regexp_replace(trim(status), '[^a-zA-Z0-9]+', '_', 'g')))
        END AS canonical
    FROM applications
) AS mapped
WHERE app.id = mapped.id AND app.status IS DISTINCT FROM mapped.canonical;
ALTER TABLE applications ALTER COLUMN status SET DEFAULT 'saved';
ALTER TABLE applications ADD CONSTRAINT applications_status_check CHECK (
    status IN (
        'discovered','saved','shortlisted','tailoring','ready_to_apply','applied',
        'recruiter_contacted','screening','assessment','interview','final_interview',
        'offer','rejected','archived'
    )
) NOT VALID;
ALTER TABLE applications VALIDATE CONSTRAINT applications_status_check;
CREATE INDEX IF NOT EXISTS idx_applications_job_id ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_profile_id ON applications(profile_id);
CREATE INDEX IF NOT EXISTS idx_applications_user_status ON applications(user_id, status);

CREATE TABLE IF NOT EXISTS application_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT,
    payload JSONB NOT NULL DEFAULT '{}',
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE application_events
    ALTER COLUMN payload SET DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_application_timeline
    ON application_events(application_id, occurred_at DESC);

-- Existing event history follows the same canonical status contract.
UPDATE application_events
SET from_status = CASE lower(trim(both '_' FROM regexp_replace(trim(from_status), '[^a-zA-Z0-9]+', '_', 'g')))
    WHEN 'evaluated' THEN 'shortlisted' WHEN 'responded' THEN 'recruiter_contacted'
    WHEN 'discarded' THEN 'archived' WHEN 'skip' THEN 'archived'
    WHEN 'skipped' THEN 'archived' WHEN 'negotiating' THEN 'offer'
    ELSE lower(trim(both '_' FROM regexp_replace(trim(from_status), '[^a-zA-Z0-9]+', '_', 'g'))) END
WHERE from_status IS NOT NULL;
UPDATE application_events
SET to_status = CASE lower(trim(both '_' FROM regexp_replace(trim(to_status), '[^a-zA-Z0-9]+', '_', 'g')))
    WHEN 'evaluated' THEN 'shortlisted' WHEN 'responded' THEN 'recruiter_contacted'
    WHEN 'discarded' THEN 'archived' WHEN 'skip' THEN 'archived'
    WHEN 'skipped' THEN 'archived' WHEN 'negotiating' THEN 'offer'
    ELSE lower(trim(both '_' FROM regexp_replace(trim(to_status), '[^a-zA-Z0-9]+', '_', 'g'))) END
WHERE to_status IS NOT NULL;

CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    actor_id UUID,
    actor_type TEXT NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    request_id TEXT,
    before_state JSONB,
    after_state JSONB,
    metadata JSONB NOT NULL DEFAULT '{}',
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_resource
    ON audit_log(tenant_id, resource_type, resource_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS source_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discovered_url TEXT NOT NULL UNIQUE,
    discovery_method TEXT NOT NULL,
    validation_status TEXT NOT NULL DEFAULT 'pending',
    detected_source_type TEXT,
    evidence JSONB NOT NULL DEFAULT '{}',
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE source_candidates
    ALTER COLUMN validation_status SET DEFAULT 'pending',
    ALTER COLUMN evidence SET DEFAULT '{}';
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'source_candidates_validation_status_check') THEN
        ALTER TABLE source_candidates ADD CONSTRAINT source_candidates_validation_status_check
            CHECK (validation_status IN ('pending','approved','rejected')) NOT VALID;
    END IF;
END $$;
ALTER TABLE source_candidates VALIDATE CONSTRAINT source_candidates_validation_status_check;
CREATE INDEX IF NOT EXISTS idx_source_candidates_review
    ON source_candidates(validation_status, created_at DESC);

CREATE TABLE IF NOT EXISTS outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    aggregate_type TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_version SMALLINT NOT NULL DEFAULT 1,
    payload JSONB NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT
);
ALTER TABLE outbox_events
    ALTER COLUMN event_version SET DEFAULT 1,
    ALTER COLUMN attempts SET DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_outbox_unpublished
    ON outbox_events(occurred_at) WHERE published_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_outbox_aggregate
    ON outbox_events(aggregate_type, aggregate_id, occurred_at);

-- These operational tables are backend-owned and intentionally unavailable
-- through the Supabase Data API. Direct Postgres roles remain unaffected.
DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'source_registry','ingestion_runs','match_policies','match_assessments',
        'application_events','audit_log','source_candidates','outbox_events'
    ]
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', table_name);
    END LOOP;

    IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
        REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
    END IF;
END $$;

COMMIT;

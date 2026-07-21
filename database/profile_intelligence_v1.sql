-- Persistent Profile Intelligence evidence, snapshots, and variants.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS profile_facts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    fact_type VARCHAR(80) NOT NULL,
    normalized_key VARCHAR(255) NOT NULL,
    value JSONB NOT NULL,
    trust_state VARCHAR(30) NOT NULL DEFAULT 'needs_review',
    source_type VARCHAR(50) NOT NULL,
    source_ref TEXT,
    evidence JSONB NOT NULL DEFAULT '{}',
    review_status VARCHAR(30) NOT NULL DEFAULT 'pending',
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_profile_fact_source_key
        UNIQUE (profile_id, source_type, fact_type, normalized_key)
);
ALTER TABLE profile_facts
    ALTER COLUMN trust_state SET DEFAULT 'needs_review',
    ALTER COLUMN evidence SET DEFAULT '{}',
    ALTER COLUMN review_status SET DEFAULT 'pending';
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='profile_facts_trust_state_check') THEN
        ALTER TABLE profile_facts ADD CONSTRAINT profile_facts_trust_state_check
            CHECK (trust_state IN ('explicit','inferred','needs_review')) NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='profile_facts_review_status_check') THEN
        ALTER TABLE profile_facts ADD CONSTRAINT profile_facts_review_status_check
            CHECK (review_status IN ('pending','approved','rejected')) NOT VALID;
    END IF;
END $$;
ALTER TABLE profile_facts VALIDATE CONSTRAINT profile_facts_trust_state_check;
ALTER TABLE profile_facts VALIDATE CONSTRAINT profile_facts_review_status_check;
CREATE INDEX IF NOT EXISTS idx_profile_facts_profile_id ON profile_facts(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_facts_review
    ON profile_facts(user_id, review_status, fact_type);

CREATE TABLE IF NOT EXISTS profile_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    label VARCHAR(255) NOT NULL,
    kind VARCHAR(30) NOT NULL DEFAULT 'base',
    version INTEGER NOT NULL,
    profile_data JSONB NOT NULL,
    facts JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_profile_snapshot_version UNIQUE (profile_id, version)
);
ALTER TABLE profile_snapshots
    ALTER COLUMN kind SET DEFAULT 'base',
    ALTER COLUMN facts SET DEFAULT '[]';
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='profile_snapshots_kind_check') THEN
        ALTER TABLE profile_snapshots ADD CONSTRAINT profile_snapshots_kind_check
            CHECK (kind IN ('base','target_role','tailored')) NOT VALID;
    END IF;
END $$;
ALTER TABLE profile_snapshots VALIDATE CONSTRAINT profile_snapshots_kind_check;
CREATE INDEX IF NOT EXISTS idx_profile_snapshots_profile_id ON profile_snapshots(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_snapshots_user_created
    ON profile_snapshots(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS profile_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    target_role VARCHAR(255),
    target_company VARCHAR(255),
    base_snapshot_id UUID REFERENCES profile_snapshots(id),
    overrides JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(30) NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_profile_variant_user_name UNIQUE (user_id, name)
);
ALTER TABLE profile_variants
    ALTER COLUMN overrides SET DEFAULT '{}',
    ALTER COLUMN status SET DEFAULT 'draft';
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='profile_variants_status_check') THEN
        ALTER TABLE profile_variants ADD CONSTRAINT profile_variants_status_check
            CHECK (status IN ('draft','active','archived')) NOT VALID;
    END IF;
END $$;
ALTER TABLE profile_variants VALIDATE CONSTRAINT profile_variants_status_check;
CREATE INDEX IF NOT EXISTS idx_profile_variants_profile_id ON profile_variants(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_variants_snapshot_id ON profile_variants(base_snapshot_id);
CREATE INDEX IF NOT EXISTS idx_profile_variants_user_status
    ON profile_variants(user_id, status);

ALTER TABLE profile_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_variants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE profile_facts, profile_snapshots, profile_variants FROM anon, authenticated;

COMMIT;

-- Version-controlled reference data. Runtime health fields are never overwritten.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

INSERT INTO source_registry (
    id, tenant_id, name, source_type, base_url, priority,
    crawl_frequency_minutes, parser_name, parser_version,
    dedupe_rules, adapter_config, compliance_policy, health_score, failure_rate, enabled
) VALUES
(
    '10000000-0000-0000-0000-000000000001', NULL, 'Greenhouse', 'ats_api',
    'https://boards-api.greenhouse.io', 95, 60, 'greenhouse', '1.0.0',
    '{"keys":["external_requisition_id","canonical_url","canonical_fingerprint"]}',
    '{"capabilities":["pagination","detail_fetch","structured_locations","salary_when_published"],"fallback":"career_page"}',
    '{"robots_required":true,"respect_rate_limits":true}', 100, 0, TRUE
),
(
    '10000000-0000-0000-0000-000000000002', NULL, 'Lever', 'ats_api',
    'https://api.lever.co', 94, 60, 'lever', '1.0.0',
    '{"keys":["external_requisition_id","canonical_url","canonical_fingerprint"]}',
    '{"capabilities":["pagination","detail_fetch","structured_locations","salary_when_published"],"fallback":"career_page"}',
    '{"robots_required":true,"respect_rate_limits":true}', 100, 0, TRUE
),
(
    '10000000-0000-0000-0000-000000000003', NULL, 'Workday', 'ats_api',
    'https://wd5.myworkdaysite.com', 93, 90, 'workday', '1.0.0',
    '{"keys":["external_requisition_id","canonical_url","canonical_fingerprint"]}',
    '{"capabilities":["pagination","detail_fetch","structured_locations"],"fallback":"career_page","tenant_required":true}',
    '{"robots_required":true,"respect_rate_limits":true}', 100, 0, TRUE
),
(
    '10000000-0000-0000-0000-000000000004', NULL, 'Ashby', 'ats_api',
    'https://api.ashbyhq.com', 92, 60, 'ashby', '1.0.0',
    '{"keys":["external_requisition_id","canonical_url","canonical_fingerprint"]}',
    '{"capabilities":["pagination","detail_fetch","structured_locations","salary_when_published"],"fallback":"career_page"}',
    '{"robots_required":true,"respect_rate_limits":true}', 100, 0, TRUE
),
(
    '10000000-0000-0000-0000-000000000005', NULL, 'Generic career page', 'career_page',
    'https://careers.example.invalid', 40, 720, 'generic_career_page', '1.0.0',
    '{"keys":["canonical_url","canonical_fingerprint"]}',
    '{"capabilities":["detail_fetch"],"fallback":"source_candidate_review","template":true}',
    '{"robots_required":true,"respect_rate_limits":true}', 100, 0, FALSE
),
(
    '10000000-0000-0000-0000-000000000006', NULL, 'Remotive', 'feed',
    'https://remotive.com/api', 80, 120, 'remotive', '1.0.0',
    '{"keys":["external_requisition_id","canonical_url","canonical_fingerprint"]}',
    '{"capabilities":["pagination","detail_fetch","structured_locations","salary_when_published"],"fallback":"none"}',
    '{"robots_required":true,"respect_rate_limits":true}', 100, 0, TRUE
),
(
    '10000000-0000-0000-0000-000000000007', NULL, 'Arbeitnow', 'feed',
    'https://www.arbeitnow.com/api', 78, 120, 'arbeitnow', '1.0.0',
    '{"keys":["external_requisition_id","canonical_url","canonical_fingerprint"]}',
    '{"capabilities":["pagination","detail_fetch","structured_locations"],"fallback":"none"}',
    '{"robots_required":true,"respect_rate_limits":true}', 100, 0, TRUE
),
(
    '10000000-0000-0000-0000-000000000008', NULL, 'We Work Remotely', 'feed',
    'https://weworkremotely.com', 76, 180, 'we_work_remotely', '1.0.0',
    '{"keys":["canonical_url","canonical_fingerprint"]}',
    '{"capabilities":["detail_fetch","structured_locations"],"fallback":"career_page"}',
    '{"robots_required":true,"respect_rate_limits":true}', 100, 0, TRUE
)
ON CONFLICT (base_url) WHERE tenant_id IS NULL DO UPDATE SET
    name = EXCLUDED.name,
    source_type = EXCLUDED.source_type,
    priority = EXCLUDED.priority,
    crawl_frequency_minutes = EXCLUDED.crawl_frequency_minutes,
    parser_name = EXCLUDED.parser_name,
    parser_version = EXCLUDED.parser_version,
    dedupe_rules = EXCLUDED.dedupe_rules,
    adapter_config = EXCLUDED.adapter_config,
    compliance_policy = EXCLUDED.compliance_policy,
    enabled = EXCLUDED.enabled,
    updated_at = now();

-- Policy versions are immutable: rule changes require a new id and version.
INSERT INTO match_policies (
    id, tenant_id, name, version, rules, status, created_by, activated_at
) VALUES (
    '20000000-0000-0000-0000-000000000001',
    NULL,
    'Default explainable match policy',
    '2026-07-20',
    '{
      "hard_gates":["work_authorization","location_feasibility","required_credentials"],
      "weights":{
        "eligibility":0.25,
        "relevance":0.35,
        "competitiveness":0.20,
        "completeness":0.10,
        "confidence":0.10
      },
      "thresholds":{"strong":80,"good":65,"stretch":45},
      "evidence_required":true
    }',
    'active',
    '00000000-0000-0000-0000-000000000001',
    now()
)
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Post-deployment go/no-go checks. All failures must be zero or false.
SELECT required_table,
       to_regclass('public.' || required_table) IS NOT NULL AS exists
FROM unnest(ARRAY[
    'source_registry','ingestion_runs','match_policies','match_assessments',
    'application_events','audit_log','source_candidates','outbox_events'
]) AS required_table
ORDER BY required_table;

SELECT count(*) AS invalid_application_statuses
FROM applications
WHERE status NOT IN (
    'discovered','saved','shortlisted','tailoring','ready_to_apply','applied',
    'recruiter_contacted','screening','assessment','interview','final_interview',
    'offer','rejected','archived'
);

SELECT count(*) AS seeded_sources,
       count(*) FILTER (WHERE enabled) AS enabled_sources,
       count(*) FILTER (WHERE adapter_config ? 'capabilities') AS capability_declared
FROM source_registry
WHERE tenant_id IS NULL;

SELECT count(*) AS active_default_match_policies
FROM match_policies
WHERE id = '20000000-0000-0000-0000-000000000001'
  AND status = 'active';

SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       has_table_privilege('anon', c.oid, 'SELECT') AS anon_can_select,
       has_table_privilege('authenticated', c.oid, 'SELECT') AS authenticated_can_select
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
      'source_registry','ingestion_runs','match_policies','match_assessments',
      'application_events','audit_log','source_candidates','outbox_events'
  )
ORDER BY c.relname;

SELECT conname, convalidated
FROM pg_constraint
WHERE conname IN (
    'source_registry_source_type_check','source_registry_priority_check',
    'ingestion_runs_status_check','match_policies_status_check',
    'match_assessments_overall_score_check','applications_status_check',
    'source_candidates_validation_status_check'
)
ORDER BY conname;

SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
      'uq_source_registry_global_url','uq_jobs_source_requisition',
      'idx_ingestion_runs_source_id','idx_match_user_job',
      'idx_application_timeline','idx_outbox_unpublished'
  )
ORDER BY indexname;

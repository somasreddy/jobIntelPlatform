-- Read-only checks. Any non-empty "unknown status" or duplicate result is a stop condition.
SELECT current_database() AS database_name, current_user AS execution_role, now() AS checked_at;

SELECT required_table,
       to_regclass('public.' || required_table) IS NOT NULL AS exists
FROM unnest(ARRAY[
    'verified_jobs','applications','source_registry','ingestion_runs',
    'match_policies','match_assessments','application_events','audit_log',
    'source_candidates','outbox_events'
]) AS required_table
ORDER BY required_table;

SELECT status, count(*) AS rows
FROM applications
GROUP BY status
ORDER BY status;

SELECT status AS unknown_status, count(*) AS rows
FROM applications
WHERE lower(trim(both '_' FROM regexp_replace(trim(status), '[^a-zA-Z0-9]+', '_', 'g')))
      NOT IN (
          'discovered','saved','shortlisted','tailoring','ready_to_apply','applied',
          'recruiter_contacted','screening','assessment','interview','final_interview',
          'offer','rejected','archived','evaluated','responded','discarded','skip',
          'skipped','negotiating'
      )
GROUP BY status
ORDER BY status;

SELECT base_url, count(*) AS duplicate_rows
FROM source_registry
WHERE tenant_id IS NULL
GROUP BY base_url
HAVING count(*) > 1
ORDER BY base_url;

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

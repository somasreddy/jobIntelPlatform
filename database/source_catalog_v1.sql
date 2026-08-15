-- Idempotent global search-source catalog derived from
-- backend/job_discovery/source_registry.py.
-- Search seeds discover candidate career endpoints only; they never create jobs of record.
BEGIN;

-- tenant_id is nullable, so PostgreSQL's UNIQUE (tenant_id, base_url) does not
-- arbitrate global rows. Serialize this seed and explicitly update-then-insert.
SELECT pg_advisory_xact_lock(hashtext('job-intelligence:source-catalog-v1'));

WITH catalog AS (
    SELECT
        item->>'site' AS site,
        item->>'source_group' AS source_group,
        item->'regions' AS regions
    FROM jsonb_array_elements($catalog$
    [
      {"site":"site:myworkdayjobs.com","source_group":"ats","regions":["GLOBAL"]},
      {"site":"site:greenhouse.io","source_group":"ats","regions":["GLOBAL"]},
      {"site":"site:boards.greenhouse.io","source_group":"ats","regions":["GLOBAL"]},
      {"site":"site:job-boards.greenhouse.io","source_group":"ats","regions":["GLOBAL"]},
      {"site":"site:icims.com","source_group":"ats","regions":["GLOBAL"]},
      {"site":"site:taleo.net","source_group":"ats","regions":["GLOBAL"]},
      {"site":"site:lever.co","source_group":"ats","regions":["GLOBAL"]},
      {"site":"site:jobs.lever.co","source_group":"ats","regions":["GLOBAL"]},
      {"site":"site:smartrecruiters.com","source_group":"ats","regions":["GLOBAL"]},
      {"site":"site:jobvite.com","source_group":"ats","regions":["GLOBAL"]},
      {"site":"site:workforcenow.adp.com","source_group":"ats","regions":["GLOBAL"]},
      {"site":"site:successfactors.com","source_group":"ats","regions":["GLOBAL"]},
      {"site":"site:brassring.com","source_group":"ats","regions":["GLOBAL"]},
      {"site":"site:jazzhr.com","source_group":"ats","regions":["GLOBAL"]},
      {"site":"site:breezy.hr","source_group":"ats","regions":["GLOBAL"]},
      {"site":"site:jobdiva.com","source_group":"ats","regions":["GLOBAL"]},
      {"site":"site:bullhorn.com","source_group":"ats","regions":["GLOBAL"]},
      {"site":"site:bamboohr.com","source_group":"ats","regions":["GLOBAL"]},
      {"site":"site:linkedin.com/jobs","source_group":"ats","regions":["GLOBAL","IN","US","CA","GB","DE","FR","ES","AU","NZ","SEA","PK","LATAM"]},
      {"site":"site:indeed.com","source_group":"job_board","regions":["GLOBAL","US"]},
      {"site":"site:monster.com","source_group":"job_board","regions":["GLOBAL","US"]},
      {"site":"site:glassdoor.com","source_group":"job_board","regions":["GLOBAL","US"]},
      {"site":"site:ziprecruiter.com","source_group":"job_board","regions":["GLOBAL","US"]},
      {"site":"site:careerbuilder.com","source_group":"job_board","regions":["GLOBAL","US"]},
      {"site":"site:simplyhired.com","source_group":"job_board","regions":["GLOBAL","US"]},
      {"site":"site:weworkremotely.com","source_group":"job_board","regions":["GLOBAL","US"]},
      {"site":"site:wellfound.com","source_group":"job_board","regions":["GLOBAL","US"]},
      {"site":"site:naukri.com","source_group":"job_board","regions":["IN"]},
      {"site":"site:timesjobs.com","source_group":"job_board","regions":["IN"]},
      {"site":"site:indeed.co.in","source_group":"job_board","regions":["IN"]},
      {"site":"site:monsterindia.com","source_group":"job_board","regions":["IN"]},
      {"site":"site:shine.com","source_group":"job_board","regions":["IN"]},
      {"site":"site:foundit.in","source_group":"job_board","regions":["IN"]},
      {"site":"site:cutshort.io","source_group":"job_board","regions":["IN"]},
      {"site":"site:hirist.com","source_group":"job_board","regions":["IN"]},
      {"site":"site:iimjobs.com","source_group":"job_board","regions":["IN"]},
      {"site":"site:apna.co","source_group":"job_board","regions":["IN"]},
      {"site":"site:instahyre.com","source_group":"job_board","regions":["IN"]},
      {"site":"site:jobsireland.ie","source_group":"job_board","regions":["IE"]},
      {"site":"site:irishjobs.ie","source_group":"job_board","regions":["IE"]},
      {"site":"site:jobs.ie","source_group":"job_board","regions":["IE"]},
      {"site":"site:recruitireland.com","source_group":"job_board","regions":["IE"]},
      {"site":"site:publicjobs.ie","source_group":"job_board","regions":["IE"]},
      {"site":"site:ie.indeed.com","source_group":"job_board","regions":["IE"]},
      {"site":"site:ie.linkedin.com/jobs","source_group":"job_board","regions":["IE"]},
      {"site":"site:usajobs.gov","source_group":"job_board","regions":["US"]},
      {"site":"site:dice.com","source_group":"job_board","regions":["US"]},
      {"site":"site:indeed.ca","source_group":"job_board","regions":["CA"]},
      {"site":"site:jobbank.gc.ca","source_group":"job_board","regions":["CA"]},
      {"site":"site:workopolis.com","source_group":"job_board","regions":["CA"]},
      {"site":"site:indeed.co.uk","source_group":"job_board","regions":["GB"]},
      {"site":"site:reed.co.uk","source_group":"job_board","regions":["GB"]},
      {"site":"site:cv-library.co.uk","source_group":"job_board","regions":["GB"]},
      {"site":"site:totaljobs.com","source_group":"job_board","regions":["GB"]},
      {"site":"site:indeed.de","source_group":"job_board","regions":["DE"]},
      {"site":"site:stepstone.de","source_group":"job_board","regions":["DE"]},
      {"site":"site:jobs.de","source_group":"job_board","regions":["DE"]},
      {"site":"site:xing.com","source_group":"job_board","regions":["DE"]},
      {"site":"site:indeed.fr","source_group":"job_board","regions":["FR"]},
      {"site":"site:monster.fr","source_group":"job_board","regions":["FR"]},
      {"site":"site:indeed.es","source_group":"job_board","regions":["ES"]},
      {"site":"site:infojobs.net","source_group":"job_board","regions":["ES"]},
      {"site":"site:indeed.com.au","source_group":"job_board","regions":["AU"]},
      {"site":"site:seek.com.au","source_group":"job_board","regions":["AU"]},
      {"site":"site:seek.co.nz","source_group":"job_board","regions":["NZ"]},
      {"site":"site:jobstreet.com","source_group":"job_board","regions":["SEA"]},
      {"site":"site:kalibrr.com","source_group":"job_board","regions":["SEA"]},
      {"site":"site:rozee.pk","source_group":"job_board","regions":["PK"]},
      {"site":"site:indeed.com.mx","source_group":"job_board","regions":["LATAM"]},
      {"site":"site:indeed.com.br","source_group":"job_board","regions":["LATAM"]},
      {"site":"site:computrabajo.com","source_group":"job_board","regions":["LATAM"]}
    ]
    $catalog$::jsonb
    ) AS entries(item)
),
prepared AS (
    SELECT
        site,
        source_group,
        regions,
        'https://' || regexp_replace(site, '^site:', '') ||
            '?jobintel_source=search_seed' AS base_url,
        'Search seed: ' || regexp_replace(site, '^site:', '') AS name,
        jsonb_build_object(
            'site', site,
            'source_group', source_group,
            'regions', regions
        ) AS adapter_config
    FROM catalog
),
updated AS (
    UPDATE source_registry AS target
    SET
        name = source.name,
        source_type = 'search_seed',
        priority = CASE WHEN source.source_group = 'ats' THEN 15 ELSE 10 END,
        crawl_frequency_minutes = 1440,
        parser_name = 'search_seed',
        parser_version = 'search-catalog-v1',
        dedupe_rules = '{"promotion":"candidate_endpoint_only"}'::jsonb,
        compliance_policy = '{"robots_required":true,"job_truth":false}'::jsonb,
        adapter_config = source.adapter_config,
        enabled = TRUE,
        updated_at = now()
    FROM prepared AS source
    WHERE target.tenant_id IS NULL
      AND target.base_url = source.base_url
    RETURNING target.base_url
)
INSERT INTO source_registry (
    tenant_id,
    name,
    source_type,
    base_url,
    priority,
    crawl_frequency_minutes,
    parser_name,
    parser_version,
    dedupe_rules,
    compliance_policy,
    adapter_config,
    health_score,
    failure_rate,
    enabled
)
SELECT
    NULL,
    source.name,
    'search_seed',
    source.base_url,
    CASE WHEN source.source_group = 'ats' THEN 15 ELSE 10 END,
    1440,
    'search_seed',
    'search-catalog-v1',
    '{"promotion":"candidate_endpoint_only"}'::jsonb,
    '{"robots_required":true,"job_truth":false}'::jsonb,
    source.adapter_config,
    70,
    0,
    TRUE
FROM prepared AS source
WHERE NOT EXISTS (
    SELECT 1
    FROM source_registry AS existing
    WHERE existing.tenant_id IS NULL
      AND existing.base_url = source.base_url
);

DO $verify$
DECLARE
    expected_count CONSTANT integer := 71;
    actual_count integer;
BEGIN
    SELECT count(DISTINCT adapter_config->>'site')
    INTO actual_count
    FROM source_registry
    WHERE tenant_id IS NULL
      AND source_type = 'search_seed'
      AND parser_version = 'search-catalog-v1';

    IF actual_count <> expected_count THEN
        RAISE EXCEPTION 'source catalog verification failed: expected %, found %',
            expected_count, actual_count;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM source_registry
        WHERE tenant_id IS NULL
          AND adapter_config->>'site' = 'site:usajobs.gov'
          AND adapter_config->'regions' ? 'US'
    ) OR NOT EXISTS (
        SELECT 1 FROM source_registry
        WHERE tenant_id IS NULL
          AND adapter_config->>'site' = 'site:dice.com'
          AND adapter_config->'regions' ? 'US'
    ) THEN
        RAISE EXCEPTION 'source catalog verification failed: USAJobs or Dice missing';
    END IF;
END
$verify$;

COMMIT;

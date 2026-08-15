# Talent Intelligence Platform — Production Blueprint

## Executive decision

The product has broad feature coverage but is not yet a high-trust system of record. The fastest credible path is to narrow the primary navigation to six workspaces, replace search-result ingestion with registered-source ingestion, and run every match through a deterministic, versioned policy engine. Existing career tools can remain as secondary capabilities after these foundations are stable.

The target promise is: **discover a verified role, understand fit and uncertainty, choose an action, tailor truthfully, and manage every interaction to outcome.**

## 1. Current-state audit

| Severity | Finding | Evidence in repository | Product impact | Required action |
|---|---|---|---|---|
| P0 | Search dorks remain the primary discovery path | `service_v2.py` says and implements dorks first | Stale, incomplete, untraceable inventory | Make scheduler + source registry authoritative; search only creates source candidates |
| P0 | Match score rewards shallow profile/JD overlap | `fit_score.py` counts user skills found in text | False confidence; hard gaps can be hidden | Ship normalized requirements, evidence graph, eligibility gate, confidence, trace |
| P0 | Missing-data defaults inflate fit | salary=70, experience=60, title=60 | Unknown becomes positive evidence | Separate confidence from fit; unknown contributes no evidence |
| P0 | Canonical job provenance/freshness is absent | base `verified_jobs` lacks source, first/last seen, field provenance | Cannot prove truth or suppress ghost jobs | Apply additive enterprise schema and provenance ledger |
| P0 | CRM state is too coarse and partly browser-local | six statuses; contact/follow-up state uses local storage | Lost data, weak collaboration and auditability | Server-side workflow and append-only application events |
| P1 | Connectors enumerate hard-coded company slugs | `connectors_v3.py` lists companies in code | Poor coverage and operational governance | Data-driven registry and per-source adapter configuration |
| P1 | URL HEAD success is treated as verification | `_verify_url` checks status only | Closed jobs can appear verified | Verify job identity, open-state signals, body hash, timestamp |
| P1 | Navigation exposes too many peer features | 18 primary links in four groups | High decision friction | Six workspaces; move auxiliary tools into contextual actions |
| P1 | No versioned scoring or parser replay record | outputs omit durable snapshots/policy IDs | Cannot audit or rollback decisions | Persist parser/scoring versions and immutable inputs/outputs |
| P1 | Tenant and RBAC boundaries are incomplete | inconsistent `user_id`; no tenant keys in base schema | Enterprise isolation risk | Tenant context on every record; RLS/service authorization tests |
| P1 | Source failure controls are implicit | no run ledger/DLQ/source SLO in base schema | Silent inventory decay | Run ledger, bounded retries, DLQ, alerts, operator replay |
| P2 | Job detail does not organize around a decision | feature-heavy presentation | Users inspect but do not confidently act | Decision header, critical gaps, provenance, next action, evidence drawer |
| P2 | Profile facts are not a reviewable evidence model | mostly flat skill arrays | Weak explanations and unsafe tailoring | Evidence-backed normalized entities with “needs review” state |
| P2 | Admin/source health is not a first-class workspace | no operator IA | Failures require engineering intervention | Source console, parser rollout, moderation and replay controls |

### Journey gaps

Today: discover → inspect score → use disconnected preparation tools.  
Target: discover → verify → assess → decide → tailor → apply → follow up → learn from outcome.

Retention loops should come from saved searches, verified-new-role alerts, follow-up reminders, score changes after profile review, and pipeline outcome intelligence—not from adding more standalone tools.

## 2. Future-state product and information architecture

1. **Home** — daily decisions: new verified matches, due follow-ups, profile risks, source freshness.
2. **Discover** — unified search with source quality, recency, confidence, work model, visa and salary filters.
3. **Job workspace** — fit decision, critical gaps, job truth, tailoring and CRM actions.
4. **Pipeline** — list/Kanban, reminders, contacts, interactions and outcome analytics.
5. **Profile** — normalized facts, evidence, completeness, preferences, resume variants.
6. **Admin** — sources, ingestion runs, parser versions, match policies, moderation, audit log.

Career graph, learning, interview, negotiation, outreach and resume tools become contextual actions within Job, Pipeline, or Profile. Enterprise roles: `candidate`, `coach/recruiter`, `tenant_admin`, `source_operator`, `auditor`, `platform_admin`.

## 3. Workspace specifications

| Workspace | Key actions | Default KPIs | Trust/empty/loading behavior | Responsive behavior |
|---|---|---|---|---|
| Home | review match, follow up, repair profile | verified matches, due actions, pipeline velocity, completeness | timestamp and confidence on each card; useful onboarding checklist; skeletons preserve layout | mobile is prioritized action feed; desktop adds KPI rail |
| Discover | search, filter, save, compare | verified results, median freshness, quality mix | source badge, last verified, extraction confidence; zero-state offers saved search | mobile filter sheet; desktop sticky facets + result list |
| Job | decide, save, tailor, apply, dismiss | overall fit, hard gaps, confidence, freshness | never show score without policy version and “why”; partial extraction banner | mobile stacked decision cards; desktop 8/4 workspace |
| Pipeline | move stage, add note/contact, schedule follow-up | conversion, time in stage, overdue, response rate | append-only timeline and sync state; guided first application | mobile list by stage; desktop Kanban/list toggle |
| Profile | confirm facts, attach evidence, create variant | completeness, reviewed facts, market readiness | inferred facts labeled “needs review”; tailoring cannot invent claims | mobile section editor; desktop evidence panel |
| Admin | pause/replay source, compare parser, activate policy | source SLO, parse failures, duplicate rate, freshness decay | destructive controls require reason and audit entry | desktop-first; mobile read-only incident view |

### Job workspace wireframe

```text
[Back] Title · Company · Location      [Save] [Move stage] [Apply]
[Strong fit 78] [Confidence 86] [Verified 2h ago] [Greenhouse/API]
-----------------------------------------------------------------
Decision summary                         Job truth
Next action: Review 1 hard gap           canonical URL / requisition
Eligibility 82  Relevance 79             source health / freshness
Competitiveness 68  Profile 91           salary / work model / visa
Critical gaps (1)                        CRM state / reminder
Matched evidence (8)                     Tailor profile (guardrailed)
Transferable strengths (2)
-----------------------------------------------------------------
[Evidence & explanation drawer: requirement → profile evidence → rule]
```

Loading retains the decision-header skeleton. Partial extraction disables definitive language and shows what could not be verified. A closed or stale role keeps CRM history but suppresses application CTA.

## 4. Match Intelligence 2.0

### Contract and formula

Upstream parsers emit normalized requirements and profile evidence using taxonomy IDs. The deterministic engine computes:

`overall = .35E + .30R + .20C + .15P`

- **Eligibility (E):** hard requirement coverage, experience constraints, work authorization/location constraints. Each unmet hard requirement applies a policy penalty and blocks “recommended”.
- **Relevance (R):** preferred requirement coverage, responsibility similarity, domain/tool alignment.
- **Competitiveness (C):** depth, recency, achievement evidence, role trajectory and market context. Never claims hiring probability.
- **Profile completeness (P):** coverage and review status of facts needed for this specific assessment.
- **Confidence:** a separate qualifier from extraction quality, provenance coverage and ambiguity. It is not included in overall fit.

Example: `E=82, R=76, C=65, P=90 → 78`. If confidence is 48, label the result **Needs review**, not “Strong fit.” If a hard authorization requirement is unmet, label **Not eligible** regardless of the weighted score.

Every result persists requirement-level status, evidence refs, assumptions, policy ID/version, engine version and input snapshot. Inferred evidence receives discounted credit and is visibly flagged. `backend/services/match_intelligence.py` is the reference deterministic core.

### Governance

- Draft → shadow evaluate → compare → approve → activate → retire policies.
- Only authorized admins change weights; all changes require rationale and audit entry.
- Re-score asynchronously on policy/profile/JD change; retain prior assessments.
- LLMs may classify or propose taxonomy mappings, but cannot directly set final scores. Low-confidence mappings require review.

## 5. Ingestion architecture

```text
Source registry → Scheduler → Fetch queue → Raw object store
                                  ↓
                         Extract queue (versioned adapter)
                                  ↓
                    Normalize/taxonomy → Dedupe → Quality gate
                                  ↓
                        Postgres + Search index → job events

Search engine → source candidate → validate endpoint → registry (never job truth)
Failures → bounded retry → DLQ → operator replay
```

Priority: ATS APIs (Greenhouse/Lever/Ashby/Workday patterns) → schema.org JobPosting HTML → XML/RSS/sitemaps → direct career pages → search-assisted endpoint discovery. Adapters share `discover`, `fetch`, `extract`, `verify_open`, and `health_probe` contracts. Raw responses are content-addressed for replay; secrets and prohibited personal data are excluded.

Canonicalization order: normalized canonical URL → `(source, requisition_id)` → title/company/location fingerprint → semantic candidate merge. Semantic similarity may propose a merge but cannot silently merge conflicting requisition IDs. Preserve field-level value, source, extraction method, parser version, observed time and confidence.

Freshness combines last successful verification, explicit close/expiry signals, source cadence, body stability and source health. Jobs progress `active → uncertain → stale → closed`; stale/closed roles are suppressed from discovery but retained for CRM history.

Retry defaults: network/429/5xx use jittered exponential backoff at 1m, 5m, 30m, 2h with source concurrency and `Retry-After`; parser/schema failures skip network retry and route to parser fallback then DLQ. Circuit-break sources after the configured failure budget. Idempotency key: `source_id + external_id + observed_version`.

Events (versioned JSON/Avro contracts):

- `source.crawl.requested.v1 {run_id, source_id, scheduled_at, parser_version}`
- `source.fetch.completed.v1 {run_id, artifact_ref, http, observed_at}`
- `job.extracted.v1 {run_id, source_job_id, parser_version, fields, provenance}`
- `job.normalized.v1 {job_id, canonical_fingerprint, taxonomy_version}`
- `job.upserted.v1 {job_id, changed_fields, freshness_score}`
- `job.closed.v1 {job_id, evidence, observed_at}`
- `match.requested.v1 {job_id, profile_snapshot_id, policy_id}`
- `match.completed.v1 {assessment_id, scores, confidence, scoring_version}`

PII is not placed on shared queue payloads; use opaque IDs. Consumers are idempotent and write an inbox/outbox ledger.

## 6. Domain model and APIs

Core aggregates: Tenant/User/Role, CandidateProfile/ProfileFact/Evidence/ResumeVariant, Source/Parser/IngestionRun/RawArtifact, CanonicalJob/JobObservation/FieldProvenance, TaxonomyNode/Relation, MatchPolicy/Assessment/ReasonTrace, Application/ApplicationEvent/Contact/Interaction/Reminder, AuditEvent.

`database/enterprise_v2.sql` adds the first production schema slice. Production rollout must add tenant foreign keys/RLS after reconciling the current identity provider and migrate legacy status values before enabling the status constraint.

API surface:

- `GET /v2/jobs?query=&source_quality=&freshness=&confidence=&work_mode=&visa=&salary_present=`
- `GET /v2/jobs/{id}` and `GET /v2/jobs/{id}/provenance`
- `POST /v2/matches {job_id, profile_snapshot_id, policy_id}`
- `GET /v2/matches/{id}/explanation`
- `POST /v2/applications`, `POST /v2/applications/{id}/events`, `GET /v2/applications?view=`
- `PATCH /v2/profile/facts/{id}` with optimistic version
- `POST /v2/admin/sources/{id}:pause|resume|replay`, `POST /v2/admin/policies/{id}:activate`

Use cursor pagination, RFC 9457 problem responses, `Idempotency-Key` on mutations, ETags on profile/policy edits, request IDs everywhere, and backward-compatible additive contract evolution.

Caching: CDN only for public static assets; Redis for search facets (1–5 min), job details (event-invalidated), taxonomy (version-keyed), rate limits and idempotency records. Never cache authorization decisions. Search index is a rebuildable projection, not truth.

## 7. Service boundaries and operations

Begin as a modular monolith plus independent ingestion workers; do not prematurely split every module. Separate deployments when scaling/failure profiles require it: ingestion, search indexing, and optional enrichment first. PostgreSQL is truth, object storage holds raw artifacts, OpenSearch/Elasticsearch serves discovery, Redis supports ephemeral coordination, and a durable broker carries events.

Observability uses structured logs with `tenant_id`, `request_id`, `run_id`, `source_id`, `parser_version`, `scoring_version`; OpenTelemetry traces across API/queue workers; RED metrics for APIs and run-quality metrics for sources. Alerts: source volume deviation, parse success <98% for supported sources, duplicate spike, verification lag, freshness p95 decay, DLQ growth, match confidence shift and policy score distribution shift.

Initial SLOs: search p95 <700ms, job detail p95 <400ms, cached explanation p95 <500ms; 99.9% user API availability; 95% of priority sources verified within declared cadence; supported adapter extraction success ≥98%; zero cross-tenant reads in authorization test suite.

## 8. Security, compliance and audit

- OIDC/OAuth, short-lived server-managed sessions, MFA for admins; no shared demo identity in production.
- Enforce tenant scope in service and database policies; deny by default; quarterly access review.
- Encrypt transit/at rest; managed secrets; redact tokens/resume text from logs.
- Source policy records robots/terms posture, request limits, allowed fields and takedown owner.
- Append-only audit events include actor, action, resource, request ID, before/after or safe diff, reason and timestamp. Hash-chain or export to immutable storage for regulated tenants.
- Retention classes: raw fetch artifacts short-lived by policy, canonical jobs and assessments per tenant contract, audit events longer; support subject export/deletion without deleting non-PII operational evidence improperly.

## 9. Engineering roadmap

### MVP foundation (8–10 weeks)

1. Weeks 1–2: freeze contracts; identity/tenant threat model; migration rehearsal; source registry and run ledger.
2. Weeks 2–4: Greenhouse/Lever/schema.org adapters, raw artifact replay, canonical job/provenance/freshness, queue retry/DLQ.
3. Weeks 3–5: normalized JD/profile facts, taxonomy baseline, Match v2 shadow mode and golden evaluation set.
4. Weeks 5–7: Discover + Job workspace, source/freshness indicators, evidence drawer.
5. Weeks 6–8: server CRM statuses/events/reminders, list/Kanban, data import from existing records.
6. Weeks 8–10: admin source health, policy activation, SLO dashboards, security/load/accessibility gates. Cut over only when parity and quality gates pass.

MVP exit: dorks supply zero jobs of record; ≥95% displayed roles have provenance and last-verified time; all v2 scores carry trace/version/confidence; CRM writes are server-side; rollback rehearsed.

### V2 intelligence (next 8–12 weeks)

Workday/Ashby/sitemap adapters; skill graph and synonym governance; semantic duplicate review; profile fact editor/evidence; resume variants and truthful tailoring; contacts/interactions; saved-search alerts; experimentation and outcome calibration. Similarity/LLM proposals stay behind confidence and review gates.

### Enterprise edition (next 12–16 weeks)

Tenant provisioning, SSO/SCIM, custom RBAC, tenant match policies, compliance controls, immutable audit export, regional data controls, source/parser rollout rings, advanced analytics, customer-managed retention and enterprise support SLOs.

## 10. QA and release strategy

- Unit/property tests: canonicalization, score bounds/monotonicity, hard gates, confidence separation, policy validation.
- Golden fixtures per adapter and parser version; schema-drift mutation tests; captured-response replay without live-network dependence.
- Contract tests for APIs/events; idempotency, ordering, duplicate-delivery and poison-message tests.
- Integration/E2E: source → job → match → CRM; tenant isolation and RBAC matrix; accessibility WCAG 2.2 AA; responsive and visual regression.
- Load/soak: search, mass re-score, scheduler burst, downstream 429 and source outage.
- Shadow score v2 against v1; review distribution, false-positive hard matches and confidence calibration. Canary parsers by source cohort and scoring policies by tenant cohort. Feature flags and stored old versions enable rollback.

Release gates: migrations forward/backward compatible; no P0 security findings; SLO dashboards/alerts live; DLQ replay tested; source compliance signed; golden corpus pass; operator runbook complete.

## 11. Risk register

| Risk | Likelihood/impact | Mitigation | Owner signal |
|---|---|---|---|
| ATS/schema drift | High/High | versioned fixtures, canaries, fallback, DLQ | parse failure/field-null spike |
| Source blocking or terms conflict | Med/High | policy registry, respectful limits, disable switch, legal review | 403/429 and compliance alert |
| False confidence in match | High/High | deterministic gate, separate confidence, evidence UI, calibration | low-confidence recommendations |
| Taxonomy bias/poor synonyms | Med/High | governed versions, user correction, segment audits | correction and gap-rate disparity |
| Duplicate/ghost jobs | High/Med | layered identity, freshness state machine, moderation | duplicate and stale impression rate |
| Cross-tenant exposure | Low/Critical | RLS + service auth, isolation tests, audit | any unauthorized access test/event |
| LLM hallucinated profile claims | Med/High | proposal-only enrichment, evidence requirement, user approval | unsupported claim rate |
| Migration breaks active CRM | Med/High | dual read/write, mapping table, rehearsal, rollback | reconciliation mismatch |
| Queue backlog/source outage | Med/Med | budgets, circuit breaker, prioritization, autoscaling | lag and DLQ growth |
| Navigation scope remains bloated | High/Med | six-workspace governance and usage review | task completion/drop-off |

## 12. Immediate repository decisions

1. Keep the current `/v1` behavior available but label legacy fit scores; introduce `/v2` contracts and shadow compute before replacing automation thresholds.
2. Stop adding companies to connector source code. Populate `source_registry` and make adapters consume configuration.
3. Change dork output from job records to `source_candidates`; an operator or validator promotes endpoints.
4. Apply `enterprise_v2.sql` only after backing up and mapping legacy application statuses.
5. Adopt the new deterministic core, then add normalized extraction and persistence around it; do not feed raw text directly into the final scoring function.

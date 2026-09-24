# Tier 3 production readiness audit

**Audited migration:** `supabase/migrations/20260924170000_tier3_learning_synthesis.sql`  
**Linked production project:** `sqzkqzrvxkdbcdpwcywd` (PostgreSQL 17.6)  
**Audit date:** 2026-09-24  
**Classification:** **SAFE WITH PRECONDITION**. Recapture the production baseline and compatibility counts immediately before activation. No remote mutation was made.

## Migration history

The remote lists 39 applied migrations through `20260924145125_tier2_pin_timestamp_search_path`. Their version/name sequence matches the first 39 local migration files. All five Tier 2 migrations are applied. The Tier 3 version `20260924170000` is local only. There is no remote-only or unexpected local version, duplicate version, version collision, or history divergence. No history repair is needed.

## Exact schema effects

- `growth_experiments`: adds nullable `expected_outcome` (10,000 characters), `cost_estimate` (numeric within ±10^15), `outcome_result` (SUPPORTED, PARTIALLY_SUPPORTED, NOT_SUPPORTED, INCONCLUSIVE), `kpi_id` and `risk_id` (UUID FKs), and `owner_label` (240 characters). Adds nullable `confidence` with default `medium` and low/medium/high check. `currency` already exists remotely, so its `ADD COLUMN IF NOT EXISTS` does not change the current currency column or its defaults/checks. Replaces the named status check to include `paused` alongside idea/planned/running/completed/cancelled.
- `founder_forecasts`: creates UUID PK, required owner FK to `auth.users` with cascade delete, prediction, domain, created/resolution dates, predicted outcome, confidence, resolution, nullable assumptions/actual result/calibration notes, and nullable company/project/decision/experiment/KPI/inbox links. Text lengths and enum-like checks are in the migration. Defaults are UUID, `current_date`, `general`, `medium`, `unresolved`, and timestamps. Adds owner/updated, owner/resolution/date, and unique non-null owner/inbox indexes. Grants authenticated CRUD and creates one authenticated owner policy for all commands. Wires owner, audit, and capture-conversion triggers.
- `asset_metadata`: adds nullable last-used and maintenance-due dates, nullable SOP FK, and nullable location reference (1,000 characters). Adds value category default `core`, reuse potential default `medium`, and maintenance requirement default `none`, each with a checked text domain.
- `content_items`: adds nullable company FK, content pillar (240 characters), objective (1,000), target audience (500), content URL (2,048), self-referencing repurpose source FK, and repurpose notes (5,000). Corrective local SQL attaches `founder_owner_guard` to enforce ownership of the two new links.
- `founder_daily_states`: creates UUID PK, required owner FK with cascade delete, date default `current_date`, required energy/focus/stress fields with low/normal/high, poor/normal/strong, and low/normal/high domains respectively; optional notes (5,000); nonnegative integer deep-work minutes, meetings, context switches defaulting to zero; timestamps; unique `(user_id,date)`; and owner/date index. Grants authenticated CRUD, creates one authenticated owner policy for all commands, and wires the owner guard.
- Replaces `founder_owner_guard()` with fixed table/column mappings for new experiment, asset, forecast and content links, plus forecast dependency endpoints. It rejects owner reassignment and sets `updated_at`. Replaces `search_founder_records(text,integer)` to add experiments, forecasts and content, with an owner predicate on every branch and a 1–30 result bound. Replaces `tier1_propose_lesson(text,uuid,text)` to accept founder forecasts and experiments. Replaces `founder_propose_lesson()` as a security-definer trigger function. Grants authenticated CRUD on lessons/evidence (already present in the remote ACL). Corrective local SQL revokes direct execute on the trigger function from PUBLIC, anon and authenticated.
- No backfill, row rewrite, synthetic forecast, accuracy fabrication, new view, or materialized synthesis table is present. Tier 3 signals and synthesis persistence are application-side reads/computation; this SQL adds no signal table.

## Compatibility and preconditions

Remote catalog checks found no Tier 3 table/index name collisions and no pre-existing Tier 3 added columns (excluding the already existing experiment `currency`). Referenced tables, the status constraint being replaced, existing trigger functions, and lesson uniqueness index exist. Aggregate checks: experiments 0 rows, assets 0 rows, content 2 rows with 0 statuses outside the existing workflow domain; 0 owner mismatches in checked existing company/project/decision/content links. The new columns are nullable or have non-null defaults, so current rows do not violate their checks or FKs. No existing data is rewritten. Re-run these checks immediately before activation.

Forecasts have no historical rows and start unresolved; correctness and accuracy require later explicit resolution. Same-owner company/project/decision/experiment/KPI links are checked by the owner guard. Inbox ownership is checked by `founder_capture_conversion`. The migration does not enforce `resolution_date >= created_date` or a nonempty trimmed predicted outcome; these are product input semantics, not current-row conflicts. The database timezone is UTC, so both `current_date` defaults use UTC calendar days. The daily-state unique key is one row per owner per UTC date; application requests must supply the intended date if local-day behavior is desired. Existing Founder State rows are not touched, and the migration stores self-reported state only; it makes no medical inference.

Experiment defaults do not set an outcome result. Existing statuses and results are preserved. The new KPI/risk links use the updated owner guard. Asset SOP links use the existing asset owner-guard trigger after function replacement. Content's new company/repurpose links required the corrective trigger because the old `content_owned_links` trigger lists only client/project/campaign/prompt. Its two current rows are compatible. Existing content statuses are unchanged.

## Production baseline fingerprints

Captured at **2026-09-24 22:55:10 UTC**, before any production change. MD5 is over sorted UUID IDs, not row contents. `E` means `d41d8cd98f00b204e9800998ecf8427e`. Null timestamp ranges are shown as —. `lesson_evidence_links` has no `updated_at` column.

| Table | Rows / owners | ID-set MD5 | Created UTC min–max | Updated UTC min–max |
|---|---:|---|---|---|
| growth_experiments | 0 / 0 | E | — | — |
| asset_metadata | 0 / 0 | E | — | — |
| content_items | 2 / 1 | `7204c3abc111eebeffcf394d5d119394` | 2026-09-04 15:47:28–16:28:07 | 2026-09-04 15:47:49–16:28:07 |
| decisions | 0 / 0 | E | — | — |
| waiting_items | 1 / 1 | `dc07ec7557d334510c4c5e48670c3da6` | 2026-09-04 15:46:16 | 2026-09-04 15:46:31 |
| tasks | 8 / 1 | `f26528a6d44daa21d0975c8d96fe71e2` | 2026-09-04 15:18:29–2026-09-23 18:18:03 | 2026-09-22 10:46:34–2026-09-23 18:18:03 |
| daily_plans | 1 / 1 | `72c71dbfa705e5e1442f14073895acde` | 2026-09-04 15:22:05 | 2026-09-04 16:30:41 |
| operating_commitments | 0 / 0 | E | — | — |
| companies | 0 / 0 | E | — | — |
| kpi_definitions | 0 / 0 | E | — | — |
| operational_systems | 0 / 0 | E | — | — |
| quality_incidents | 0 / 0 | E | — | — |
| operational_dependencies | 0 / 0 | E | — | — |
| operating_risks | 0 / 0 | E | — | — |
| weekly_reviews | 0 / 0 | E | — | — |
| operating_lessons | 0 / 0 | E | — | — |
| lesson_evidence_links | 0 / 0 | E | — | — |
| system_health_checks | 0 / 0 | E | — | — |
| founder_forecasts | absent | — | — | — |
| founder_daily_states | absent | — | — | — |

## RLS, function and grant audit

The new forecast and daily-state policies use `TO authenticated`, `USING auth.uid() = user_id`, and `WITH CHECK auth.uid() = user_id`; these cover owner SELECT/INSERT/UPDATE/DELETE and deny another owner, owner reassignment, and unauthenticated anon access. Forecast owner guard and daily-state owner guard additionally reject reassignment. Existing experiment/asset/content/lesson tables have RLS enabled and owner predicates. Their anon table ACLs exist, but anon has no usable row policy because `auth.uid()` is null. Focused isolated verification now confirms owner CRUD, peer denial, anon denial, and insert/update ownership on all five affected tables. No production mutation test was run.

`founder_owner_guard`, `search_founder_records`, and `tier1_propose_lesson` are security invoker with pinned `public` search paths. Dynamic table names come from fixed mappings and `%I` quoting; caller input is only a mapped key or bound UUID. Search and proposal RPCs revoke PUBLIC/anon execute and grant authenticated execute. Owner guard direct execute is revoked. `founder_propose_lesson` is security definer and runs only as a trigger on existing decisions/incidents/experiments; those source tables require owner RLS and the trigger uses the source row's `user_id`. Its fixed source table name and `ON CONFLICT (user_id,source_table,source_id)` prevent duplicate proposals. The local correction revokes direct execution. Neither anon nor authenticated can CREATE in `public`, limiting search-path shadowing. Service-role and privileged administration retain expected bypass behavior.

The existing lesson and evidence tables have owner RLS and authenticated CRUD already; the migration repeats those grants. Their standalone evidence FK only enforces existence, while their RLS checks `user_id`; the Tier 3 proposal functions write matching owner IDs and check source ownership. Direct client writes to these existing tables should remain within the established Operating Memory trust model; this migration does not add a new direct-write path.

## Regression and performance assessment

No Tier 1/2 table rows are updated. Intentional integration points are the shared owner guard (existing decisions, waiting, risk, KPI, commitment and dependency triggers), search RPC, experiment lesson trigger, and Operating Memory proposal RPC. Founder State, Today, issues, wealth, mobility, documents, relationships, weekly review, Executive Console and Chief of Staff data are not rewritten. Application-side signals/briefs read Tier 3 data after activation.

Forecast owner/updated and owner/resolution/date indexes support owner-scoped reads and due reviews. Daily state has unique `(user_id,date)` plus a reverse-date index. Existing experiment, asset and content owner indexes are present. New nullable KPI/risk/SOP/content links have no dedicated child FK indexes; at current 0/2-row sizes there is no material measured risk. Search uses `lower/position` over owner-filtered sources and can scan as data grows; no present scale justifies speculative indexes.

The SQL is transaction-compatible and has no concurrent index build or data backfill. Under the standard Supabase migration runner it is applied as one migration; do not execute statements independently. `ALTER TABLE ADD COLUMN`, FK/check creation, status-check replacement, trigger changes, and ordinary index creation take table/catalog locks. Existing affected tables are small: experiments 40 KiB, assets 32 KiB, content 80 KiB including indexes at audit time. No timing estimate is asserted.

## Corrective work and verification

Two local edits were made to the unapplied Tier 3 migration: attach `founder_owner_guard` to `content_items`; revoke direct execute on the security-definer lesson trigger function. PGlite 0.5.8 was added as a development dependency because the repository's established DB harness imports it but had not declared it. The pnpm lockfile adds only PGlite; unrelated package versions were preserved.

`node scripts/check-tier3-corrected-migration.mjs` **PASS** on 2026-09-24. It applied all earlier migrations in an in-memory PGlite database, inserted a valid pre-Tier-3 content row, applied the corrected migration inside a transaction, rolled it back, confirmed the new tables disappeared, then applied and committed it. It verified the new tables/RLS and existing content survival. Same-owner company/project/campaign/repurpose content links succeeded; cross-owner versions and `user_id` reassignment failed. The security-definer lesson trigger remained operational and idempotent on a completed owned experiment, produced one owner-scoped lesson, denied a peer source proposal, retained `search_path=public`, and had no anon, authenticated or PUBLIC direct execute. Owner CRUD, peer denial, anonymous denial, and ownership checks passed for forecasts, daily states, experiments, assets and content. The existing DB harness also applied the corrected migration successfully. `git diff --check` passes. Neither test used a remote project.

## Activation sequence (future authorized task only)

1. Confirm the SQL checksum of the locally verified migration is the one to be activated.
2. Immediately recapture every baseline above, migration history, relevant column/constraint/trigger catalog state, and aggregate compatibility/owner-link counts. Stop on unexpected drift.
3. Apply exactly `20260924170000_tier3_learning_synthesis.sql` with the standard migration runner in one transaction. Do not run statements individually.
4. Verify 40 matching remote/local migration entries, with Tier 3 last and no extra versions.
5. Verify new columns, FKs/checks, indexes, defaults, functions, triggers, policies, and grants, including the corrected content trigger and function revoke.
6. Compare affected and Tier 1/2 table row counts, owner counts, ID checksums, and timestamp ranges. Explain only expected live traffic; this migration itself should create no business rows or change existing IDs/timestamps.
7. With authorized temporary authenticated users, test owner CRUD, peer/anon denial, owner reassignment rejection, and cross-owner experiment/KPI/risk, forecast, asset/SOP, and content/company/repurpose links. Test lesson deduplication and source ownership.
8. Run focused Tier 3 forecast resolution, daily-state uniqueness, experiment conclusion, content/asset, search, signals and synthesis smoke.
9. Run focused Tier 1/2 Founder State, Today, decisions, issues, waiting, dependencies, risks, commitments, KPI, infrastructure, wealth, mobility, documents, relationships, Weekly Review, Executive Console, Chief of Staff and Operating Memory regression smoke.
10. Remove all authorized synthetic rows/users; verify zero remain and compare production fingerprints again.

Stop before application if migration history or compatibility drifts, the corrected local tests fail on the activation commit, or a lock cannot be acquired safely. After application, stop further rollout if schema/RLS isolation or fingerprints differ unexpectedly. Rollback requires a reviewed forward correction or restoration plan; do not delete migration history or reverse DDL ad hoc.

READY FOR REMOTE TIER 3 MIGRATION

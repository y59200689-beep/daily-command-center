# Tier 2 remote production-readiness audit

Audit date: 24 September 2026. This was a read-only inspection of the currently linked Supabase project. No remote migration, data write, Auth-user creation, RLS change, or hosting deployment was performed. The audit used `supabase migration list --linked`, a schema-only remote dump, and fixed `SELECT` aggregate queries. It did not retrieve record contents or user identifiers.

## Result

**All five migrations are SAFE WITH PRECONDITION for remote activation.** The linked remote history is in sync with the local history, all three Tier 1 migrations are present, and none of the Tier 2 migrations is applied. Compatibility queries found no current records violating the Tier 2 check domains or ownership links. All affected Tier 2 tables are empty at this baseline. Re-capture the listed fingerprints immediately before activation; if the affected tables have acquired rows, repeat the row-compatibility queries and review default semantics before applying.

No migration defect requiring a local correction was found. No broad test suite was rerun. `git diff --check` passed after writing this report.

## Exact Tier 2 sequence and schema effects

| Order and migration | Purpose and effects | Compatibility / precondition |
|---|---|---|
| 1. `20260924010000_tier2_business_kpis.sql` | Adds `companies.lifecycle_status`; adds KPI definition fields `description`, `owner_label`, `source_reference`, `target_max`, `aggregation`; adds observation fields `unit`, `is_manual`. Adds lifecycle, aggregation, range, direction and source checks (replaces the existing direction/source checks). Adds `tier2_kpi_unit_guard`, `tier2_kpi_period`, and `tier2_kpi_values`; installs unit guards on definitions and observations. Adds no table, index, FK, or RLS policy. Revokes public/anon execution on read RPCs and grants authenticated execution; the unit trigger function is not callable by public/anon/authenticated. | **SAFE WITH PRECONDITION.** Remote has zero companies, KPI definitions and observations; current validation counts are zero. Existing rows would receive lifecycle `operating`, aggregation `latest`, and `is_manual=true`; matched observations are backfilled from their owning KPI's unit. Recheck row counts and provenance before activation if any such records arrive. The observations backfill may update their `updated_at` via the existing trigger. |
| 2. `20260924020000_tier2_infrastructure.sql` | Adds project/risk links and billing, domain, deployment, version and migration metadata to `operational_systems`. Creates `system_health_checks` with owner, system, component, status, date and source fields; owner/system/integration FKs; validation checks; and `system_health_owner_date(user_id,system_id,checked_on)` index. Adds `tier2_owned_links`; guards operational systems, system health and access records; adds the health audit trigger; replaces `search_founder_records(text,integer)` with the Tier 2 search sources. New-table RLS is enabled with authenticated owner `USING`/`WITH CHECK`; authenticated CRUD is granted and anon is explicitly revoked. Functions are invoker-security; search RPC is authenticated-only. | **SAFE WITH PRECONDITION.** The remote has zero operational systems and access rows. Current company/project/risk/commitment ownership checks show no cross-owner links. Recheck linked rows before activation. The existing `founder_owner_guard` already checks access-record system/person ownership; the new guard adds continuity-secret rejection and related-link checks for the new infrastructure fields. |
| 3. `20260924123954_tier2_personal_administration.sql` | Expands the balance category check; adds wealth owner/liquidity/due/payment/interest/material fields; adds nullable `category` and `liquid` history fields; replaces `founder_wealth_history()` to capture those fields on future entry writes. Adds trip departure, visa, insurance, administration, passport/document and accommodation fields, with date checks and an owned-document trigger. Expands document types and adds owner, verification and reminder fields. No indexes or RLS policies are added/changed. Revokes public/anon/authenticated execution from the trigger function (trigger execution remains server-managed). | **SAFE WITH PRECONDITION.** The remote has zero balance entries/history, trips and personal documents. Existing category/document-type values are within the new accepted sets; invalid trip date count is zero. New metadata columns are nullable or use explicit benign defaults (`material=false`, `passport_required=false`, `verification_status=unverified`, `reminder_days=30`). No existing history is rewritten or currency converted. Recheck if rows arrive before activation. |
| 4. `20260924142331_tier2_commitment_follow_up.sql` | Adds nullable `operating_commitments.follow_up_date`; adds partial index `operating_commitments_follow_up_idx(user_id,follow_up_date)` for open commitments with a date. No function, trigger, policy or grant changes. | **SAFE WITH PRECONDITION.** No commitments currently exist and no backfill occurs. Recheck current row count; new index build is ordinary (not concurrent) and takes a write-blocking table lock while built. |
| 5. `20260924145125_tier2_pin_timestamp_search_path.sql` | Sets `public.set_updated_at()` search path to the empty path. No table, row, index, policy or grant change. | **SAFE.** The existing body uses only `NEW.updated_at` and the built-in `now()`; `pg_catalog` remains implicitly available. Existing trigger behavior is preserved while caller-controlled schema lookup is removed. |

### Ordering and remote migration history

The linked project reports **34 applied versions** through `20260923030000`; all 34 match the local versions. The three Tier 1 migrations are present remotely:

- `20260923010000_founder_state_operating_layer.sql`
- `20260923020000_founder_rpc_permissions.sql`
- `20260923030000_tier1_workflows.sql`

The five Tier 2 versions above are the only local versions without a remote counterpart. There are no remote-only versions, duplicate versions, or history divergence. The local sequence is deterministic by its unique 14-digit version prefixes, strictly after Tier 1 and in the order shown. A legacy shared version `20260909240000` is present on both sides and does not collide with the Tier 2 sequence. No history repair is needed.

## Schema and existing-data compatibility

The remote schema dump confirmed that the new `system_health_checks` table and all Tier 2 columns/indexes/policy names are absent. The existing objects targeted by `ALTER`, `DROP CONSTRAINT`, `CREATE OR REPLACE FUNCTION`, and the timestamp-function change exist with the expected table/function signatures. No Tier 2 trigger, index, policy, or `tier2_*` function-name collision was found. The intentionally replaced checks (`kpi_definitions_direction_check`, `kpi_definitions_source_check`, `personal_balance_entries_category_check`, `personal_documents_type_check`) exist remotely under the expected names. Added columns are absent remotely; their types/defaults are compatible with the local migration definitions. No enum is changed; domain extensions are text checks.

Aggregate-only precondition checks returned zero for: KPI directions or sources outside the new domains; KPI observations requiring the unit backfill; personal categories or document types outside the expanded domains; trips with end before start; personal history rows without an owner-matched balance entry; access rows linked to another owner's system; and commitment company/project/relationship links owned by another user. This audit did not inspect row contents. At the captured baseline, the affected tables are empty, so no current data violates the new rules. No migration fabricates KPI observations, currency rates, or historical wealth values. The wealth-history extension records category/liquidity on later writes; existing history rows remain unchanged with those new optional fields null.

## Baseline fingerprints

Captured from the linked remote on 24 September 2026 using aggregate queries only. `ID-set MD5` is a stable checksum of sorted primary-key UUIDs, not a content checksum. No IDs or row contents are recorded. Empty tables have the same empty-set checksum (`d41d8cd98f00b204e9800998ecf8427e`). Timestamp ranges are UTC.

| Table | Rows / owners | Created range | Updated range | ID-set MD5 |
|---|---:|---|---|---|
| `companies` | 0 / 0 | — | — | `d41d8cd98f00b204e9800998ecf8427e` |
| `kpi_definitions` | 0 / 0 | — | — | `d41d8cd98f00b204e9800998ecf8427e` |
| `kpi_observations` | 0 / 0 | — | — | `d41d8cd98f00b204e9800998ecf8427e` |
| `operational_systems` | 0 / 0 | — | — | `d41d8cd98f00b204e9800998ecf8427e` |
| `system_access_records` | 0 / 0 | — | — | `d41d8cd98f00b204e9800998ecf8427e` |
| `personal_balance_entries` | 0 / 0 | — | — | `d41d8cd98f00b204e9800998ecf8427e` |
| `personal_balance_history` | 0 / 0 | — | — | `d41d8cd98f00b204e9800998ecf8427e` |
| `trips` | 0 / 0 | — | — | `d41d8cd98f00b204e9800998ecf8427e` |
| `personal_documents` | 0 / 0 | — | — | `d41d8cd98f00b204e9800998ecf8427e` |
| `operating_commitments` | 0 / 0 | — | — | `d41d8cd98f00b204e9800998ecf8427e` |
| `decisions` (Tier 1) | 0 / 0 | — | — | `d41d8cd98f00b204e9800998ecf8427e` |
| `quality_incidents` (Tier 1 issues) | 0 / 0 | — | — | `d41d8cd98f00b204e9800998ecf8427e` |
| `waiting_items` (Tier 1) | 1 / 1 | 2026-09-04 15:46:16.180518 | 2026-09-04 15:46:31.151871 | `dc07ec7557d334510c4c5e48670c3da6` |
| `operational_dependencies` (Tier 1) | 0 / 0 | — | — | `d41d8cd98f00b204e9800998ecf8427e` |
| `operating_risks` (Tier 1) | 0 / 0 | — | — | `d41d8cd98f00b204e9800998ecf8427e` |
| `tasks` (Today) | 8 / 1 | 2026-09-04 15:18:29.483449 – 2026-09-23 18:18:03.566943 | 2026-09-22 10:46:34.370792 – 2026-09-23 18:18:03.566943 | `f26528a6d44daa21d0975c8d96fe71e2` |
| `daily_plans` (Today) | 1 / 1 | 2026-09-04 15:22:05.304813 | 2026-09-04 16:30:41.235766 | `72c71dbfa705e5e1442f14073895acde` |
| `weekly_reviews` | 0 / 0 | — | — | `d41d8cd98f00b204e9800998ecf8427e` |
| `memory_items` (Operating Memory) | 0 / 0 | — | — | `d41d8cd98f00b204e9800998ecf8427e` |
| `operating_lessons` (Operating Memory) | 0 / 0 | — | — | `d41d8cd98f00b204e9800998ecf8427e` |

These are pre-activation baselines, not a claim that later application traffic cannot change rows. Compare row counts and ID-set checksums in a controlled activation window; reconcile any expected `updated_at` changes before accepting the post-migration comparison.

## RLS, functions and grants

- The existing affected tables have RLS enabled and owner policies for `authenticated`; owner guards reject user-id reassignment and validate the existing business, project, system, KPI, relationship, commitment, access, and personal-document links. The remote catalog check found no anon policies. Existing roles have table ACL grants including `anon`, but RLS has no anon policy, so anonymous reads/writes remain row-denied. The new health table explicitly revokes anon and grants authenticated CRUD with owner `USING` and `WITH CHECK` predicates.
- The new KPI RPCs and replacement founder search function are `SECURITY INVOKER`, use `auth.uid()` owner predicates, and have public/anon execute revoked; authenticated access is explicit. Trigger functions are not callable data RPCs. `tier2_owned_links` uses a fixed internal mapping for dynamic table identifiers, not caller-supplied SQL identifiers. No SQL concatenation of caller-provided search input occurs.
- `founder_wealth_history()` is invoker-security; its existing trigger writes through the balance-history owner policy. The migration revokes public/anon/authenticated direct execution; service-role default access remains. `set_updated_at()` is invoker-security and reads/writes only the trigger row timestamp. Its existing anon execute ACL is retained by the path-only migration; it returns `trigger` and exposes no private row read or write RPC.
- Supabase default privileges currently grant newly created public tables/functions to `anon`, `authenticated`, and `service_role`. The Tier 2 DDL explicitly removes `anon` for the new health table and each new/replaced data RPC/trigger function; it explicitly grants authenticated only where intended. It does not grant `PUBLIC`. No sequence or view is added. Service-role access remains available for server administration and RLS bypass as designed.
- Security-definer functions: none are added or modified by Tier 2. No function broadens an ownership predicate. Existing RLS and foreign-owner checks remain in force.

## Business, personal and Tier 1 safety

KPI company scoping is protected by the existing owner guard; commerce-derived values filter the authenticated user, selected company and currency. Currency values are not combined across units. The new history function preserves original amounts/currencies and adds optional category/liquid snapshots only on future writes. Trip and document date fields are user-recorded metadata; there is no migration-generated visa/legal determination. Relationship/commitment and access links use owner-matching guards.

Tier 2 does not rewrite Founder State, decisions, incidents, waiting rows, dependencies, risks, Today plans/tasks, Weekly Reviews, or Operating Memory. Its intentional Tier 1 touch points are: (1) add Tier 2 sources to the existing search RPC; (2) extend the existing wealth-history trigger payload; and (3) pin the shared updated-at trigger's search path. No Tier 1 record backfill is performed. The baseline fingerprints above cover the critical persisted Tier 1 surfaces; view-only Executive/Founder State signals are derived from those sources and are included in post-activation smoke checks.

## Performance and transaction/lock assessment

- No duplicate index names were found. New indexes are the composite health-owner/system/date index and the partial open-commitment follow-up index. Current affected table sizes are zero, except the small Tier 1 tables listed above.
- New project/risk/passport-document/integration FKs do not all receive standalone child-column indexes. At the current small/empty registry volumes this is not a material activation blocker; parent deletes/updates could scan those child tables as volume grows. Reassess with measured scale rather than adding speculative indexes now.
- KPI history aggregation is bounded to six prior periods per active KPI, but performs correlated per-KPI period work. Search uses bounded result counts but `position(lower(...))` can scan each source table; existing owner indexes/RLS still scope data. No present volume warrants speculative optimization.
- All five files contain transaction-compatible PostgreSQL DDL/DML. No explicit `BEGIN`/`COMMIT`, `CREATE INDEX CONCURRENTLY`, or external side effect breaks a transaction; under Supabase CLI per-version migration application they are fully transactional. If run statement-by-statement in autocommit mode they could be partially applied, so activation must use the standard migration runner and inspect its failure behavior. `ALTER TABLE` check/FK validation and drop/re-add checks require table locks/scans; the KPI unit backfill updates matching observations; the ordinary follow-up index build blocks writes to commitments; the final function setting is a low-volume catalog change. With present row counts the scan/data risks are small, but lock acquisition remains operationally relevant. No timing estimate is asserted.

## Exact activation and post-activation plan

This sequence is for a separate explicitly authorized activation task; this audit did not execute it. Re-capture baselines and repeat the listed constraint counts immediately before step 1.

| Step | Expected schema/data effect | Qualitative lock/rewrite risk | Post-step verification |
|---|---|---|---|
| 1. `20260924010000_tier2_business_kpis.sql` | KPI/company columns and checks; unit functions/triggers; existing matching observation units backfilled; defaults set on existing company/KPI/observation rows. No new record IDs expected. | Check replacement scans/locks; observation update takes row locks and can update timestamps. | Version history; column/check/function/trigger presence; compare baseline row counts and ID checksum; unit backfill count zero after apply; test authenticated KPI read/write and anon denial. |
| 2. `20260924020000_tier2_infrastructure.sql` | Infrastructure metadata columns; new empty health table; owner/system/integration validation; search RPC gains Tier 2 sources. Existing `production_dependency` values default false. | Validated FKs/checks lock and scan operational systems; table creation and index are small. | Version history; health-table RLS and grants; same-owner versus foreign-owner link checks; anon denied; authenticated health create/read/update/delete; search remains owner-scoped. |
| 3. `20260924123954_tier2_personal_administration.sql` | Wealth, history, trip and document metadata; expanded text checks; owner document trigger; history function extended. No FX or historical-value rewrite. | Check replacement and FK validation scan/lock; defaults apply to existing rows. | Version history; compare counts/ID checksums; verify category/document domain counts zero, trip date ordering, history values/currencies unchanged; normal-user owner isolation and anon denial. |
| 4. `20260924142331_tier2_commitment_follow_up.sql` | Nullable follow-up date and partial index; no existing row changes. | Ordinary index build blocks commitment writes for its duration. | Version history; index predicate/columns; row count and ID checksum unchanged; authenticated follow-up read/write smoke and foreign-owner denial. |
| 5. `20260924145125_tier2_pin_timestamp_search_path.sql` | Pins shared timestamp trigger function search path; no row changes. | Small catalog lock/update; no table rewrite. | Confirm empty function `search_path`; update one synthetic owned row in the separately authorized post-activation test, verify `updated_at`, then remove the synthetic fixture. |

After all steps: confirm all five history entries match; recompare Tier 2 and Tier 1 row counts/ID checksums against the baseline and explain intended timestamp/unit/default changes; verify RLS remains enabled, anon remains denied, authenticated owners can read/write only their own rows, and foreign relationships are rejected; run focused Tier 2 reads/writes across KPI, infrastructure/access, personal wealth/travel/documents, relationships/commitments; smoke-check Founder State, Today, Executive and Weekly Review; run focused Tier 1 decision/issue/waiting/dependency/risk/Operating Memory regressions; clean all synthetic rows/users and confirm zero remain. Deploying hosting is a separate operation and requires separate authorization.

READY FOR REMOTE TIER 2 MIGRATION

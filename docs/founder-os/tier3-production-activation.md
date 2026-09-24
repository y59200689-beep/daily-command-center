# Tier 3 production database activation

**Date:** 2026-09-24  
**Project:** `sqzkqzrvxkdbcdpwcywd` (the linked, active production Supabase project)  
**Migration:** `20260924170000_tier3_learning_synthesis.sql`  
**Local SQL SHA-256:** `2a5defa2e1e617bea201dae8bd1568ca3e2bb52ed7478110e89988ba24cf1183`  
**Outcome:** Database migration applied. Database and authenticated production-backed browser checks passed. Hosting was not deployed.

## Pre-activation checks

- Linked ref and project API both identified `sqzkqzrvxkdbcdpwcywd`; PostgreSQL 17.6, active/healthy.
- Remote history contained 39 versions, exactly matching the first 39 local files. All five Tier 2 versions remained applied. Tier 3 was the sole pending local version; no remote-only or conflicting version existed.
- The Supabase CLI dry run (`db push --linked --project-ref sqzkqzrvxkdbcdpwcywd --skip-vault --dry-run`) listed **only** `20260924170000_tier3_learning_synthesis.sql`, with no seeds or roles.
- Compatibility aggregates: experiments 0, assets 0, content items 2; invalid content statuses 0; foreign-owner client/project/campaign/prompt links 0. New Tier 3 table/index and added-column collisions 0. The expected existing status constraint, six replacement/trigger functions, and eight referenced relations were present. Database timezone UTC.
- The immediate baseline at **2026-09-24 23:12:53 UTC** matched the earlier readiness baseline exactly, including row counts, owner counts, ID-set MD5s, and timestamp ranges.

## Application and history

The standard Supabase CLI migration runner applied exactly `20260924170000_tier3_learning_synthesis.sql` with `--linked --project-ref sqzkqzrvxkdbcdpwcywd --skip-vault --yes`. It exited successfully. No additional migration, seed, role, or vault update was requested. A fresh remote history listing showed 40 entries matching all 40 local files, with Tier 3 last. No history repair was performed.

## Schema and security verification

Remote catalog checks found `founder_forecasts` (20 columns) and `founder_daily_states` (12 columns); all seven new experiment, seven asset, and seven content columns; four named Tier 3 indexes; 26 new-table PK/FK/check/unique constraints; four new-table user triggers; and the corrected `content_items.founder_owner_guard` trigger. RLS is enabled on both new tables with two authenticated owner `ALL` policies. The replaced owner guard contains the content company/repurpose mapping.

`founder_propose_lesson()` remains `SECURITY DEFINER` with `search_path=public`. Direct EXECUTE is absent for PUBLIC, anon, and authenticated. A completed, owner-scoped synthetic experiment invoked it through its intended trigger and created exactly one lesson. A peer could neither read that lesson nor access the source. The corrected content guard rejected both a foreign company link and a foreign repurpose-source link; owner reassignment was rejected.

Live PostgreSQL role checks used two synthetic `auth.users` rows inside a single explicit transaction, switched to `authenticated` with each user's JWT subject, and tested owner/peer/anon behavior. Forecast creation and resolution, daily state, experiment conclusion, asset metadata, and content progression all persisted and read back inside the transaction. The peer could not read the owner's rows, update the forecast, or delete the daily state; anon could not read the tested private rows. The entire transaction was rolled back, and a subsequent query confirmed zero synthetic users and rows. This verifies database RLS and trigger behavior, but it does **not** substitute for Auth-service JWT and HTTP/browser route checks.

## Focused smoke

**Tier 3 database smoke: PASS.** The production database accepted and read back an experiment lifecycle with outcome and lesson, a resolved forecast, daily state, asset metadata, and content progression. A separate transaction exercised Tier 1/Tier 2 task, waiting, decision, commitment, company, KPI, infrastructure, and founder-search persistence/readback: **PASS**. Both transactions rolled back.

### Final authenticated browser smoke

The disposable normal Supabase Auth account was loaded from `.env.local` without printing its credentials. The current production build ran locally against the production project using its public client configuration. The application login established a normal user session; `/today` remained authenticated after reload. No service-role or admin credential was used.

Focused browser workflows passed: `/state` saved a synthetic daily check-in and retained it after reload; `/forecasts` created and resolved a synthetic forecast with database readback; `/experiments` advanced a synthetic experiment through planned, running, and completed with outcome readback. `/communication` produced a proposal, dismissed it, and did not confirm an unintended object. `/executive` and `/chief-of-staff` rendered without an indefinite loading state. Focused authenticated regression routes `/today`, `/business-pulse`, `/infrastructure`, `/commitments`, and `/decisions` rendered. Browser page/console errors and failed local API responses: **none**.

The synthetic forecast, experiment, and daily state were deleted through normal user permissions. The experiment trigger created one proposed Operating Memory lesson; it was identified by the run's unique synthetic title and deleted through the same normal user session. Final marker counts were zero in `founder_forecasts`, `growth_experiments`, `founder_daily_states`, and `operating_lessons`; no cross-domain fixture was created. The disposable Auth user remains and must be deleted manually in Supabase Authentication if no safe user-delete path is available. Hosting was not deployed.

## Fingerprint comparison

Post-application/cleanup baseline captured at **2026-09-24 23:19:48 UTC**. Every existing table below had identical row count, owner count, ID-set checksum, and min/max creation/update timestamps before and after the migration. `E` is the empty ID-set MD5 `d41d8cd98f00b204e9800998ecf8427e`. Timestamps are UTC; `lesson_evidence_links` has no `updated_at`.

| Table | Pre → post rows / owners | ID-set MD5 | Created min–max | Updated min–max |
|---|---:|---|---|---|
| growth_experiments | 0/0 → 0/0 | E | — | — |
| asset_metadata | 0/0 → 0/0 | E | — | — |
| content_items | 2/1 → 2/1 | `7204c3abc111eebeffcf394d5d119394` | 2026-09-04 15:47:28–16:28:07 | 2026-09-04 15:47:49–16:28:07 |
| decisions | 0/0 → 0/0 | E | — | — |
| waiting_items | 1/1 → 1/1 | `dc07ec7557d334510c4c5e48670c3da6` | 2026-09-04 15:46:16 | 2026-09-04 15:46:31 |
| tasks | 8/1 → 8/1 | `f26528a6d44daa21d0975c8d96fe71e2` | 2026-09-04 15:18:29–2026-09-23 18:18:03 | 2026-09-22 10:46:34–2026-09-23 18:18:03 |
| daily_plans | 1/1 → 1/1 | `72c71dbfa705e5e1442f14073895acde` | 2026-09-04 15:22:05 | 2026-09-04 16:30:41 |
| operating_commitments | 0/0 → 0/0 | E | — | — |
| companies | 0/0 → 0/0 | E | — | — |
| kpi_definitions | 0/0 → 0/0 | E | — | — |
| operational_systems | 0/0 → 0/0 | E | — | — |
| quality_incidents | 0/0 → 0/0 | E | — | — |
| operational_dependencies | 0/0 → 0/0 | E | — | — |
| operating_risks | 0/0 → 0/0 | E | — | — |
| weekly_reviews | 0/0 → 0/0 | E | — | — |
| operating_lessons | 0/0 → 0/0 | E | — | — |
| lesson_evidence_links | 0/0 → 0/0 | E | — | — |
| system_health_checks | 0/0 → 0/0 | E | — | — |
| founder_forecasts | absent → 0/0 | E | — | — |
| founder_daily_states | absent → 0/0 | E | — | — |

There was no row loss, new persistent business ID, or timestamp change in the compared Tier 1/Tier 2 surfaces. New Tier 3 tables are empty after rollback. The migration did not backfill or rewrite records.

## Cleanup and final status

The earlier transactional database fixtures rolled back with zero synthetic Auth users or records from those checks. The later browser smoke used one pre-existing disposable normal Auth user. All synthetic browser records, including the trigger-created lesson, were removed and marker counts are zero. The Auth user itself remains for manual removal from Supabase Authentication.

| Gate | Status |
|---|---|
| Tier 3 migration applied | YES |
| Migration history | ALIGNED, 40/40 |
| Tier 3 live database smoke | PASS |
| Tier 1/Tier 2 database regression smoke | PASS |
| Live database RLS/isolation | PASS |
| Corrected content owner guard | PASS |
| Corrected lesson-trigger permissions/behavior | PASS |
| Authenticated login and session reload | PASS |
| Authenticated Tier 3 browser smoke | PASS |
| Authenticated Tier 1/Tier 2 browser regression | PASS |
| Browser console/network errors | NONE |
| Synthetic DB cleanup | PASS |
| Disposable Auth user | REMAINS for manual deletion |
| Hosting deployed | NO |

TIER 3 PRODUCTION ACTIVATION COMPLETE

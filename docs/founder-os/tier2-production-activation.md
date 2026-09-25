# Tier 2 production database activation

Activation date: 24 September 2026. Scope: the five pre-authorized Tier 2 Supabase migrations and synthetic authenticated verification. No hosting deployment was requested or performed.

## Activation result

The linked project matched the project allowlist. Immediately before activation, all 34 existing local/remote migration versions matched and these five Tier 2 migrations were the only pending versions. `supabase db push --linked --skip-vault --yes` applied the exact five versions below. A fresh `supabase migration list --linked` afterwards showed all 39 versions matched locally and remotely, with no pending or remote-only versions.

1. `20260924010000_tier2_business_kpis.sql`
2. `20260924020000_tier2_infrastructure.sql`
3. `20260924123954_tier2_personal_administration.sql`
4. `20260924142331_tier2_commitment_follow_up.sql`
5. `20260924145125_tier2_pin_timestamp_search_path.sql`

Post-activation catalog checks found all expected Tier 2 columns, constraints, functions, triggers, indexes, and RLS policy. RLS is enabled on `system_health_checks`; its owner policy and authenticated CRUD grants are present, anon table access is revoked, KPI/search functions are invoker-security with authenticated-only execution, and the timestamp function has an empty search path. The existing timestamp trigger ACL is unchanged. No hosting command was run. No production Auth user or business fixture was created outside the synthetic E2E runs; the audited Tier 2 tables were empty before activation and the migrations did not fabricate records.

The Supabase CLI printed all five migration applications and then attempted a post-push Docker `edge-runtime` image pull, which failed because the local Docker credential helper was unavailable. The pull happened after the migration push; subsequent remote migration history and catalog verification confirmed the migrations were applied. No functions or hosting were deployed.

## Authenticated verification

- Tier 2 authenticated remote E2E matrix: **14/14 passed (100%)** — desktop 6/6, iPhone 4/4, Android 4/4. This evidence was retained; the matrix was not rerun during focused triage.
- Initial post-activation Tier 1 desktop smoke: 2/7 passed. The five failures and focused investigation are recorded below.
- Final focused Tier 1 desktop smoke: **7/7 passed (100%) in 9.8 minutes**, using the normal synthetic browser session against the remote database. It covers session/A-B/anonymous isolation, ten authenticated routes, Decision Journal create/review/lesson/refresh, issue/postmortem/follow-up, populated cross-domain propagation/bottlenecks/changes/Weekly Review, dependencies/capture, and final RLS/client-credential regression.
- No unexpected console or API errors in the final smoke's checks. Known Node color-environment and unused-font-preload warnings were benign. No application or schema fix was needed; only the harness changed.
- Hosting deployed: **NO**. No Tier 3 work began.

## Cleanup and safety

The E2E runner completed teardown. Its cleanup artifact reports zero remaining Auth users and zero owned rows. A separate read-only remote query after final teardown checked all three registered final-run user IDs (owner and two peers), including IDs no longer present in Auth: **0 Auth users, 0 owned fixture rows across public user-owned tables, no nonzero fixture tables**, and **0 tagged remote E2E Auth users**. This ID-based check does not depend on the deleted users still existing. `.playwright-auth` was absent after the run. The synthetic peer user was explicitly reported deleted and verified.

Privileged Supabase credentials were used only by server-side provisioning/cleanup and database administration. The browser authenticated as the temporary normal Supabase user. Remote-test mode stayed explicitly opt-in and allowlist-guarded. No RLS disablement, middleware bypass, production backdoor, hosting deployment, or intentional mutation of real user records occurred. The five Tier 2 migrations are **not local-only anymore**; all five are applied remotely.

## Tier 1 Regression Triage

Focused triage used disposable normal users against the existing remote schema. No application code, migrations, ownership policies, or hosting were changed. Original first-run traces were disabled, so exact historical request latency and server errors are unavailable where stated below; measured reproductions are distinguished from those original failures.

| Original failure | Evidence and cause | Classification | Fix and focused verification |
|---|---|---|---|
| Normal session / A-B / anonymous isolation | Original overall test limit: 30 s. Focused reproduction reached `clientSecretCheck` after RLS assertions and peer cleanup, then expired fetching `/_next/static/chunks/main-app.js` (HTTP 200 headers received). No DB error was involved. | TEST HARNESS DEFECT | Give the combined security workflow 180 s; fetch public scripts concurrently with a cookie-free API context, check HTTP success and scan every body. Focused test passed in 26.5 s; final smoke first check passed in 22.5 s. |
| Authenticated route sweep | Original navigation to `/dependencies` aborted when the entire ten-route test expired at 30 s. Final reproduction completed all ten routes in 41.8 s without auth/API errors. | TEST HARNESS DEFECT | Set the multi-route test budget to 180 s. Its route, heading, auth and API-error assertions remain intact. Final smoke route sweep passed. |
| Decision Journal review | Original `/decisions/:id` review-heading assertion was interrupted by the test's 30 s total budget. Owner-scoped decision GET reproduced at HTTP 200 / 2.313 s; related workflow/lesson/relationship GET at 200 / 1.897 s, later save/read requests 200 / 0.230–1.240 s. A separate early-click diagnostic reproduced a hydration race before the initial list response; after data rendered, the dialog and options request succeeded (HTTP 200). No selector or DB schema change was needed. | TEST HARNESS DEFECT (test budget); TRANSIENT RUNTIME ISSUE (early interaction diagnostic) | Set only this multi-step workflow to 180 s and retain API status/timing diagnostics. Original create → review → lesson → refresh assertions passed in 21.6 s in isolation and 19.7 s in final smoke. |
| Executive briefing loading | Original `/executive` assertion still saw `Assembling briefing…` after 30 s. Historical network trace unavailable. Focused authenticated `/api/founder-briefing?window=7` returned HTTP 200 in 3.977 s with all 29 coverage groups available. Independent normal page request returned 200 by 8.906 s; UI cleared loading by 9.068 s, without console/server errors. Code inspection confirms this loader uses owner-filtered table reads, financial aggregation and `tier2_kpi_values`, not `search_founder_records`. | TRANSIENT RUNTIME ISSUE; exact original dependency not recoverable | No production fix or speculative index. The unchanged populated cross-domain propagation test passed in final smoke (3.7 minutes), including Executive Console, Founder State, Today, bottlenecks, changes and Weekly Review. |
| Final peer metadata collision | `.playwright-auth/peer-meta.json` used exclusive creation under a fixed name; an interrupted earlier isolation test retained that registry until teardown. The next isolation test hit filesystem `EEXIST` before creating another user. One worker was configured; no database unique constraint or reused UUID caused this. | TEST HARNESS DEFECT | Use unique `peer-meta-<run UUID>.json` reservations; cleanup enumerates both new and legacy peer registries, validates project/identity, removes owned rows and Auth users, verifies absence, then removes metadata. Focused isolation passed with verified peer cleanup. Final repeated isolation passed in 1.6 minutes with a second peer in the same run; both peers were independently cleaned. |

Live read-only catalog checks confirmed RLS enabled for decisions, waiting, dependencies and risks, with `user_id = auth.uid()` owner predicates (decisions/waiting retain their existing PUBLIC-role policies; anonymous UID is null). Owner guards and timestamp triggers remain installed. Search keeps its `(search_query text, result_limit integer)` signature, invoker security, authenticated execute and anon denial. `tier1_propose_lesson` and `tier1_weekly_review` keep their expected signatures and grants; `set_updated_at` keeps its trigger signature and empty search path. Browser owner reads, review saves, foreign-owner denial and anonymous denial were exercised with synthetic users. No evidence connects these failures to an applied Tier 2 migration.

Focused ESLint passed for the three changed harness files. No full unit suite, Tier 2 matrix, production build or mobile suite was rerun. Disk remained safe at 17 GiB free. Temporary diagnostic specs and project matching changes were removed; original Playwright configuration was restored.

## Gate

All five approved migrations remain applied, with the previously confirmed 39-version history aligned. Tier 2 matrix: 14/14. Final Tier 1 smoke: 7/7. Final cleanup: 0 users / 0 fixture rows. Focused ESLint and `git diff --check` passed. Test process exited successfully. No rollback, additional migration, history repair, hosting deployment, real-user data mutation, or Tier 3 work occurred during triage.

TIER 2 PRODUCTION ACTIVATION COMPLETE

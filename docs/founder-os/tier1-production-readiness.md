# Tier 1 Founder OS — production readiness (Stage 1)

**Scope:** local audit and read-only linked Supabase inspection, 23 September 2026. The migration below remains unapplied remotely; no hosting deployment was performed.

## Migration readiness

**Ready for remote migration.** The migration is one transaction and contains no `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, data reset, or destructive data update. Its seven column additions are nullable or have safe defaults, and the new `year` / `risk` check values are supersets of current allowed values. Replacing checks briefly takes table locks but does not discard valid values. Remote goal data is one `quarter` row; operational dependency tables are empty. New workflows use owner RLS, same-owner trigger validation, and authenticated invoker RPCs.

The local migration has now been hardened: trigger-only helpers explicitly revoke `EXECUTE` from `PUBLIC`, `anon`, and `authenticated`; the new strategy table revokes table privileges from `PUBLIC` and `anon` before granting authenticated CRUD; RPC grants are explicit; and target-side strategy lookups have an index. The PGlite harness verifies ACLs via `aclexplode` (grantee OID 0 for `PUBLIC`) as well as role checks.

**Post-migration checks still required:** authenticated owner-vs-other-user and anonymous live checks have not run against the new remote schema because this Stage 1 is read-only and must not insert test fixtures. The browser could not reconnect to localhost for read-only route inspection after the dev server was started; no browser authentication cookie/session values were inspected or changed. The previous redirect therefore is not attributable to a proven auth defect. These checks remain activation verification gates and must pass before claiming Tier 1 is activated or complete.

## Remote compatibility and preservation baseline

Read-only catalog inspection confirmed the migration's existing tables and its constraint names (`goals_period_check`, `operational_dependencies_source_type_check`, `operational_dependencies_dependency_type_check`), live columns, RLS state, owner policies, foreign keys used by the RPCs, and referenced table/column types. All seven existing schema-mutated tables have RLS enabled. Existing owner policies remain in place; no policy is dropped or replaced. `log_v3_domain_event()` exists with the expected no-argument trigger signature and is revoked from Data API roles in the linked database.

The linked database had no new Tier 1 columns/table/RPCs before this audit. The goal constraint allows `quarter`, `month`, `week`; existing goal data contains only `quarter`. Dependency source/dependency constraints retain their previous vocabulary and add `risk`; their tables currently contain zero rows. No new constraint violation is possible in current remote rows. Live `founder_owner_guard()` currently has `EXECUTE` for anon/authenticated/PUBLIC; the local migration now removes those unnecessary direct grants while preserving trigger execution. That is a least-privilege improvement, not a grant expansion.

Pre-change row counts and deterministic full-row MD5 fingerprints (ordered by UUID) were captured read-only:

| Existing table | Rows | Fingerprint |
|---|---:|---|
| `decisions` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| `executive_snapshots` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| `goals` | 1 | `b2b18d61f3f07b9d69e3e150a005828f` |
| `operational_dependencies` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| `quality_incidents` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| `tasks` | 8 | `ec07c24ca36f5ceb0680a950a51b1ea1` |
| `team_delegations` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |

The empty-table hashes are MD5 of the empty string. The reusable before/after SQL at [tier1-preservation-baseline.sql](tier1-preservation-baseline.sql) excludes newly-added columns for post-migration comparison and records constraints, RLS state, policies, and indexes. Runtime workflow destinations (`operating_lessons`, `lesson_evidence_links`, `operating_risks`, `followups`, `inbox_items`, `retrospectives`) are also covered by the disposable Stage 2 fixture cleanup; no fixture was written during this stage.

## Migration dependency map

| Database object | API/repository and UI | Verification |
|---|---|---|
| `decisions.workflow`, `decisions.founder_required` | `/api/founder-workflows/[kind]/[id]`; decision workflow panel and bottleneck aggregation | decision create/edit/review, outcome/variance, lesson persistence; `tests/tier1.test.ts`, database harness |
| `tier1_propose_lesson` | decision/issue/risk/forecast/weekly review API; explicit propose-lesson action to Operating Memory | authenticated-only ACL, owner check, idempotency/evidence link, cross-user rejection |
| `quality_incidents.postmortem`, `postmortem_actions`, `tier1_postmortem_action` | issue workflow API and `/api/postmortem-actions/[id]`; structured postmortem/actions UI | JSON persistence, four action destinations, atomicity/idempotent retry and owner RLS |
| `operational_dependencies` widened checks and unique trigger | `/api/dependencies`, dependency repository and Founder OS Dependencies UI | supported endpoints, self/cross-user/duplicate rejection, blocked-by/blocks and impact |
| `founder_strategy_links`, owner trigger, target index | `/api/founder-strategy`, strategy repository/panel, briefing relations | CRUD, all target kinds, duplicate upsert, same-owner validation, RLS in both directions |
| `goals.period` widened check | strategic objective repository and annual goal creation | annual objective persist; existing period values preserved |
| `executive_snapshots.founder_facts` | Founder briefing API/server and Founder State “What Changed?” comparison | snapshot/facts persistence, meaningful-only comparison and repeat read |
| `tasks.work_classification`, `team_delegations.founder_approval_required` | generic entity APIs, founder bottleneck aggregation and team delegation UI | persist classification/approval and verify evidence-driven bottlenecks |
| `tier1_weekly_review` | `/api/founder-briefing` and executive review action | authenticated-only ACL, idempotent per-period record, owner isolation |
| replacement `log_v3_domain_event()` | existing tasks/content/invoice/milestone/decision update triggers | trigger signatures unchanged; decision update and milestone completion do not error; only intended activity events emitted |

## Authentication and browser plan

`src/proxy.ts` calls Supabase SSR `getClaims()` on workspace routes, forwards request cookies, and copies refreshed cookies to the response. Without valid claims it redirects pages to `/login` and returns 401 for API requests. `src/lib/supabase/server.ts` uses the same cookie store and `requireUser()` checks `claims.sub`. `/login` supports ordinary password and configured Google OAuth; no bypass/test impersonation path exists, and none should be added. The old `/decisions` redirect means the browser request did not have claims at that time, but it does not distinguish missing/expired cookies, wrong Supabase environment, or browser-to-server connectivity. In this audit the existing tab showed Founder State content, but navigation later failed with connection refused; the local server was stopped and its restart was isolated from the browser. So authenticated route access is not proven in this pass.

Legitimate verification path after activation: use the project’s normal password or configured Google sign-in in the existing browser with the owner’s own session; do not disclose credentials to the agent. Separately use already-authorized owner and second test-user JWTs from the project’s existing Supabase Auth test method for API/RLS tests. If there is no test-user/session method, an authorized operator must sign in/create the clearly synthetic test account and provide a supported session to the verification harness. Never turn off auth or use service-role credentials to simulate a user.

## Post-activation verification checklist

- **Founder State:** authenticated render, aggregation, attention explanations/reasons, and a meaningful “What Changed?” comparison.
- **Decision Journal:** create/edit, entity link, review, actual outcome/variance, proposed lesson and Operating Memory evidence relation.
- **Issues/Postmortems:** create/resolve, structured root cause/prevention persistence, and task/risk/follow-up/SOP actions; failed multi-write action leaves no partial records.
- **Dependencies:** choose named entities; create and render source/target (“blocks”/“blocked by”), downstream impact; reject self, foreign-owner, and duplicate edges.
- **Waiting:** waiting on others/me, overdue state, Founder State and Today integrations.
- **Bottlenecks:** evidence-backed pending founder decisions, approvals, unowned critical areas, single-owner systems, and waiting-on-founder items.
- **Strategic alignment:** project/task/decision/risk to objective (where supported), persist and render all relation types.
- **Project momentum:** healthy and stalled/blocked cases, milestone proximity and explanation.
- **Weekly review:** outcomes, changes, issues, decisions, risks, waiting, lessons, next-week priorities; persisted review is idempotent by date.
- **What Changed:** meaningful changes appear; unchanged/noisy records stay hidden; comparison cut-off behaves correctly.
- **RLS/auth matrix:** owner CRUD; second authenticated user cannot read/edit/search owner records or create prohibited cross-owner relations; anon cannot read/write private rows or execute private RPCs. Verify function ACLs for `authenticated`, `anon`, and PUBLIC grantee OID 0 in `pg_proc` after migration.
- **Preservation/cleanup:** compare original-column counts and hashes with the baseline; remove unique synthetic fixtures and confirm zero remain.

## Validation performed and residual risk

- All 792 app tests pass.
- ESLint and TypeScript pass.
- Production build compiles and generates all 325 pages.
- `scripts/check-founder-database.mjs` applied every repository migration in isolated PGlite and passed the two-user owner isolation, decision workflow, postmortem, four idempotent actions, strategic cross-domain relation, annual goal, weekly review, snapshot facts, task classification, anonymous denial, and explicit role/PUBLIC ACL matrix checks.
- Linked Supabase checks were SELECT-only. No remote migration, test record, deployment, or auth setting was changed.

Residual deployment risks are the not-yet-run remote transaction against production locks, live two-user/anon tests, browser route and full UI workflow checks, and post-application original-column hash comparison. The shared event trigger body also changes; its behavior needs the Stage 2 regression test. Run those checks in the separately authorized activation stage before treating Tier 1 as production-verified.

READY FOR REMOTE MIGRATION

# Remote migration and live verification — 23 September 2026

## Applied migrations

1. `20260922220000_task_recurrence_and_goals.sql`
2. `20260923010000_founder_state_operating_layer.sql`
3. `20260923020000_founder_rpc_permissions.sql` — corrective hardening discovered during live permission checks.

The remote migration ledger confirms all three versions. The final linked-database dry run returned `upToDate: true` with no pending migrations. The first two were explicitly approved by the user. The third only removes unintended anonymous execution privileges on the two new RPCs; it does not change data or RLS policies.

## Production-safety checks

Before applying, the migrations were reviewed for destructive statements, schema compatibility, constraint changes, RLS and function security. No tables or columns are dropped, no data is truncated/reset, and no existing RLS policies are removed or weakened. Four check constraints are replaced with supersets of their previously allowed values. New fields are additive. Every local migration and the full fixture workflow were rehearsed in isolated PostgreSQL/PGlite.

Live preflight checked existing constraints, values, table sizes and policies. Row counts and hashes of original column values were recorded for all 15 existing tables altered by the migrations. Immediately after application, every count and fingerprint matched. All 11 new tables have RLS enabled, inspected existing policies are identical to preflight, and there are no invalid public-schema indexes. Both application RPCs use invoker security and now allow authenticated execution while denying anonymous execution.

## Live tests

Two uniquely identified synthetic users and a small set of owned records were committed solely for this verification. SQL operations explicitly switched to PostgreSQL's `authenticated` role with separate JWT subject claims; assertions confirmed the effective role and user. The tests did not use an elevated role to bypass RLS for the owner/peer operations.

Passed:

- Recurring task create/read with `daily`, progress 2/8 and daily target 1; update to `weekly` and progress 3; independent-connection read-back of both committed stages.
- Persisted company → project → task → corrective issue → risk relationships, plus a task-to-issue blocking dependency.
- Ownership immutability, foreign-owner references, self-dependency rejection, cross-user read/update/insert denial, and access-record isolation.
- Audit event creation, atomic capture conversion, failed-conversion rollback, duplicate-conversion rejection, and retained capture destination.
- Idempotent proposed lessons and evidence after issue resolution; lesson persistence across connections.
- Personal valuation history and cross-user isolation.
- Manual KPI observation retrieval, owner-scoped search, and no cross-user RPC results.
- Transactional KPI aggregation: MAD 190 current period versus MAD 80 previous period; USD 900 excluded from MAD totals and refunded MAD 999 excluded. Manual overrides rejected. These supplemental records were rolled back.
- Anonymous table access disclosed no fixture data; anonymous Founder RPC invocation was denied.
- Unauthenticated application request to `/api/founder-state`: HTTP 401. The user's existing authenticated browser session loaded Founder State with complete source coverage and the review action enabled. Separate password-login flows were not tested for synthetic users.

The cleanup transaction removed the synthetic users and their records, lessons, evidence, audit entries and valuation history. The final preservation query passed: all original 15-table counts and fingerprints still match, and zero fixture users, audit records or valuation-history records remain.

## Issues found and resolved

- **Supabase default function privileges:** `REVOKE ... FROM PUBLIC` did not remove an explicit default grant to `anon`. RLS still prevented anonymous data exposure. The corrective migration explicitly revokes `anon` execution on `founder_kpi_values(date)` and `search_founder_records(text,integer)`. Live catalog checks and anonymous-role execution tests pass. The isolated harness now reproduces these default grants to prevent regression.
- **Existing Financial Control query:** `inventory_snapshots` has `captured_at`, not `created_at`. The shared loader's sort was corrected, and a regression test added. The rebuilt local application now includes Financial Control in complete Founder State coverage. No hosting deployment was performed.
- **CLI metadata cache warning:** both pushes completed, but Docker was unavailable for optional local catalog caching. Remote ledger and SQL checks independently verified success.
- **Transient CLI temporary-role authentication error:** one read-only check failed to connect using the CLI's temporary login role. A fresh sequential retry passed. This was not an application-user authentication failure and did not roll back the completed migrations.

## Local validation

- 778 tests passed; none failed or skipped.
- ESLint passed without warnings.
- Production build and its TypeScript check passed, generating 320 pages.
- Isolated migration/RLS/integrity suite passed including Supabase-style anonymous default function grants.
- `git diff --check` passed.

Reusable fixture generator: `scripts/prepare-founder-live-verification.mjs`. It only generates SQL and unique test IDs; running generated files against a remote project requires explicit authorization. Local migration verifier: `scripts/check-founder-database.mjs`.

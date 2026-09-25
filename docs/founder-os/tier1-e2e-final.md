# Tier 1 — Controlled Remote E2E Final Verification

Verification completed: 2026-09-23T23:49:18.981Z (UTC). This report supersedes the earlier credential-blocked result.

## Outcome

**Desktop E2E: 100% (7/7). Mobile E2E: 100% (8/8: iPhone 4/4, Android 4/4). Final Tier 1: 100% of the requested acceptance scope.** All mandatory core workflows and propagation checks passed. These percentages describe completion of this acceptance matrix, not exhaustive coverage of every application feature.

The existing harness was retained. Final acceptance ran against the locally served production build on port 3100, with Chromium desktop, iPhone 13 and Pixel 7 device emulation. This was not a deployment. Each device run used a fresh temporary normal Supabase user.

## Safety preflight and authentication

- Explicit `E2E_TARGET=remote-test`, `E2E_REMOTE_ALLOW=1`, and runner `NODE_ENV=test` passed.
- Expected, linked and allowlisted project matched: `sqzkqzrvxkdbcdpwcywd`; the URL matched exactly.
- Distinct public/server credentials passed role/project validation. CLI authentication and the read-only cleanup-access preflight succeeded through the host credential store outside the restricted shell.
- Credentials were obtained in process memory without printing or persisting their values. Privileged API calls were limited to E2E Auth provisioning/cleanup. SQL access was limited to inventory and owner-scoped cleanup.
- The browser signed in through the ordinary login form as the temporary normal user. The Next child received blank privileged credentials and management token.
- No middleware bypass, RLS disabling, production backdoor, migration, hosting deployment, or real-user mutation was performed. Remote mode remains explicit, opt-in and fail-closed; six safety-guard tests pass.

## Executed workflow matrix

Every row passed on desktop and both emulated mobile devices.

| Workflow | Executed evidence |
|---|---|
| Founder State | Fixture-rich signals, reasons and source navigation; decision, issue, waiting and risk propagation. |
| Today | Authenticated brief, bounded attention, decision/waiting propagation and viewport fit. |
| Decision Journal / Review | Create, edit rationale, selected option, expected/actual metric, variance, review, lesson proposal and refresh persistence. |
| Issues / Postmortems | Critical issue → resolution → structured postmortem → preventive task → follow-up review → lesson; refreshed cause persists. |
| Waiting on Others | Overdue/blocking request, expected date and date-picker select/clear/reselect/save; source appears in waiting/state/today. |
| Waiting on Me | Owed-by-me commitment create/edit/save/refresh and overdue perspective. |
| Dependencies | Named endpoints, blocked risk→issue edge, upstream/downstream rendering, removal and self-link rejection. |
| Risk Register | Create and edit probability/impact to 5/5; escalation appears in Founder State, Executive Console and Weekly Review. |
| Unified Capture | Task, decision and waiting destinations; issue/risk inbox conversion and processed-source verification. |
| Founder Bottleneck | Ownerless high-impact issue, evidence-based explanation, source link and weekly-review propagation. |
| What Changed | Reviewed baseline and actual issue `open → resolved`, decision `review_due → validated`, and risk probability/impact transitions; no timestamp noise. |
| Weekly Review | All evidence categories rendered; reflection generated and saved reflection opened. |
| Executive Console | Fixture-rich aggregate state, bottlenecks, risks, waiting and decisions; usable at both mobile widths. |

The historical snapshot was first saved through the UI, then backdated only within the normal synthetic user's own records to exercise the comparison window. The test asserts that exactly one intended baseline was changed. All other core workflow mutations were made through the browser UI.

## Defects fixed and test corrections

1. **Decision creation:** an empty optional decision date was written as SQL NULL into a non-null column. Omitting a null date now preserves the database default on creation and the existing date on edit. A regression test covers both and an explicit-date update.
2. **Date picker:** the clear button was nested inside the trigger button, producing invalid HTML and a hydration warning. They are now sibling controls. Live select/clear/reselect/save checks pass on desktop and mobile.

Other failed exploratory runs were test problems: stale headings, ambiguous labels, populated textarea/dropdown selectors, asynchronous capture prefill, and a fixture timezone mismatch. Assertions were corrected to target the actual accessible controls and await real readiness. Development compilation under local resource pressure caused navigation timeouts; the same harness now offers an opt-in prebuilt local-server mode. Final acceptance used that mode. No Tier 2 feature or schema change was added.

## Console, network and security results

Final production-build acceptance reported **zero unexpected browser console/page errors or failed application API responses** in the monitored flows. Deliberate self-dependency and access-denial checks produced expected 400/401/403/404 responses. Earlier development runs emitted unused-font preload, Fast Refresh and NO_COLOR notices; those were environment warnings, and the actual date-picker hydration warning was fixed.

Before and after desktop workflows, normal test user A could not read or alter user B's project; a foreign-owner link was rejected; user B's record remained unchanged. Anonymous table/RPC reads were denied and the unauthenticated application API returned 401. The foreign application record endpoint returned 403/404. Each peer identity was immediately removed and its absence verified.

Loaded browser scripts, HTML and request data contained no privileged key. A separate scan of **498 built client files found 0 privileged-key matches**. Application auth has no E2E bypass. Production/deployment environment refusal and all remote-target guards remain tested.

## Cleanup

Every run reserved its unique run UUID and Auth ID before provisioning. Owner-scoped inventories recorded created records, including trigger-created activity and lesson evidence. Failed exploratory runs also completed cleanup before another run began.

Final independent read-only census: **22 recorded identities checked across 239 table checks; zero remaining synthetic records, zero temporary Auth users, and no private session registry.** It also checked for any Auth identity carrying the remote Tier 1 marker. No remaining IDs exist to report.

The exact retained run/identity/resource inventories and census are in [tier1-e2e-evidence.json](./tier1-e2e-evidence.json). Final passing runs:

| Run | Run identifier | Temporary user | Result |
|---|---|---|---|
| Desktop | c2e524d6-04a3-483b-9d04-24a7a987e68e | cabacf50-42e4-460a-a38a-737a04799793 | 7/7; cleanup zero |
| iPhone | 971f4126-1aaa-4389-b253-5e7f6d2dd9da | 327cecac-0eef-4aa8-b967-cb615cd004eb | 4/4; cleanup zero |
| Android | 801ff038-d8d9-4414-b5d5-2ad22ac60803 | 3319a1a3-0a0d-474e-adac-1fd91839131d | 4/4; cleanup zero |

## Validation

| Check | Final result |
|---|---|
| Unit/integration suite | 800 passed; 0 failed, 0 skipped |
| Authenticated desktop E2E | 7 passed |
| Authenticated mobile E2E | 8 passed across both device profiles |
| ESLint | PASS |
| TypeScript | PASS |
| Isolated DB/RLS harness | PASS: persistence, atomicity, cross-domain links, two-user isolation and RPC ACL matrix |
| Production build | PASS; 325 pages generated |
| Built client credential scan | PASS; 498 files, 0 matches |
| Final remote cleanup census | PASS; 0 records/users remain |
| `git diff --check` | PASS |

The isolated harness applied migrations only inside disposable PGlite. No migration was applied to the remote project. Prior activation/preservation evidence remains in [tier1-live-verification.md](./tier1-live-verification.md).

READY TO BEGIN TIER 2

# Tier 1 E2E Infrastructure

## Isolation model

- Browser runner: Playwright Test with Chromium. Desktop runs at a standard desktop size; mobile projects emulate iPhone 13 and Pixel 7 viewport/touch profiles in Chromium.
- Default backend: the repository's Supabase local stack. The harness reads credentials from `supabase status -o env` internally and requires the Auth API on loopback port 54321 plus PostgreSQL on loopback port 54322. It never automatically falls back to a remote backend. Explicit controlled remote mode is documented below.
- Authentication: setup creates one uniquely named normal Auth user (`tier1-e2e-<uuid>@example.com`) using the local Supabase admin API. It signs in through the application's real email/password form, and saves a short-lived Playwright storage state under the ignored `.playwright-auth/` directory. RLS sees the usual authenticated JWT subject; the service key never enters browser storage or the Next.js server environment.
- Cleanup: after the suite, a local-only SQL helper deletes public rows by the E2E user's exact `user_id`, retrying child-first through FK violations. It verifies no owned row remains, deletes the marked Auth identity, verifies the unique user is absent, and removes session files. The unique user ID, email, and `e2e_run_id` metadata must all match before cleanup can remove rows. If cleanup is interrupted, `pnpm run test:e2e:cleanup` retries from the private metadata file.
- Production guard: the run wrapper explicitly sets `FOUNDER_E2E_LOCAL=1` and `NODE_ENV=test`; config refuses any other invocation. The target URL guard accepts only `localhost`/`127.0.0.1`/`::1` on port 54321. Both server-only admin credentials are blanked for the Next dev server and are never included in browser configuration.

The local Supabase stack is configured in this repository, but this machine currently has neither Docker nor Podman. Local mode fails closed here. Explicitly authorized remote-test mode works without Docker/Podman and does not apply migrations.

## Local setup and commands

Install and start Docker Desktop or Podman, then from the repository root:

```sh
supabase start
supabase db push --local
pnpm run test:e2e
pnpm run test:e2e:tier1
pnpm run test:e2e:mobile
```

`supabase db push --local` applies only pending local migrations and does not run `seed.sql`. Do not use `supabase db reset` on a local development database containing valuable data. The checked-in `seed.sql` creates demo examples and is deliberately not part of the E2E path.

The test runner starts Next at `http://127.0.0.1:3100` with public Supabase variables overridden to the local stack. The browser receives only the public key and a normal user session. Privileged keys are reserved for provisioning/cleanup outside Next. Playwright traces, screenshots, auth state, and HTML reports are ignored by Git.

## Coverage included

- Desktop route smoke checks cover Founder State, Today, Decisions, Issues, Waiting, Dependencies, Risks, Weekly Review, Executive Console, and What Changed. Unexpected page errors, console errors, or failed API responses fail the smoke test.
- A desktop mutation test creates a uniquely tagged decision, adds a selected option, records and persists its review, proposes an Operating Memory lesson, and checks values after refresh.
- A second desktop test creates a critical issue, completes a structured postmortem, proposes a lesson, creates a preventive task, and confirms the saved cause after refresh.
- Mobile device-profile tests visit the core Tier 1 surfaces, assert the document fits each emulated viewport, and create/refresh a uniquely tagged waiting-on-me commitment on both the iPhone-sized and Android-sized Chromium profiles.
- Unit tests exercise local URL rejection and CLI environment parsing without shell evaluation.

## Local-mode limitation

Local mode needs a container runtime. Controlled remote mode is an independent, explicitly authorized path; it preserves the target and credential guards. Current execution results are in [tier1-e2e-final.md](./tier1-e2e-final.md).

## Controlled remote mode (2026-09-23)

The runner now accepts `E2E_TARGET=local` (default) or explicit `E2E_TARGET=remote-test`. It never falls back from local to remote. Remote provisioning requires all of:

- `E2E_REMOTE_ALLOW=1` — explicit per-run safety switch.
- `E2E_REMOTE_PROJECT_ID` — allowlisted project, identical to `supabase/.temp/project-ref`.
- `E2E_REMOTE_URL` — exactly `https://<allowlisted-project>.supabase.co`.
- `E2E_REMOTE_PUBLIC_KEY` — public publishable/anon key.
- `E2E_REMOTE_SERVICE_KEY` — server-only secret/service-role key, supplied securely to the runner environment.
- Authenticated Supabase CLI (`supabase login` or `SUPABASE_ACCESS_TOKEN`) for owner-scoped inventory/cleanup through `supabase db query`. No migration command is used.

The runner sets `NODE_ENV=test`. Inherited Supabase URLs must agree with the target; deployment markers are refused. JWT credentials are checked for role/project, and modern keys must have the appropriate public/secret prefix. These format checks do not replace server credential verification. Credentials are never documented or printed. `.env.local` is not automatically loaded by the E2E runner; provide the variables explicitly through a secure environment loader.

With those variables supplied, run `pnpm run test:e2e:tier1` for all three projects, or `pnpm run test:e2e:mobile` for the two mobile projects. Use the same target variables with `pnpm run test:e2e:cleanup` after an interrupted run. Missing admin credentials fail before app startup; missing CLI access fails the read-only cleanup preflight before app startup.

A generated UUID, synthetic email and project are reserved using exclusive file creation in `.playwright-auth/user-meta.json` **before** Auth provisioning. Existing registries block replacement. The Auth account is preconfirmed using Admin Auth with a runtime-generated password, then signs in through the ordinary login form. No email is sent. The normal browser session has no admin privileges. Browser fixture titles use `TIER1_E2E_<run UUID>`. The private `resources.jsonl` registry records owner-scoped table/resource IDs after provisioning, each test, and before cleanup, including trigger-created rows. If a process is interrupted, cleanup inventories the owner again rather than depending exclusively on the last snapshot.

Cleanup validates the exact Auth ID, email, run marker and scope before deleting owned rows, verifies zero owned rows, deletes the Auth user, verifies that exact user ID is absent, and removes private auth artifacts. Failed cleanup retains the registry. The runner retries cleanup if Playwright exits with a pending identity. Corrupt registry JSON fails rather than being treated as absent. SQL metadata calls are restricted to inventories and cleanup, not product mutation tests.

Admin/service credentials and the management token are blanked in the Next child environment. Playwright traces are disabled because traces may retain session credentials; password entry occurs outside the test recorder. Screenshots/videos can contain synthetic test data. Do not publish private auth files.

**Credential resolution:** Supabase CLI authentication is available through the host credential store outside the restricted shell sandbox. The authorized runner retrieves public/server keys into process memory, validates their roles and project, and does not print or persist them. The linked/allowlisted project is `sqzkqzrvxkdbcdpwcywd`.

The existing harness now exercises full cross-domain decision, issue/postmortem, waiting, risk, dependency, capture, bottleneck, change-comparison and weekly-review workflows on desktop and both device profiles. Live A/B/anonymous tests provision a second marked normal user and clean it immediately. Every fixture mutation is followed by an owner inventory; the single read-only inventory query includes trigger-created records. Historical comparison fixtures are dated back using the normal test user's session.

Teardown writes `test-results/cleanup.json` with the exact synthetic identity, resource inventory, observations and verified zero remaining owned rows/Auth users before removing private session files. Preserve this evidence before starting another run because Playwright resets its result directory. Run mobile projects separately when a fresh fixture universe is needed for compact, bounded attention surfaces. See the final report for executed results; authored coverage alone is not acceptance evidence.

### Verify a prebuilt local app

The same Playwright harness can use `E2E_SERVER_MODE=production` after `pnpm run build`. This selects `next start` on the same local port instead of `next dev`; provisioning, target guards, normal-user login, browser profiles, assertions and cleanup are unchanged. Build with the matching public Supabase project configuration first. This is a local production-build test, not a hosting deployment. The parent E2E runner still uses `NODE_ENV=test`; the isolated Next child uses production mode with privileged credentials blanked. This avoids cold development compilation delays on the verification machine.

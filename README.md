# Daily Command Center

A private, mobile-first personal operating system built with Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Supabase, and the OpenAI Responses API.

The current build includes the editorial Today brief, responsive desktop/mobile shell, tasks and capture interactions, command palette, focus timer, reusable project/domain workspaces, project detail, dark/light themes, PWA manifest, Supabase SSR authentication, normalized PostgreSQL schema with Row Level Security, unified-search RPC, encrypted integration-token storage, Google OAuth foundation, a server-only AI endpoint, and development tests.

## Architecture

- `src/app/(workspace)`: authenticated product routes and responsive shell
- `src/features`: feature-owned UI for Today, domain collections, and Focus
- `src/components`: canonical interaction primitives and navigation
- `src/lib/supabase`: cookie-based Supabase clients; authenticated identity is resolved server-side
- `src/app/api`: validated task/search/assistant and OAuth boundaries
- `supabase/migrations`: normalized schema, indexes, triggers, RLS, storage policies, and search
- `DESIGN.md` / `UX-CONTRACT.md`: durable visual and behavioral contracts

Production data lives in Supabase. Example records exist only in `supabase/seed.sql` and are loaded solely when a developer explicitly runs that file against a development project.

## Local setup

Requirements: Node.js 20.9+ and a Supabase project.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. A configured Supabase project and authenticated user are required; there is no implicit demo-data fallback in production code.

## Supabase setup

1. Create a Supabase project and copy its URL and publishable key into `.env.local`.
2. Apply every file in `supabase/migrations` in filename order. The migrations are additive; the V2 migration backfills legacy invoice, content, and fitness fields without removing V1 columns.
3. Enable email/password and Google under Authentication → Providers.
4. Add `http://localhost:3000/auth/callback` and your production `/auth/callback` URL to Authentication → URL Configuration.
5. Create a development auth user, replace the placeholder UUID in `supabase/seed.sql`, and run it if demo rows are wanted in the database.

Every user-owned table has RLS. Application inserts receive `user_id` from the verified cookie session—not browser arguments. The secret/service key is server-only and is not required for normal user CRUD.

## Google OAuth and sync foundation

Create an OAuth web client in Google Cloud and enable Calendar, Gmail, and Drive APIs. Add the exact `GOOGLE_REDIRECT_URI` to Authorized redirect URIs. The connect endpoint uses a short-lived HTTP-only state cookie, requests offline access, and validates state before token exchange.

Tokens are encrypted with AES-256-GCM before entering Supabase. Generate the key once:

```bash
openssl rand -base64 32
```

Store the output as `INTEGRATION_ENCRYPTION_KEY`. Do not rotate it without a token re-encryption migration. The schema includes external IDs, provider timestamps, sync hashes, sync tokens, webhook channel IDs, cancellation state, and timezone fields needed for idempotent two-way Calendar sync. Gmail, Drive, GitHub, and Strava have normalized connection/reference storage and settings surfaces; their provider-specific OAuth and sync workers remain credential-dependent integration work.

Gmail uses metadata-only scope and Drive uses `drive.file`; the application should store references rather than mailbox/file contents. GitHub and Strava cards remain deliberately disabled until their provider endpoints are configured.

## OpenAI

Add `OPENAI_API_KEY`. Requests go only through `/api/assistant`; the key never reaches the client. The server checks the Supabase session before calling the Responses API. Record-changing assistant tools should be added as typed server functions that derive `user_id` from the session and require explicit confirmation for bulk, destructive, email, and calendar-delete operations.

## Environment variables

See `.env.example`. Variables beginning with `NEXT_PUBLIC_` are browser-visible. `SUPABASE_SECRET_KEY`, OAuth secrets, OpenAI key, and the integration encryption key must remain server-only.

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The UI targets WCAG 2.2 AA, supports reduced motion and forced colors, uses visible global scrollbars, and has deliberate layouts for phone, tablet, and desktop widths.

## Vercel deployment

1. Push the repository to GitHub and import it into Vercel.
2. Add every production value from `.env.example`; set `NEXT_PUBLIC_APP_URL=https://<project>.vercel.app` and `NEXT_PUBLIC_DEMO_MODE=false`.
3. Add the Vercel callback URLs to Supabase Auth and Google OAuth.
4. Deploy. Vercel runs `next build` automatically.
5. Run a production smoke test: sign in, create and complete a task, capture an inbox item, open command search, start Focus, and initiate Google OAuth.

A custom domain can replace `NEXT_PUBLIC_APP_URL` later; update Supabase and OAuth callback allowlists at the same time.

## V4 integrations

The V4 provider layer keeps OAuth tokens encrypted on the server and uses connection-specific, owner-scoped records. Google Calendar retains its manual sync fallback; Gmail stores thread metadata/snippets rather than mailbox bodies, Drive stores file references, GitHub stores project context, and Strava imports activities by immutable external ID. Provider requests run only from server routes and provider adapters—never from browser UI code.

Set the callback URLs shown in `.env.example` in each provider console. Gmail uses `gmail.metadata` by default (no sending permission). Drive uses metadata-only access. GitHub requests repository-status/public-repository context, and Strava requests activity read access. `INTEGRATION_ENCRYPTION_KEY` must be a base64-encoded 32-byte value and must remain server-only.

V4 background work is deliberately represented by safe automation records and run logs. Deploy a scheduled authenticated worker before enabling recurring provider sync. Until then, each connected integration exposes **Sync now** as the supported fallback. Sending email, recording payment, rescheduling calendar events, and changing automation rules enter the approval queue; they are never executed directly by assistant drafts.

## Current integration boundary

Credentials are intentionally absent from the repository. To activate the real services, provide: Supabase project URL/publishable key, OpenAI API key, Google client ID/secret, a 32-byte base64 encryption key, and—when those integrations are implemented—GitHub and Strava client credentials.

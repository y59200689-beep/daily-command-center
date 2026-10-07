# Weekly radiology digital-growth briefings

POST https://daily-command-center-pink.vercel.app/api/integrations/radiology-growth/reports

Authentication: `Authorization: Bearer <private integration token>`.
Configure `RADIOLOGY_REPORTS_INTEGRATION_SECRET` (32+ random characters) as a sensitive Vercel Production variable. Configure `RADIOLOGY_REPORTS_USER_ID` to the destination Supabase Auth user UUID. Both are server-only. Redeploy after configuration changes. Never use NEXT_PUBLIC_, embed the token in a browser, or commit it. A sender must store the same token in its protected server or authenticated ChatGPT Action configuration; a normal ChatGPT conversation cannot submit automatically without a configured action/tool.

The deployed setup has a private local copy in ignored `.env.local`. Copy it directly into your sender's secure authentication setting; do not paste it into chat. To rotate, generate a replacement privately, update both Vercel and the sender, and redeploy. The endpoint does not accept user IDs supplied by callers.

```json
{
  "externalId": "radiology-growth-2026-10-01-2026-10-07",
  "title": "Weekly radiology digital-growth briefing",
  "periodStart": "2026-10-01",
  "periodEnd": "2026-10-07",
  "contentMarkdown": "# Weekly briefing\n\n## Key developments\n- **Finding** with a [source](https://www.rsna.org/).\n\n## Recommended actions\n1. Review your demo conversion funnel.",
  "sources": [{ "title": "RSNA", "url": "https://www.rsna.org/", "publishedAt": null }]
}
```

Required: externalId (1–200 chars), title (1–240), periodStart/periodEnd (YYYY-MM-DD; end >= start), contentMarkdown (nonblank, max 200,000 chars; preserved as supplied). Optional sources defaults to []; max 100 entries. Each source requires title and HTTP(S) URL without credentials; publishedAt is optional/null or an ISO date/date-time. Unknown properties are rejected. Total request body is capped at 1 MB.

New report: HTTP 201 `{ "success": true, "created": true, "reportId": "<UUID>" }`.
Retry: HTTP 200 `{ "success": true, "created": false, "duplicate": true, "reportId": "<same UUID>" }`.
Invalid input 400; missing/invalid authorization 401; configuration or DB failure 500. Retry failures using the same externalId; to submit a different week's report, use a new ID. Existing submissions are not overwritten. The database enforces unique (user_id, integration_source, external_id), including concurrent retries.

Reports appear in `/executive/reports` under Weekly Briefing and open at `/executive/reports/<reportId>`. The page renders Markdown (including GFM tables/lists), ignores raw HTML, sanitizes Markdown links, and displays source publication dates, reporting period and receipt date. Existing report ownership policies remain unchanged.

With the token already loaded privately into your shell and payload saved in `briefing.json`:

```sh
curl --fail-with-body -X POST \
  'https://daily-command-center-pink.vercel.app/api/integrations/radiology-growth/reports' \
  -H "Authorization: Bearer ${RADIOLOGY_REPORTS_INTEGRATION_SECRET}" \
  -H 'Content-Type: application/json' \
  --data-binary @briefing.json
```

Do not use curl -v or shell tracing for authenticated requests. A ChatGPT Action should define this exact POST URL and JSON schema and configure Bearer authentication through its private authentication UI; enter the token there, not in the OpenAPI document or conversation.

## Independent Monday workflow

Vercel Cron calls `/api/cron/radiology-growth?slot=7`, `?slot=8`, and `?slot=9` at 07:00, 08:00 and 09:00 UTC Mondays. The handler uses IANA `Africa/Casablanca` time, refuses scheduled work before 08:00 local or outside Monday morning, and returns immediately if that week's report already exists. The first eligible trigger runs around 08:00 local, including Morocco's seasonal UTC offset. Vercel execution precision depends on plan (Hobby can invoke within the scheduled hour). Separate later triggers provide safe retries; Vercel does not automatically retry failed cron invocations.

The existing `CRON_SECRET` authenticates scheduled GET requests. Manual POST recovery uses the existing private `RADIOLOGY_REPORTS_INTEGRATION_SECRET`, not cookies. Neither secret is exposed in browser code. No caller can set the owner or week. `OPENAI_API_KEY` must have paid OpenAI API access/balance and access to a web-search-capable Responses model. `RADIOLOGY_REPORTS_MODEL` optionally overrides the default `gpt-5-mini`. This is independent of ChatGPT Tasks and ChatGPT subscription billing. No separate search provider credential is required.

Research covers the exact previous Monday–Sunday, in French/Arabic/English sources, distinguishing Moroccan rollout evidence from global announcements, verified publication dates from event dates and undated baseline context. Quiet weeks explicitly report no meaningful verified change. A web search call must complete, and output source URLs must occur in the provider's retrieved/cited evidence before the briefing is saved. Two or three prioritized actions must explain relevance to the radiology center and Clinahir.

Jobs use `radiology-growth-YYYY-MM-DD` (Monday's Casablanca date). Server-only `radiology_report_jobs` stores a 10-minute lease, at most three attempts, a 30-minute retry cooldown, cached validated research drafts, report ID and safe error codes. Cached drafts avoid repeat AI charges when report persistence fails. Hard-crashed leases expire before the next hourly retry. Exhaustion returns an error and requires operator investigation; jobs never loop indefinitely. Logs contain week ID, attempt, report ID and error category only. Existing Reports ownership and duplicate constraints remain in force.

On-demand POST runs the current week's briefing early if needed and consumes that week's ID, so Monday cron won't duplicate it. Run with the existing private report token, never curl -v or shell tracing. Inspect failures in Vercel Runtime Logs (`[radiology-weekly]`) and the job row's status/last_error_code. Correct credentials/billing or upstream problems before operator-authorized rearming of an exhausted job.

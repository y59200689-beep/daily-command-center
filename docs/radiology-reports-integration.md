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

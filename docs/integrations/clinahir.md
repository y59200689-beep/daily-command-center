# Clinahir lead delivery

Clinahir (formerly Kelo) sends leads to `POST https://<daily-command-domain>/api/integrations/clinahir/leads` from its server, after saving the form submission. Never send the bearer secret from browser code.

## Daily Command configuration

Apply `supabase/migrations/20261003085714_clinahir_leads_integration.sql` using your normal Supabase migration deployment process. Existing leads and owner-scoped RLS remain in place.

Configure these private environment variables in local development and Vercel, then redeploy:

- `CLINAHIR_INTEGRATION_SECRET`: a cryptographically random secret of at least 32 characters (for example generate with `openssl rand -hex 32`).
- `CLINAHIR_LEADS_USER_ID`: the Supabase Authentication user UUID of the Daily Command account receiving these leads. Do not use an email or guess the first user.
- `SUPABASE_SECRET_KEY`: the existing server-only Supabase secret key.
- `NEXT_PUBLIC_SUPABASE_URL`: the existing destination Supabase project URL.

The endpoint fails closed when its configuration is missing. It bypasses cookie login only for this exact path and requires its own bearer authentication before any database access.

## Clinahir configuration and payload

Clinahir needs the endpoint URL and the shared integration secret. Keep the secret in its private server environment. It does **not** need a Daily Command Supabase key or user ID.

Send `Authorization: Bearer <shared-secret>` and `Content-Type: application/json`:

```json
{
  "externalId": "cli_01ABC123",
  "companyName": "Centre Radiologie Atlas",
  "contactName": "Dr. Ahmed",
  "email": "contact@centre.ma",
  "phone": "0612345678",
  "city": "Casablanca",
  "message": "Je souhaite une démonstration",
  "formType": "demo",
  "landingPage": "/",
  "utmSource": "google",
  "utmMedium": "cpc",
  "utmCampaign": "radiology_morocco",
  "submittedAt": "2026-10-03T09:00:00Z"
}
```

Required: a stable `externalId` (1–200 characters) plus at least one of companyName, contactName, email or phone. All remaining fields are optional; empty strings and null optional values are omitted. Email must be valid and submittedAt must be an ISO timestamp with a timezone. Requests are limited to 32 KiB. Unknown fields are ignored; the sender cannot choose an owner or override source/status.

The contact name becomes the lead name, with company/email/phone fallbacks. Source is `clinahir`, source detail is `website`, status is the existing `new`, and currency is USD. UTM, landing page, form type and submission time are preserved in `metadata`. The database creation timestamp records receipt time. Phone whitespace is normalized without guessing country codes.

New delivery returns HTTP 201:
```json
{"success":true,"created":true,"leadId":"<uuid>"}
```
A retry returns HTTP 200:
```json
{"success":true,"created":false,"duplicate":true,"leadId":"<same-uuid>"}
```

The unique index on `(user_id, source, external_id)` prevents simultaneous duplicate inserts and includes archived records. A trigger protects imported source/external identity from edits; ordinary pipeline/status updates still work. Repeated payloads do not overwrite existing lead edits. Keep the same ID for retries; generate it once when Clinahir saves the submission, not once per delivery attempt.

HTTP 400 means correct the payload; 401 means correct the secret. Retry network failures and HTTP 500 with the same externalId and exponential backoff. Leads appear for the configured account in `/leads`, including the existing Clinahir source checklist filter. No separate lead table or competing pipeline was introduced.

## Verification after deployment

Send one test submission from the Clinahir server, sign into the configured Daily Command account, open `/leads`, and select source Clinahir. Send the identical submission again and confirm the same leadId and `created:false`. Archive the test through normal UI when finished. Do not publish real secrets in commands, screenshots or logs.

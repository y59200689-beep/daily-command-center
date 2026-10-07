-- Extend the existing owner-scoped Reports table; no parallel report system.
alter table public.executive_reports
  add column if not exists integration_source text,
  add column if not exists external_id text;
create unique index if not exists executive_reports_integration_external_unique
  on public.executive_reports (user_id, integration_source, external_id)
  where integration_source is not null and external_id is not null;
-- Existing owner RLS and report-type constraints remain unchanged.

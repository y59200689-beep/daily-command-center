create table public.radiology_report_jobs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 external_id text not null,
 status text not null default 'pending' check (status in ('pending','running','failed','completed')),
 attempts integer not null default 0 check (attempts between 0 and 3),
 lease_token uuid,
 lease_until timestamptz,
 next_attempt_at timestamptz,
 draft jsonb,
 report_id uuid references public.executive_reports(id),
 last_error_code text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (user_id, external_id)
);
alter table public.radiology_report_jobs enable row level security;
revoke all on public.radiology_report_jobs from anon, authenticated;
grant all on public.radiology_report_jobs to service_role;

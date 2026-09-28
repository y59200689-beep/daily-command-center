-- Per-user mission planning and actual daily execution. Additive and owner-scoped.
create table if not exists public.revenue_mission_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  start_date date,
  duration_days integer not null default 30 check (duration_days between 1 and 365),
  pace_goals jsonb not null default '{}'::jsonb check (jsonb_typeof(pace_goals) = 'object'),
  daily_actions jsonb not null default '[]'::jsonb check (jsonb_typeof(daily_actions) = 'array'),
  updated_at timestamptz not null default now()
);
alter table public.revenue_mission_settings enable row level security;
create policy revenue_mission_settings_owner_select on public.revenue_mission_settings for select to authenticated using ((select auth.uid()) = user_id);
create policy revenue_mission_settings_owner_insert on public.revenue_mission_settings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy revenue_mission_settings_owner_update on public.revenue_mission_settings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update on public.revenue_mission_settings to authenticated;

create table if not exists public.revenue_mission_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  action_id text not null check (length(action_id) between 1 and 80),
  quantity integer not null default 0 check (quantity between 0 and 100000),
  status text not null default 'not_started' check (status in ('not_started','in_progress','completed','blocked')),
  note text not null default '' check (length(note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, log_date, action_id)
);
create index revenue_mission_logs_owner_date on public.revenue_mission_logs(user_id, log_date desc);
alter table public.revenue_mission_logs enable row level security;
create policy revenue_mission_logs_owner_select on public.revenue_mission_logs for select to authenticated using ((select auth.uid()) = user_id);
create policy revenue_mission_logs_owner_insert on public.revenue_mission_logs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy revenue_mission_logs_owner_update on public.revenue_mission_logs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update on public.revenue_mission_logs to authenticated;

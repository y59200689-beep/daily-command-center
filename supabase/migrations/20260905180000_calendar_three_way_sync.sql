-- Per-event sync baselines are deliberately separate from calendar_sync_state,
-- which tracks the incremental cursor for an entire Google calendar.
create table if not exists calendar_event_sync_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  calendar_event_id uuid not null references calendar_events(id) on delete cascade,
  integration_id uuid not null references integrations(id) on delete cascade,
  provider text not null default 'google' check (provider = 'google'),
  provider_event_id text not null,
  last_synced_etag text,
  last_synced_provider_updated_at timestamptz,
  last_synced_local_updated_at timestamptz,
  base_snapshot jsonb,
  remote_snapshot jsonb,
  conflict_type text check (conflict_type in ('sync_conflict','external_deleted','manual_review')),
  conflict_detected_at timestamptz,
  provider_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, calendar_event_id),
  unique (user_id, integration_id, provider, provider_event_id)
);

alter table calendar_event_sync_state enable row level security;
create policy calendar_event_sync_state_owner_all on calendar_event_sync_state
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on calendar_event_sync_state to authenticated;
create index if not exists calendar_event_sync_state_active_conflict_idx on calendar_event_sync_state(user_id, conflict_type) where conflict_type is not null;
create index if not exists calendar_event_sync_state_provider_idx on calendar_event_sync_state(user_id, integration_id, provider_event_id);

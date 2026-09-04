-- Production persistence additions. Demo records remain in seed.sql only.
create table if not exists inbox_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  raw_text text not null check (length(trim(raw_text)) between 1 and 2000),
  detected_type text not null default 'inbox',
  confidence numeric(4,3) not null default 0 check (confidence between 0 and 1),
  status text not null default 'unprocessed' check (status in ('unprocessed','processed','archived')),
  target_type text,
  target_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table goals add column if not exists deleted_at timestamptz;
alter table followups add column if not exists deleted_at timestamptz;
alter table waiting_items add column if not exists deleted_at timestamptz;
alter table ideas add column if not exists deleted_at timestamptz;
alter table decisions add column if not exists deleted_at timestamptz;
alter table prompts add column if not exists deleted_at timestamptz;
alter table invoices add column if not exists deleted_at timestamptz;
alter table finance_transactions add column if not exists deleted_at timestamptz;
alter table content_items add column if not exists deleted_at timestamptz;
alter table fitness_activities add column if not exists deleted_at timestamptz;
alter table calendar_events add column if not exists deleted_at timestamptz;
alter table calendar_events add column if not exists google_etag text;
alter table notes add column if not exists project_id uuid references projects(id) on delete set null;

create unique index if not exists calendar_events_provider_identity
  on calendar_events(user_id, provider, external_event_id)
  where external_event_id is not null and deleted_at is null;
create index if not exists inbox_items_open_idx on inbox_items(user_id, created_at desc)
  where status = 'unprocessed' and deleted_at is null;

alter table inbox_items enable row level security;
create policy "Users own inbox items" on inbox_items for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger inbox_items_updated_at before update on inbox_items
  for each row execute procedure set_updated_at();

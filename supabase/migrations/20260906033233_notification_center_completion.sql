alter table notifications add column if not exists severity text not null default 'attention'
  check (severity in ('info','attention','important','critical'));
alter table notifications add column if not exists dedupe_key text;
alter table notifications add column if not exists dismissed_at timestamptz;
alter table notifications add column if not exists resolved_at timestamptz;
alter table notifications add column if not exists metadata jsonb not null default '{}'::jsonb;

create unique index if not exists notifications_owner_dedupe_active_idx
  on notifications(user_id,dedupe_key) where dedupe_key is not null and dismissed_at is null and resolved_at is null;
create index if not exists notifications_owner_active_created_idx
  on notifications(user_id,created_at desc) where dismissed_at is null;

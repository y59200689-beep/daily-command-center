-- Explicit membership keeps existing workspace sales records out of this mission.
create table if not exists public.revenue_mission_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  record_type text not null check (record_type in ('lead','opportunity','proposal','payment')),
  record_id uuid not null,
  linked_at timestamptz not null default now(),
  primary key (user_id, record_type, record_id)
);
alter table public.revenue_mission_records enable row level security;
create policy revenue_mission_records_owner_select on public.revenue_mission_records for select to authenticated using ((select auth.uid()) = user_id);
create policy revenue_mission_records_owner_insert on public.revenue_mission_records for insert to authenticated with check (
  (select auth.uid()) = user_id and (
    (record_type = 'lead' and exists (select 1 from public.leads r where r.id = record_id and r.user_id = (select auth.uid()) and r.archived_at is null)) or
    (record_type = 'opportunity' and exists (select 1 from public.opportunities r where r.id = record_id and r.user_id = (select auth.uid()) and r.archived_at is null)) or
    (record_type = 'proposal' and exists (select 1 from public.proposals r where r.id = record_id and r.user_id = (select auth.uid()) and r.archived_at is null)) or
    (record_type = 'payment' and exists (select 1 from public.payments r where r.id = record_id and r.user_id = (select auth.uid()) and r.deleted_at is null))
  )
);
create policy revenue_mission_records_owner_delete on public.revenue_mission_records for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, delete on public.revenue_mission_records to authenticated;

-- Allow explicit mission membership for activity records that can update pace automatically.
alter table public.revenue_mission_records drop constraint if exists revenue_mission_records_record_type_check;
alter table public.revenue_mission_records add constraint revenue_mission_records_record_type_check
  check (record_type in ('lead','opportunity','proposal','payment','task','calendar_event','followup'));
drop policy if exists revenue_mission_records_owner_insert on public.revenue_mission_records;
create policy revenue_mission_records_owner_insert on public.revenue_mission_records for insert to authenticated with check (
  (select auth.uid()) = user_id and (
    (record_type = 'lead' and exists (select 1 from public.leads r where r.id = record_id and r.user_id = (select auth.uid()) and r.archived_at is null)) or
    (record_type = 'opportunity' and exists (select 1 from public.opportunities r where r.id = record_id and r.user_id = (select auth.uid()) and r.archived_at is null)) or
    (record_type = 'proposal' and exists (select 1 from public.proposals r where r.id = record_id and r.user_id = (select auth.uid()) and r.archived_at is null)) or
    (record_type = 'payment' and exists (select 1 from public.payments r where r.id = record_id and r.user_id = (select auth.uid()) and r.deleted_at is null)) or
    (record_type = 'task' and exists (select 1 from public.tasks r where r.id = record_id and r.user_id = (select auth.uid()) and r.deleted_at is null)) or
    (record_type = 'calendar_event' and exists (select 1 from public.calendar_events r where r.id = record_id and r.user_id = (select auth.uid()) and r.deleted_at is null)) or
    (record_type = 'followup' and exists (select 1 from public.followups r where r.id = record_id and r.user_id = (select auth.uid()) and r.deleted_at is null))
  )
);

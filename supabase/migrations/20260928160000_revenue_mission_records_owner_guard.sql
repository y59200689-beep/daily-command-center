-- The referenced sales record must belong to the same authenticated owner.
drop policy if exists revenue_mission_records_owner_insert on public.revenue_mission_records;
create policy revenue_mission_records_owner_insert on public.revenue_mission_records for insert to authenticated with check (
  (select auth.uid()) = user_id and (
    (record_type = 'lead' and exists (select 1 from public.leads r where r.id = record_id and r.user_id = (select auth.uid()) and r.archived_at is null)) or
    (record_type = 'opportunity' and exists (select 1 from public.opportunities r where r.id = record_id and r.user_id = (select auth.uid()) and r.archived_at is null)) or
    (record_type = 'proposal' and exists (select 1 from public.proposals r where r.id = record_id and r.user_id = (select auth.uid()) and r.archived_at is null)) or
    (record_type = 'payment' and exists (select 1 from public.payments r where r.id = record_id and r.user_id = (select auth.uid()) and r.deleted_at is null))
  )
);

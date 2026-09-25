-- Tier 2A: additive metadata on existing businesses and KPI entities. Local activation only.
alter table public.companies add column lifecycle_status text not null default 'operating' check(lifecycle_status in ('planning','operating','paused','closed'));
alter table public.kpi_definitions add column description text check(length(description)<=10000);
alter table public.kpi_definitions add column owner_label text check(length(owner_label)<=240);
alter table public.kpi_definitions add column source_reference text check(length(source_reference)<=240);
alter table public.kpi_definitions add column target_max numeric;
alter table public.kpi_definitions add column aggregation text not null default 'latest' check(aggregation in ('latest','sum','average','min','max','count'));
alter table public.kpi_definitions drop constraint kpi_definitions_direction_check;
alter table public.kpi_definitions add constraint kpi_definitions_direction_check check(direction in ('higher','lower','target_range','informational'));
alter table public.kpi_definitions add constraint tier2_kpi_range check(direction<>'target_range' or (target is not null and target_max is not null and target<=target_max and coalesce(warning_threshold,0)>=0 and coalesce(critical_threshold,warning_threshold,0)>=coalesce(warning_threshold,0)));
alter table public.kpi_definitions drop constraint kpi_definitions_source_check;
alter table public.kpi_definitions add constraint kpi_definitions_source_check check(source in ('manual','commerce_orders','commerce_revenue','commerce_customers'));
alter table public.kpi_observations add column unit text;
alter table public.kpi_observations add column is_manual boolean not null default true check(is_manual);
update public.kpi_observations o set unit=k.unit from public.kpi_definitions k where k.id=o.kpi_id and k.user_id=o.user_id;
create function public.tier2_kpi_unit_guard() returns trigger language plpgsql set search_path=public as $$
declare expected text;
begin
 if tg_table_name='kpi_observations' then
  select unit into expected from public.kpi_definitions where id=new.kpi_id and user_id=new.user_id;
  if expected is null then raise exception 'KPI unavailable' using errcode='23514'; end if;
  if new.unit is not null and new.unit<>expected then raise exception 'Observation unit must match KPI' using errcode='23514'; end if;
  new.unit:=expected;
 elsif new.unit is distinct from old.unit and exists(select 1 from public.kpi_observations where kpi_id=new.id and user_id=new.user_id) then
  raise exception 'A KPI with observations cannot change unit; create a new definition' using errcode='23514';
 end if;
 return new;
end $$;
create trigger tier2_kpi_unit_guard before insert or update on public.kpi_observations for each row execute function public.tier2_kpi_unit_guard();
create trigger tier2_kpi_unit_guard before update on public.kpi_definitions for each row execute function public.tier2_kpi_unit_guard();

create function public.tier2_kpi_period(kpi uuid, starts date, ends date) returns numeric
language sql stable security invoker set search_path=public as $$
 select case when k.source='manual' then (
 select case k.aggregation when 'sum' then sum(o.value) when 'average' then avg(o.value) when 'min' then min(o.value) when 'max' then max(o.value) when 'count' then case when count(*)>0 then count(*)::numeric end else (array_agg(o.value order by o.observed_on desc,o.id))[1] end
 from public.kpi_observations o where o.kpi_id=k.id and o.user_id=auth.uid() and o.unit=k.unit and o.observed_on>=starts and o.observed_on<ends
 ) when k.company_id is null then null else (
 select case k.source when 'commerce_orders' then count(*)::numeric when 'commerce_customers' then count(distinct nullif(o.customer_reference,''))::numeric when 'commerce_revenue' then coalesce(sum(o.total_amount) filter(where o.currency=k.unit),0) end
 from public.commerce_orders o where o.company_id=k.company_id and o.user_id=auth.uid() and o.created_at>=starts::timestamp at time zone 'UTC' and o.created_at<ends::timestamp at time zone 'UTC' and o.status not in ('cancelled','canceled','refunded','failed_payment')
 ) end from public.kpi_definitions k where k.id=kpi and k.user_id=auth.uid();
$$;
create function public.tier2_kpi_values(as_of date default current_date) returns setof jsonb
language sql stable security invoker set search_path=public as $$
 with periods as (select k.*,case frequency when 'monthly' then date_trunc('month',as_of)::date when 'weekly' then date_trunc('week',as_of)::date else as_of end as starts from public.kpi_definitions k where user_id=auth.uid() and active),
 dates as (select p.*,case frequency when 'monthly' then (starts-interval '1 month')::date when 'weekly' then starts-7 else starts-1 end as previous_start from periods p)
 select to_jsonb(k)||jsonb_build_object('current_value',public.tier2_kpi_period(k.id,k.starts,as_of+1),'previous_value',public.tier2_kpi_period(k.id,k.previous_start,k.starts),'source_type',case when k.source='manual' then 'manual' else 'automatic' end,'observed_on',(select max(observed_on) from public.kpi_observations where kpi_id=k.id and user_id=auth.uid() and observed_on<=as_of),'history',
 (select coalesce(jsonb_agg(jsonb_build_object('date',d::date,'value',public.tier2_kpi_period(k.id,d::date,(d+step)::date)) order by d),'[]') from generate_series(k.starts-(case k.frequency when 'monthly' then interval '1 month' when 'weekly' then interval '7 days' else interval '1 day' end)*6,k.starts-(case k.frequency when 'monthly' then interval '1 month' when 'weekly' then interval '7 days' else interval '1 day' end),case k.frequency when 'monthly' then interval '1 month' when 'weekly' then interval '7 days' else interval '1 day' end) d cross join lateral (select case k.frequency when 'monthly' then interval '1 month' when 'weekly' then interval '7 days' else interval '1 day' end as step) s)) from dates k;
$$;
revoke all on function public.tier2_kpi_period(uuid,date,date),public.tier2_kpi_values(date) from public,anon;
grant execute on function public.tier2_kpi_period(uuid,date,date),public.tier2_kpi_values(date) to authenticated;

revoke all on function public.tier2_kpi_unit_guard() from public,anon,authenticated;

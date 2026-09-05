-- Daily Command Center V3 intelligence foundations. All rapidly changing scores
-- remain derived; only user feedback, accepted plans, memory, and historical
-- review/snapshot evidence are persisted.

alter table profiles add column if not exists workday_start time not null default '09:00';
alter table profiles add column if not exists workday_end time not null default '18:00';
alter table profiles add column if not exists work_days smallint[] not null default array[1,2,3,4,5]::smallint[];
alter table profiles add column if not exists preferred_focus_block_minutes integer not null default 90
  check (preferred_focus_block_minutes between 25 and 240);
alter table profiles add constraint profiles_workday_order_check check (workday_end > workday_start) not valid;

alter table daily_plans add column if not exists status text not null default 'draft'
  check (status in ('draft','accepted','rejected'));
alter table daily_plans add column if not exists suggestion jsonb not null default '{}'::jsonb;
alter table daily_plans add column if not exists generated_at timestamptz;
alter table daily_plans add column if not exists accepted_at timestamptz;
alter table daily_plans add column if not exists rejected_at timestamptz;

alter table daily_reviews add column if not exists metrics jsonb not null default '{}'::jsonb;
alter table daily_reviews add column if not exists carry_over_task_ids uuid[] not null default '{}'::uuid[];

create table memory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  memory_type text not null check (memory_type in ('preference','project_context','client_context','decision','pattern','routine','fact')),
  title text not null check (length(trim(title)) between 1 and 240),
  summary text not null check (length(trim(summary)) between 1 and 10000),
  source_entity_type text,
  source_entity_id uuid,
  confidence numeric(4,3) not null default 0.7 check (confidence between 0 and 1),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check ((source_entity_type is null) = (source_entity_id is null)),
  check (source_entity_type is null or source_entity_type in ('task','project','client','note','decision','content','campaign','invoice','goal','calendar_event'))
);

create table insight_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  insight_key text not null check (length(insight_key) between 1 and 300),
  insight_type text not null check (length(insight_type) between 1 and 120),
  entity_type text,
  entity_id text,
  action text not null check (action in ('dismissed','snoozed','irrelevant','helpful','hidden_type')),
  snoozed_until timestamptz,
  created_at timestamptz not null default now(),
  check ((action = 'snoozed' and snoozed_until is not null) or (action <> 'snoozed' and snoozed_until is null))
);

create table daily_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recommendation_key text not null,
  action_type text not null,
  entity_type text not null,
  entity_id text not null,
  label text not null,
  reason text not null,
  priority integer not null check (priority between 0 and 100),
  evidence jsonb not null default '[]'::jsonb,
  recommended_at timestamptz not null default now(),
  expires_at timestamptz,
  resolved_at timestamptz,
  unique(user_id,recommendation_key)
);

create table weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status text not null default 'generated' check (status in ('generated','accepted','archived')),
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,period_start),
  check (period_end >= period_start)
);

create table risk_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_date date not null,
  risk_key text not null,
  entity_type text not null,
  entity_id text not null,
  severity text not null check (severity in ('low','medium','high','critical')),
  title text not null,
  reason text not null,
  evidence jsonb not null default '[]'::jsonb,
  recommended_action text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique(user_id,snapshot_date,risk_key)
);

create table pattern_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_date date not null,
  pattern_key text not null,
  title text not null,
  statement text not null,
  evidence jsonb not null default '[]'::jsonb,
  sample_size integer not null check (sample_size > 0),
  confidence text not null check (confidence in ('limited','moderate','strong')),
  created_at timestamptz not null default now(),
  unique(user_id,snapshot_date,pattern_key)
);

do $$
declare table_name text;
begin
  foreach table_name in array array['memory_items','insight_feedback','daily_recommendations','weekly_reviews','risk_snapshots','pattern_snapshots'] loop
    execute format('alter table %I enable row level security',table_name);
    execute format('create policy %I on %I for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()))',table_name||'_owner_all',table_name);
    execute format('grant select,insert,update,delete on table %I to authenticated',table_name);
  end loop;
end $$;

create index memory_items_owner_type_idx on memory_items(user_id,memory_type,updated_at desc) where archived_at is null;
create index memory_items_source_idx on memory_items(user_id,source_entity_type,source_entity_id) where archived_at is null;
create index memory_items_search_idx on memory_items using gin(to_tsvector('simple',title||' '||summary)) where archived_at is null;
create index insight_feedback_lookup_idx on insight_feedback(user_id,insight_key,created_at desc);
create index insight_feedback_hidden_idx on insight_feedback(user_id,insight_type,action,created_at desc);
create index daily_recommendations_active_idx on daily_recommendations(user_id,priority desc,recommended_at desc) where resolved_at is null;
create index weekly_reviews_owner_period_idx on weekly_reviews(user_id,period_end desc);
create index risk_snapshots_active_idx on risk_snapshots(user_id,snapshot_date desc,severity) where resolved_at is null;
create index pattern_snapshots_owner_date_idx on pattern_snapshots(user_id,snapshot_date desc);

create trigger memory_items_updated before update on memory_items for each row execute function set_updated_at();
create trigger weekly_reviews_updated before update on weekly_reviews for each row execute function set_updated_at();

-- Source ownership is checked in the API and again in Postgres so direct
-- authenticated writes cannot attach memory to another user's records.
create or replace function validate_memory_source() returns trigger
language plpgsql security invoker set search_path=public as $$
declare source_owned boolean;
begin
  if new.source_entity_type is null then return new; end if;
  case new.source_entity_type
    when 'task' then select exists(select 1 from tasks where id=new.source_entity_id and user_id=new.user_id and deleted_at is null) into source_owned;
    when 'project' then select exists(select 1 from projects where id=new.source_entity_id and user_id=new.user_id and deleted_at is null) into source_owned;
    when 'client' then select exists(select 1 from clients where id=new.source_entity_id and user_id=new.user_id and deleted_at is null) into source_owned;
    when 'note' then select exists(select 1 from notes where id=new.source_entity_id and user_id=new.user_id and deleted_at is null) into source_owned;
    when 'decision' then select exists(select 1 from decisions where id=new.source_entity_id and user_id=new.user_id and deleted_at is null) into source_owned;
    when 'content' then select exists(select 1 from content_items where id=new.source_entity_id and user_id=new.user_id and deleted_at is null) into source_owned;
    when 'campaign' then select exists(select 1 from campaigns where id=new.source_entity_id and user_id=new.user_id and deleted_at is null) into source_owned;
    when 'invoice' then select exists(select 1 from invoices where id=new.source_entity_id and user_id=new.user_id and deleted_at is null) into source_owned;
    when 'goal' then select exists(select 1 from goals where id=new.source_entity_id and user_id=new.user_id and deleted_at is null) into source_owned;
    when 'calendar_event' then select exists(select 1 from calendar_events where id=new.source_entity_id and user_id=new.user_id and deleted_at is null) into source_owned;
    else source_owned := false;
  end case;
  if not coalesce(source_owned,false) then raise exception 'Memory source must be an owned active record.'; end if;
  return new;
end $$;
revoke all on function validate_memory_source() from public,anon,authenticated;
create trigger memory_items_validate_source before insert or update of source_entity_type,source_entity_id,user_id on memory_items for each row execute function validate_memory_source();

create or replace function log_v3_domain_event() returns trigger
language plpgsql security invoker set search_path=public as $$
declare event_action text; event_metadata jsonb;
begin
  if tg_op <> 'UPDATE' then return new; end if;
  if tg_table_name = 'tasks' then
    if old.status is distinct from new.status and new.status = 'completed' then event_action := 'task_completed';
    elsif (old.due_date is distinct from new.due_date and old.due_date is not null and new.due_date > old.due_date)
       or (old.scheduled_start is distinct from new.scheduled_start and old.scheduled_start is not null and new.scheduled_start > old.scheduled_start)
      then event_action := 'task_postponed';
    end if;
    event_metadata := jsonb_build_object('title',new.title,'from_status',old.status,'to_status',new.status,'from_due_date',old.due_date,'to_due_date',new.due_date,'project_id',new.project_id);
  elsif tg_table_name = 'content_items' and old.status is distinct from new.status then
    event_action := 'content_status_changed'; event_metadata := jsonb_build_object('title',new.title,'from_status',old.status,'to_status',new.status,'project_id',new.project_id,'campaign_id',new.campaign_id);
  elsif tg_table_name = 'invoices' and old.status is distinct from new.status then
    event_action := 'invoice_status_changed'; event_metadata := jsonb_build_object('title',coalesce(new.title,new.invoice_number),'from_status',old.status,'to_status',new.status,'client_id',new.client_id,'amount_remaining',new.amount_remaining,'currency',new.currency);
  elsif tg_table_name = 'milestones' and (old.status is distinct from new.status or old.progress is distinct from new.progress) and (new.status = 'completed' or new.progress >= 100) then
    event_action := 'milestone_completed'; event_metadata := jsonb_build_object('name',new.name,'project_id',new.project_id);
  elsif tg_table_name = 'decisions' and old.status is distinct from new.status and new.status = 'superseded' then
    event_action := 'decision_superseded'; event_metadata := jsonb_build_object('title',new.title,'project_id',new.project_id,'replacement_id',new.superseded_by_decision_id);
  end if;
  if event_action is not null then
    insert into activity_log(user_id,action,entity_type,entity_id,metadata,actor)
    values(new.user_id,event_action,case tg_table_name when 'content_items' then 'content' else trim(trailing 's' from tg_table_name) end,new.id,event_metadata,'user');
  end if;
  return new;
end $$;
revoke all on function log_v3_domain_event() from public,anon,authenticated;

drop trigger if exists tasks_v3_event on tasks;
create trigger tasks_v3_event after update on tasks for each row execute function log_v3_domain_event();
drop trigger if exists content_items_v3_event on content_items;
create trigger content_items_v3_event after update on content_items for each row execute function log_v3_domain_event();
drop trigger if exists invoices_v3_event on invoices;
create trigger invoices_v3_event after update on invoices for each row execute function log_v3_domain_event();
drop trigger if exists milestones_v3_event on milestones;
create trigger milestones_v3_event after update on milestones for each row execute function log_v3_domain_event();
drop trigger if exists decisions_v3_event on decisions;
create trigger decisions_v3_event after update on decisions for each row execute function log_v3_domain_event();

create or replace function accept_daily_plan(plan_date_value date,plan_payload jsonb,priority_task_ids uuid[])
returns daily_plans language plpgsql security invoker set search_path=public as $$
declare owned_count integer; distinct_count integer; saved_plan daily_plans;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if plan_date_value is null then raise exception 'Plan date is required.'; end if;
  if coalesce(cardinality(priority_task_ids),0) > 3 then raise exception 'A daily plan can contain at most three wins.'; end if;
  select count(distinct task_id),count(*) into distinct_count,owned_count
  from unnest(coalesce(priority_task_ids,'{}'::uuid[])) as selected(task_id)
  join tasks on tasks.id=selected.task_id and tasks.user_id=auth.uid() and tasks.deleted_at is null;
  if distinct_count <> coalesce(cardinality(priority_task_ids),0) or owned_count <> coalesce(cardinality(priority_task_ids),0) then
    raise exception 'Every selected win must be an owned active task.';
  end if;
  insert into daily_plans(user_id,plan_date,status,suggestion,generated_at,accepted_at,rejected_at)
  values(auth.uid(),plan_date_value,'accepted',coalesce(plan_payload,'{}'::jsonb),now(),now(),null)
  on conflict(user_id,plan_date) do update set status='accepted',suggestion=excluded.suggestion,generated_at=excluded.generated_at,accepted_at=excluded.accepted_at,rejected_at=null
  returning * into saved_plan;
  delete from daily_priorities where plan_id=saved_plan.id;
  insert into daily_priorities(user_id,plan_id,task_id,position)
  select auth.uid(),saved_plan.id,selected.task_id,selected.position::smallint
  from unnest(coalesce(priority_task_ids,'{}'::uuid[])) with ordinality as selected(task_id,position);
  return saved_plan;
end $$;

create or replace function reject_daily_plan(plan_date_value date,plan_payload jsonb)
returns daily_plans language plpgsql security invoker set search_path=public as $$
declare saved_plan daily_plans;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  insert into daily_plans(user_id,plan_date,status,suggestion,generated_at,rejected_at,accepted_at)
  values(auth.uid(),plan_date_value,'rejected',coalesce(plan_payload,'{}'::jsonb),now(),now(),null)
  on conflict(user_id,plan_date) do update set status='rejected',suggestion=excluded.suggestion,generated_at=excluded.generated_at,rejected_at=excluded.rejected_at,accepted_at=null
  returning * into saved_plan;
  return saved_plan;
end $$;

revoke all on function accept_daily_plan(date,jsonb,uuid[]) from public,anon;
grant execute on function accept_daily_plan(date,jsonb,uuid[]) to authenticated;
revoke all on function reject_daily_plan(date,jsonb) from public,anon;
grant execute on function reject_daily_plan(date,jsonb) to authenticated;

-- Keep source entities ahead of derived intelligence in search. The V2/V2.1
-- search implementation remains the canonical source-search function.
alter function search_workspace(text,int) rename to search_workspace_sources;
create or replace function search_workspace(search_query text,result_limit int default 30)
returns table(entity_type text,entity_id uuid,title text,snippet text,rank real,updated_at timestamptz)
language sql security invoker set search_path=public as $$
  select results.entity_type,results.entity_id,results.title,results.snippet,results.rank,results.updated_at
  from (
    select entity_type,entity_id,title,snippet,rank,updated_at
    from search_workspace_sources(search_query,result_limit)
    union all
    select 'memory',id,title,left(summary,240),0.65::real,memory_items.updated_at
    from memory_items where user_id=auth.uid() and archived_at is null and (title ilike '%'||search_query||'%' or summary ilike '%'||search_query||'%')
    union all
    select 'recommendation',id,label,left(reason,240),0.55::real,recommended_at
    from daily_recommendations where user_id=auth.uid() and resolved_at is null and (label ilike '%'||search_query||'%' or reason ilike '%'||search_query||'%')
    union all
    select 'risk',id,title,left(reason,240),0.50::real,created_at
    from risk_snapshots where user_id=auth.uid() and resolved_at is null and (title ilike '%'||search_query||'%' or reason ilike '%'||search_query||'%')
    union all
    select 'weekly_review',id,'Weekly review · '||period_start::text,left(summary::text,240),0.40::real,updated_at
    from weekly_reviews where user_id=auth.uid() and summary::text ilike '%'||search_query||'%'
  ) as results(entity_type,entity_id,title,snippet,rank,updated_at)
  order by results.rank desc,results.updated_at desc
  limit least(greatest(result_limit,1),50)
$$;
revoke all on function search_workspace(text,int) from public,anon;
grant execute on function search_workspace(text,int) to authenticated;

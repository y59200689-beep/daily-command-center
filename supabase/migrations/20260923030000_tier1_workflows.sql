-- LOCAL ONLY. Requires separate authorization before remote application.
-- Production catalog inspected read-only on 2026-09-23. All existing values preserved.
begin;
alter table public.executive_snapshots add column if not exists founder_facts jsonb;
alter table public.decisions add column if not exists workflow jsonb not null default '{}' check (jsonb_typeof(workflow)='object');
alter table public.decisions add column if not exists founder_required boolean not null default false;
alter table public.quality_incidents add column if not exists postmortem jsonb not null default '{}' check (jsonb_typeof(postmortem)='object');
alter table public.tasks add column if not exists work_classification text not null default 'standard' check (work_classification in ('founder_only','delegate','automate_candidate','standard'));
alter table public.team_delegations add column if not exists founder_approval_required boolean not null default false;
-- Expand existing endpoint constraints, preserving their complete prior vocabularies.
alter table public.operational_dependencies drop constraint operational_dependencies_source_type_check;
alter table public.operational_dependencies add constraint operational_dependencies_source_type_check check (source_type in ('task','project','issue','decision','risk','person','business','system','obligation','commitment','sop','process','run','client','opportunity','supplier','product','campaign','calendar_event','integration','tool_system','approval','strategic_milestone'));
alter table public.operational_dependencies drop constraint operational_dependencies_dependency_type_check;
alter table public.operational_dependencies add constraint operational_dependencies_dependency_type_check check (dependency_type in ('task','project','issue','decision','risk','person','business','system','obligation','commitment','sop','process','run','client','opportunity','supplier','product','campaign','calendar_event','integration','tool_system','approval','strategic_milestone','other'));
create or replace function public.founder_owner_guard() returns trigger language plpgsql set search_path = public as $$
declare refs jsonb; pair record; target uuid; owned boolean; row_data jsonb := to_jsonb(new); mapped text;
begin
  if tg_op = 'UPDATE' and new.user_id <> old.user_id then raise exception 'Owner cannot be changed' using errcode='23514'; end if;
  refs := case tg_table_name
    when 'quality_incidents' then '{"company_id":"companies","project_id":"projects","corrective_task_id":"tasks","system_id":"operational_systems"}'::jsonb
    when 'operating_risks' then '{"company_id":"companies","project_id":"projects","issue_id":"quality_incidents","decision_id":"decisions"}'::jsonb
    when 'companies' then '{"primary_project_id":"projects"}'::jsonb
    when 'operational_systems' then '{"company_id":"companies","subscription_id":"subscriptions"}'::jsonb
    when 'system_access_records' then '{"system_id":"operational_systems","person_id":"team_people"}'::jsonb
    when 'kpi_definitions' then '{"company_id":"companies"}'::jsonb
    when 'kpi_observations' then '{"kpi_id":"kpi_definitions"}'::jsonb
    when 'operating_relationships' then '{"company_id":"companies","client_id":"clients","supplier_id":"supplier_records","person_id":"team_people"}'::jsonb
    when 'operating_commitments' then '{"company_id":"companies","project_id":"projects","task_id":"tasks","waiting_id":"waiting_items","relationship_id":"operating_relationships"}'::jsonb
    when 'growth_experiments' then '{"company_id":"companies","project_id":"projects","decision_id":"decisions"}'::jsonb
    when 'asset_metadata' then '{"attachment_id":"attachments","content_id":"content_items","company_id":"companies","project_id":"projects","parent_asset_id":"asset_metadata"}'::jsonb
    when 'decisions' then '{"company_id":"companies","project_id":"projects","client_id":"clients"}'::jsonb
    when 'waiting_items' then '{"company_id":"companies","project_id":"projects","client_id":"clients","task_id":"tasks"}'::jsonb
    else '{}'::jsonb end;
  for pair in select * from jsonb_each_text(refs) loop
    target := nullif(row_data->>pair.key,'')::uuid;
    if target is not null then
      execute format('select exists(select 1 from public.%I where id=$1 and user_id=$2)',pair.value) into owned using target,new.user_id;
      if not owned then raise exception 'Referenced record must belong to the same owner' using errcode='23514'; end if;
    end if;
  end loop;
  if tg_table_name = 'operational_dependencies' then
    for pair in select * from jsonb_each_text(jsonb_build_object('source',row_data->>'source_type','dependency',row_data->>'dependency_type')) loop
      mapped := ('{"task":"tasks","project":"projects","issue":"quality_incidents","decision":"decisions","risk":"operating_risks","person":"team_people","business":"companies","system":"operational_systems","obligation":"financial_obligations","commitment":"operating_commitments","sop":"operational_sops","process":"process_templates","run":"process_runs","client":"clients","opportunity":"opportunities","supplier":"supplier_records","product":"product_catalog_refs","campaign":"campaigns","calendar_event":"calendar_events","integration":"integrations","tool_system":"operational_systems","approval":"action_proposals","strategic_milestone":"strategic_milestones"}'::jsonb)->>pair.value;
      target := nullif(row_data->>(pair.key||'_id'),'')::uuid;
      if mapped is not null and target is not null then
        execute format('select exists(select 1 from public.%I where id=$1 and user_id=$2)',mapped) into owned using target,new.user_id;
        if not owned then raise exception 'Dependency endpoint must belong to owner' using errcode='23514'; end if;
      end if;
    end loop;
    if new.source_type=new.dependency_type and new.source_id=new.dependency_id then raise exception 'Self dependency is not allowed' using errcode='23514'; end if;
  end if;
  if tg_table_name='kpi_observations' then
    if not exists(select 1 from public.kpi_definitions where id=new.kpi_id and user_id=new.user_id and source='manual') then raise exception 'Transactional KPIs cannot have manual observations' using errcode='23514'; end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
-- Trigger-only helper, never a callable Data API endpoint.
revoke all on function public.founder_owner_guard() from public, anon, authenticated;

-- Preserve legacy duplicate rows; reject new duplicates and endpoint-changing updates.
create function public.tier1_dependency_unique() returns trigger language plpgsql set search_path=public as $$
begin
  if new.source_id is null or new.dependency_id is null then return new; end if;
  if tg_op='UPDATE' and (new.user_id,new.source_type,new.source_id,new.dependency_type,new.dependency_id) is not distinct from (old.user_id,old.source_type,old.source_id,old.dependency_type,old.dependency_id) then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text||new.source_type||new.source_id::text||new.dependency_type||new.dependency_id::text,0));
  if exists(select 1 from public.operational_dependencies where user_id=new.user_id and source_type=new.source_type and source_id=new.source_id and dependency_type=new.dependency_type and dependency_id=new.dependency_id and id<>new.id) then
    raise exception 'This dependency already exists' using errcode='23505';
  end if;
  return new;
end $$;
revoke all on function public.tier1_dependency_unique() from public, anon, authenticated;
create trigger tier1_dependency_unique before insert or update on public.operational_dependencies for each row execute function public.tier1_dependency_unique();

create table public.founder_strategy_links (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 source_type text not null check(source_type in ('task','project','decision','risk')), source_id uuid not null,
 target_type text not null check(target_type in ('goal','commitment','milestone','kpi')), target_id uuid not null,
 created_at timestamptz not null default now(), unique(user_id,source_type,source_id,target_type,target_id)
);
alter table public.founder_strategy_links enable row level security;
create policy founder_strategy_owner on public.founder_strategy_links for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
revoke all on table public.founder_strategy_links from public, anon;
create function public.tier1_strategy_owner() returns trigger language plpgsql set search_path=public as $$
declare mapped text; owned boolean;
begin
 if tg_op='UPDATE' and new.user_id<>old.user_id then raise exception 'Owner cannot change'; end if;
 mapped:= ('{"task":"tasks","project":"projects","decision":"decisions","risk":"operating_risks"}'::jsonb)->>new.source_type;
 execute format('select exists(select 1 from public.%I where id=$1 and user_id=$2)',mapped) into owned using new.source_id,new.user_id;
 if not owned then raise exception 'Source unavailable' using errcode='23514'; end if;
 mapped:= ('{"goal":"goals","commitment":"strategic_commitments","milestone":"strategic_milestones","kpi":"kpi_definitions"}'::jsonb)->>new.target_type;
 execute format('select exists(select 1 from public.%I where id=$1 and user_id=$2)',mapped) into owned using new.target_id,new.user_id;
 if not owned then raise exception 'Target unavailable' using errcode='23514'; end if;
 return new;
end $$;
revoke all on function public.tier1_strategy_owner() from public, anon, authenticated;
create trigger tier1_strategy_owner before insert or update on public.founder_strategy_links for each row execute function public.tier1_strategy_owner();
grant select,insert,update,delete on public.founder_strategy_links to authenticated;
create index founder_strategy_links_target_idx on public.founder_strategy_links(user_id,target_type,target_id);

-- Explicit, atomic, idempotent lesson proposal. Never accepts a lesson automatically.
create function public.tier1_propose_lesson(source_kind text, source_key uuid, lesson_statement text) returns uuid language plpgsql security invoker set search_path=public as $$
declare mapped text; owned boolean; result uuid;
begin
 mapped:= ('{"decision":"decisions","issue":"quality_incidents","risk":"operating_risks","forecast":"forecast_evaluations","weekly":"retrospectives"}'::jsonb)->>source_kind;
 if mapped is null or auth.uid() is null then raise exception 'Source unavailable'; end if;
 if length(trim(lesson_statement))<5 or length(lesson_statement)>10000 then raise exception 'A substantive lesson is required'; end if;
 execute format('select exists(select 1 from public.%I where id=$1 and user_id=$2)',mapped) into owned using source_key,auth.uid();
 if not owned then raise exception 'Source unavailable' using errcode='23514'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||mapped||source_key::text,0));
 select id into result from public.operating_lessons where user_id=auth.uid() and source_table=mapped and source_id=source_key;
 if result is not null then return result; end if;
 insert into public.operating_lessons(user_id,title,statement,why_proposed,domain,status,confidence_state,source_table,source_id)
 values(auth.uid(),initcap(source_kind)||' review lesson',trim(lesson_statement),'Explicitly proposed from a source review; assess applicability before accepting.','operations','proposed','weak',mapped,source_key) returning id into result;
 insert into public.lesson_evidence_links(user_id,lesson_id,source_table,source_id,description,source_quality)
 values(auth.uid(),result,mapped,source_key::text,'Explicit source review','user_reported');
 return result;
end $$;
revoke all on function public.tier1_propose_lesson(text,uuid,text) from public,anon;
grant execute on function public.tier1_propose_lesson(text,uuid,text) to authenticated;
alter table public.goals drop constraint goals_period_check;
alter table public.goals add constraint goals_period_check check(period in ('year','quarter','month','week'));
alter table public.quality_incidents add column if not exists postmortem_actions jsonb not null default '{}';
create function public.tier1_postmortem_action(issue_key uuid, action_kind text) returns jsonb language plpgsql security invoker set search_path=public as $$
declare incident public.quality_incidents; result uuid; destination text; content text;
begin
 if auth.uid() is null or action_kind not in ('task','risk','followup','sop') then raise exception 'Invalid action'; end if;
 select * into incident from public.quality_incidents where id=issue_key and user_id=auth.uid() for update;
 if not found then raise exception 'Issue unavailable' using errcode='23514'; end if;
 if incident.postmortem_actions ? action_kind then return incident.postmortem_actions->action_kind; end if;
 content:=nullif(trim(incident.postmortem->>'prevention'),'');
 if content is null then raise exception 'Save preventive actions in the postmortem first' using errcode='23514'; end if;
 if action_kind='task' then
  insert into public.tasks(user_id,title,description,status,priority,project_id,due_date)
  values(auth.uid(),left('Prevent recurrence: '||incident.title,240),content||E'\nOwner: '||coalesce(incident.postmortem->>'prevention_owner','Not recorded')||E'\nIssue: '||issue_key,'inbox','high',incident.project_id,nullif(incident.postmortem->>'prevention_due','')::date) returning id into result;
  destination:='/tasks/'||result;
  update public.quality_incidents set corrective_task_id=coalesce(corrective_task_id,result) where id=issue_key and user_id=auth.uid();
 elsif action_kind='risk' then
  insert into public.operating_risks(user_id,title,description,category,status,probability,impact,currency,mitigation,company_id,project_id,issue_id,owner_label)
  values(auth.uid(),left('Recurrence: '||incident.title,240),incident.postmortem->>'recurrence_risk','operational','identified',null,null,coalesce(incident.currency,'MAD'),content,incident.company_id,incident.project_id,issue_key,incident.postmortem->>'prevention_owner') returning id into result;
  destination:='/risks/register?record='||result;
 elsif action_kind='followup' then
  insert into public.followups(user_id,title,project_id,due_at,notes)
  values(auth.uid(),left('Review prevention: '||incident.title,240),incident.project_id,nullif(incident.postmortem->>'followup_on','')::date,content||E'\nIssue: '||issue_key) returning id into result;
  destination:='/followups/'||result;
 else
  insert into public.inbox_items(user_id,raw_text,detected_type,status)
  values(auth.uid(),'SOP improvement for issue '||issue_key||': '||incident.title||E'\n'||content,'note','unprocessed') returning id into result;
  destination:='/inbox';
 end if;
 update public.quality_incidents set postmortem_actions=postmortem_actions||jsonb_build_object(action_kind,jsonb_build_object('id',result,'route',destination)) where id=issue_key and user_id=auth.uid();
 return jsonb_build_object('id',result,'route',destination);
end $$;
revoke all on function public.tier1_postmortem_action(uuid,text) from public,anon;
grant execute on function public.tier1_postmortem_action(uuid,text) to authenticated;

-- Existing shared trigger compiled milestone-only fields for decision updates.
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
  elsif tg_table_name = 'milestones' and (old.status is distinct from new.status or (to_jsonb(old)->>'progress')::numeric is distinct from (to_jsonb(new)->>'progress')::numeric) and (new.status = 'completed' or (to_jsonb(new)->>'progress')::numeric >= 100) then
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


create function public.tier1_weekly_review(period_end date, evidence text) returns uuid language plpgsql security invoker set search_path=public as $$
declare result uuid;
begin
 if auth.uid() is null or period_end is null or evidence is null or length(evidence)>100000 then raise exception 'Invalid review'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||'weekly'||period_end::text,0));
 select id into result from public.retrospectives where user_id=auth.uid() and entity_type='founder_weekly' and entity_id=period_end::text limit 1;
 if result is not null then return result; end if;
 insert into public.retrospectives(user_id,title,retro_type,domain,entity_type,entity_id,period,actual_summary,status)
 values(auth.uid(),'Executive review ending '||period_end,'custom','operations','founder_weekly',period_end::text,(period_end-6)::text||' to '||period_end,evidence,'draft') returning id into result;
 return result;
end $$;
revoke all on function public.tier1_weekly_review(date,text) from public,anon;
grant execute on function public.tier1_weekly_review(date,text) to authenticated;

-- Repeat after all definitions so default ACL policy cannot widen these RPCs.
revoke all on function public.tier1_propose_lesson(text,uuid,text) from public,anon;
revoke all on function public.tier1_postmortem_action(uuid,text) from public,anon;
revoke all on function public.tier1_weekly_review(date,text) from public,anon;

commit;

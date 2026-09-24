-- Tier 3: Intelligence, Learning, Prediction & Synthesis Layer

-- 1. Experiment Engine Schema Enhancements
alter table public.growth_experiments add column if not exists expected_outcome text check (expected_outcome is null or length(expected_outcome) <= 10000);
alter table public.growth_experiments add column if not exists confidence text default 'medium' check (confidence in ('low','medium','high'));
alter table public.growth_experiments add column if not exists cost_estimate numeric check (cost_estimate is null or (cost_estimate >= -1000000000000000 and cost_estimate <= 1000000000000000));
alter table public.growth_experiments add column if not exists currency text default 'USD' check (currency is null or length(currency) = 3);
alter table public.growth_experiments add column if not exists outcome_result text check (outcome_result is null or outcome_result in ('SUPPORTED','PARTIALLY_SUPPORTED','NOT_SUPPORTED','INCONCLUSIVE'));
alter table public.growth_experiments add column if not exists kpi_id uuid references public.kpi_definitions(id);
alter table public.growth_experiments add column if not exists risk_id uuid references public.operating_risks(id);
alter table public.growth_experiments add column if not exists owner_label text check (owner_label is null or length(owner_label) <= 240);

alter table public.growth_experiments drop constraint if exists growth_experiments_status_check;
alter table public.growth_experiments add constraint growth_experiments_status_check check (status in ('idea','planned','running','paused','completed','cancelled'));

-- 2. Forecasts Journal Table
create table if not exists public.founder_forecasts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prediction text not null check (length(trim(prediction)) between 1 and 500),
  domain text not null default 'general' check (domain in ('general','revenue','growth','product','delivery','supplier','team','operations','finance','personal')),
  company_id uuid references public.companies(id),
  project_id uuid references public.projects(id),
  created_date date not null default current_date,
  resolution_date date not null,
  predicted_outcome text not null check (length(predicted_outcome) <= 5000),
  confidence text not null default 'medium' check (confidence in ('low','medium','high')),
  assumptions text check (assumptions is null or length(assumptions) <= 10000),
  actual_result text check (actual_result is null or length(actual_result) <= 10000),
  resolution text not null default 'unresolved' check (resolution in ('unresolved','correct','partially_correct','incorrect')),
  calibration_notes text check (calibration_notes is null or length(calibration_notes) <= 10000),
  decision_id uuid references public.decisions(id),
  experiment_id uuid references public.growth_experiments(id),
  kpi_id uuid references public.kpi_definitions(id),
  source_inbox_id uuid references public.inbox_items(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists founder_forecasts_owner_updated_idx on public.founder_forecasts(user_id, updated_at desc);
create index if not exists founder_forecasts_resolution_idx on public.founder_forecasts(user_id, resolution, resolution_date);
create unique index if not exists founder_forecasts_capture_idx on public.founder_forecasts(user_id, source_inbox_id) where source_inbox_id is not null;

alter table public.founder_forecasts enable row level security;
grant select, insert, update, delete on public.founder_forecasts to authenticated;
drop policy if exists founder_forecasts_owner_all on public.founder_forecasts;
create policy founder_forecasts_owner_all on public.founder_forecasts for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- 3. Asset Metadata Enhancements
alter table public.asset_metadata add column if not exists last_used_date date;
alter table public.asset_metadata add column if not exists value_category text default 'core' check (value_category in ('core','differentiating','supporting','exploratory','dormant'));
alter table public.asset_metadata add column if not exists reuse_potential text default 'medium' check (reuse_potential in ('high','medium','low'));
alter table public.asset_metadata add column if not exists maintenance_requirement text default 'none' check (maintenance_requirement in ('none','periodic_review','continuous_update','license_renewal'));
alter table public.asset_metadata add column if not exists maintenance_due_date date;
alter table public.asset_metadata add column if not exists sop_id uuid references public.operational_sops(id);
alter table public.asset_metadata add column if not exists location_reference text check (location_reference is null or length(location_reference) <= 1000);

-- 4. Content Items Enhancements
alter table public.content_items add column if not exists company_id uuid references public.companies(id);
alter table public.content_items add column if not exists content_pillar text check (content_pillar is null or length(content_pillar) <= 240);
alter table public.content_items add column if not exists objective text check (objective is null or length(objective) <= 1000);
alter table public.content_items add column if not exists target_audience text check (target_audience is null or length(target_audience) <= 500);
alter table public.content_items add column if not exists content_url text check (content_url is null or length(content_url) <= 2048);
alter table public.content_items add column if not exists repurpose_source_id uuid references public.content_items(id);
alter table public.content_items add column if not exists repurpose_notes text check (repurpose_notes is null or length(repurpose_notes) <= 5000);

-- 5. Daily Founder Energy & Attention State Table
create table if not exists public.founder_daily_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  energy text not null default 'normal' check (energy in ('low','normal','high')),
  focus text not null default 'normal' check (focus in ('poor','normal','strong')),
  stress_load text not null default 'normal' check (stress_load in ('low','normal','high')),
  cognitive_notes text check (cognitive_notes is null or length(cognitive_notes) <= 5000),
  deep_work_minutes integer default 0 check (deep_work_minutes >= 0),
  meeting_count integer default 0 check (meeting_count >= 0),
  context_switches integer default 0 check (context_switches >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists founder_daily_states_owner_date_idx on public.founder_daily_states(user_id, date desc);

alter table public.founder_daily_states enable row level security;
grant select, insert, update, delete on public.founder_daily_states to authenticated;
drop policy if exists founder_daily_states_owner_all on public.founder_daily_states;
create policy founder_daily_states_owner_all on public.founder_daily_states for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- 6. Comprehensive Owner Guard Update
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
    when 'growth_experiments' then '{"company_id":"companies","project_id":"projects","decision_id":"decisions","kpi_id":"kpi_definitions","risk_id":"operating_risks"}'::jsonb
    when 'asset_metadata' then '{"attachment_id":"attachments","content_id":"content_items","company_id":"companies","project_id":"projects","parent_asset_id":"asset_metadata","sop_id":"operational_sops"}'::jsonb
    when 'founder_forecasts' then '{"company_id":"companies","project_id":"projects","decision_id":"decisions","experiment_id":"growth_experiments","kpi_id":"kpi_definitions"}'::jsonb
    when 'content_items' then '{"company_id":"companies","repurpose_source_id":"content_items"}'::jsonb
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
      mapped := ('{"task":"tasks","project":"projects","issue":"quality_incidents","decision":"decisions","risk":"operating_risks","person":"team_people","business":"companies","system":"operational_systems","obligation":"financial_obligations","commitment":"operating_commitments","sop":"operational_sops","process":"process_templates","run":"process_runs","client":"clients","opportunity":"opportunities","supplier":"supplier_records","product":"product_catalog_refs","campaign":"campaigns","calendar_event":"calendar_events","integration":"integrations","tool_system":"operational_systems","approval":"action_proposals","strategic_milestone":"strategic_milestones","experiment":"growth_experiments","forecast":"founder_forecasts"}'::jsonb)->>pair.value;
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
revoke all on function public.founder_owner_guard() from public, anon, authenticated;

-- Wire Triggers for new tables
drop trigger if exists founder_owner_guard on public.founder_forecasts;
create trigger founder_owner_guard before insert or update on public.founder_forecasts for each row execute function public.founder_owner_guard();

drop trigger if exists founder_audit_change on public.founder_forecasts;
create trigger founder_audit_change after insert or update or delete on public.founder_forecasts for each row execute function public.founder_audit_change();

drop trigger if exists founder_capture_conversion on public.founder_forecasts;
create trigger founder_capture_conversion before insert or update on public.founder_forecasts for each row execute function public.founder_capture_conversion();

drop trigger if exists founder_owner_guard on public.founder_daily_states;
create trigger founder_owner_guard before insert or update on public.founder_daily_states for each row execute function public.founder_owner_guard();

-- 7. Update Search Founder Records with Tier 3 Objects
create or replace function public.search_founder_records(search_query text, result_limit integer default 12)
returns table(entity_type text,entity_id uuid,title text,snippet text)
language sql stable security invoker set search_path=public as $$
 select r.entity_type,r.entity_id,r.title,r.snippet from (
select 'founder_risk-register'::text as entity_type,id as entity_id,title::text as title,'risk-register'::text as snippet,updated_at from public.operating_risks where user_id=auth.uid() and position(lower(trim(search_query)) in lower(title))>0
 union all
select 'founder_relationships'::text as entity_type,id as entity_id,name::text as title,'relationships'::text as snippet,updated_at from public.operating_relationships where user_id=auth.uid() and position(lower(trim(search_query)) in lower(name))>0
 union all
select 'founder_commitments'::text as entity_type,id as entity_id,title::text as title,'commitments'::text as snippet,updated_at from public.operating_commitments where user_id=auth.uid() and position(lower(trim(search_query)) in lower(title))>0
 union all
select 'founder_kpis'::text as entity_type,id as entity_id,name::text as title,'kpis'::text as snippet,updated_at from public.kpi_definitions where user_id=auth.uid() and position(lower(trim(search_query)) in lower(name))>0
 union all
select 'founder_wealth'::text as entity_type,id as entity_id,name::text as title,'wealth'::text as snippet,updated_at from public.personal_balance_entries where user_id=auth.uid() and position(lower(trim(search_query)) in lower(name))>0
 union all
select 'founder_assets'::text as entity_type,id as entity_id,name::text as title,'assets'::text as snippet,updated_at from public.asset_metadata where user_id=auth.uid() and position(lower(trim(search_query)) in lower(name))>0
 union all
select 'founder_training-plans'::text as entity_type,id as entity_id,name::text as title,'training-plans'::text as snippet,updated_at from public.training_plans where user_id=auth.uid() and position(lower(trim(search_query)) in lower(name))>0
 union all
select 'founder_businesses'::text as entity_type,id as entity_id,name::text as title,'businesses'::text as snippet,updated_at from public.companies where user_id=auth.uid() and position(lower(trim(search_query)) in lower(name))>0
 union all
select 'founder_infrastructure'::text,id,name::text,'infrastructure'::text,updated_at from public.operational_systems where user_id=auth.uid() and position(lower(trim(search_query)) in lower(name))>0
 union all
select 'founder_access'::text,id,person_label::text,'access'::text,updated_at from public.system_access_records where user_id=auth.uid() and position(lower(trim(search_query)) in lower(person_label))>0
 union all
select 'founder_system-health'::text,id,name::text,'system-health'::text,updated_at from public.system_health_checks where user_id=auth.uid() and position(lower(trim(search_query)) in lower(name))>0
 union all
select 'founder_mobility'::text,id,title::text,'mobility'::text,updated_at from public.trips where user_id=auth.uid() and position(lower(trim(search_query)) in lower(title))>0
 union all
select 'founder_documents'::text,id,label::text,'documents'::text,updated_at from public.personal_documents where user_id=auth.uid() and position(lower(trim(search_query)) in lower(label))>0
 union all
select 'founder_experiments'::text,id,name::text,'experiments'::text,updated_at from public.growth_experiments where user_id=auth.uid() and position(lower(trim(search_query)) in lower(name))>0
 union all
select 'founder_forecasts'::text,id,prediction::text,'forecasts'::text,updated_at from public.founder_forecasts where user_id=auth.uid() and position(lower(trim(search_query)) in lower(prediction))>0
 union all
select 'founder_content'::text,id,title::text,'content'::text,updated_at from public.content_items where user_id=auth.uid() and deleted_at is null and position(lower(trim(search_query)) in lower(title))>0
 ) r where length(trim(search_query)) between 2 and 240 order by r.updated_at desc,r.entity_id limit least(greatest(result_limit,1),30);
$$;
revoke all on function public.search_founder_records(text,integer) from public,anon;
grant execute on function public.search_founder_records(text,integer) to authenticated;

-- 8. Extend Lesson Proposal RPC to support Experiments and Founder Forecasts
create or replace function public.tier1_propose_lesson(source_kind text, source_key uuid, lesson_statement text) returns uuid language plpgsql security invoker set search_path=public as $$
declare mapped text; owned boolean; result uuid;
begin
 mapped:= ('{"decision":"decisions","issue":"quality_incidents","risk":"operating_risks","forecast":"forecast_evaluations","founder_forecast":"founder_forecasts","experiment":"growth_experiments","weekly":"retrospectives"}'::jsonb)->>source_kind;
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

-- 9. Lesson Permissions and Automatic Proposal Definer
grant select, insert, update, delete on public.operating_lessons to authenticated;
grant select, insert, update, delete on public.lesson_evidence_links to authenticated;

create or replace function public.founder_propose_lesson() returns trigger language plpgsql security definer set search_path = public as $$
declare lesson_text text; label text; lesson_id uuid;
begin
  if tg_table_name='decisions' then lesson_text:=new.lesson_learned; label:=new.title;
  elsif tg_table_name='quality_incidents' then
    if new.status not in ('resolved','closed','archived') then return new; end if;
    lesson_text:=new.preventive_action; label:=new.title;
  else
    if new.status <> 'completed' then return new; end if;
    lesson_text:=new.lesson; label:=new.name;
  end if;
  if nullif(trim(lesson_text),'') is null then return new; end if;
  insert into public.operating_lessons(user_id,title,statement,why_proposed,domain,status,confidence_state,source_table,source_id)
  values(new.user_id,label,lesson_text,'Recorded outcome review; review before applying to other situations.','operations','proposed','weak',tg_table_name,new.id)
  on conflict(user_id,source_table,source_id) where source_table is not null do nothing returning id into lesson_id;
  if lesson_id is not null then
    insert into public.lesson_evidence_links(lesson_id,user_id,source_table,source_id,source_quality,description)
    values(lesson_id,new.user_id,tg_table_name,new.id::text,'user_reported','Lesson recorded in the source outcome review.');
  end if;
  return new;
end $$;

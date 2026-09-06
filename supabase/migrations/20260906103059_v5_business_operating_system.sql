-- V5 Business Operating System. This migration is additive and intentionally unapplied.
-- Business entities remain owned by the authenticated workspace user and extend existing
-- clients, projects, invoices, payments, expenses, tasks, focus sessions, notes and files.

create table leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 240),
  company text,
  email text,
  phone text,
  source text not null default 'other' check (source in ('referral','instagram','website','email','whatsapp_manual','networking','existing_client','other')),
  status text not null default 'new' check (status in ('new','contacted','qualified','unqualified','converted','lost')),
  potential_value numeric(14,2) check (potential_value is null or potential_value >= 0),
  currency char(3) not null default 'MAD',
  notes text,
  last_contact_at timestamptz,
  next_follow_up_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table services (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 240),
  description text,
  category text,
  default_price numeric(14,2) check (default_price is null or default_price >= 0),
  currency char(3) not null default 'MAD',
  pricing_type text not null default 'custom' check (pricing_type in ('fixed','hourly','monthly','custom')),
  estimated_hours numeric(10,2) check (estimated_hours is null or estimated_hours > 0),
  active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,name)
);

create table opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references leads(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  title text not null check (length(trim(title)) between 1 and 240),
  stage text not null default 'new' check (stage in ('new','qualified','meeting','proposal','negotiation','won','lost')),
  estimated_value numeric(14,2) check (estimated_value is null or estimated_value >= 0),
  currency char(3) not null default 'MAD',
  probability smallint check (probability is null or probability between 0 and 100),
  expected_close_date date,
  source text,
  project_type text,
  next_action text,
  next_action_date date,
  lost_reason text check (lost_reason is null or lost_reason in ('price','no_response','competitor','timing','budget','not_a_fit','other')),
  won_at timestamptz,
  lost_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table opportunity_stage_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  from_stage text,
  to_stage text not null check (to_stage in ('new','qualified','meeting','proposal','negotiation','won','lost')),
  changed_at timestamptz not null default now(),
  note text
);

create table proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid references opportunities(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  title text not null check (length(trim(title)) between 1 and 240),
  proposal_number text,
  status text not null default 'draft' check (status in ('draft','sent','accepted','rejected','expired')),
  currency char(3) not null default 'MAD',
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  tax_amount numeric(14,2) not null default 0 check (tax_amount >= 0),
  total numeric(14,2) not null default 0 check (total >= 0),
  valid_until date,
  timeline text,
  notes text,
  terms text,
  sent_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,proposal_number)
);

create table proposal_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  proposal_id uuid not null references proposals(id) on delete cascade,
  service_id uuid references services(id) on delete set null,
  position smallint not null default 0 check (position >= 0),
  title text not null check (length(trim(title)) between 1 and 240),
  description text,
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  total numeric(14,2) not null default 0 check (total >= 0),
  estimated_hours numeric(10,2) check (estimated_hours is null or estimated_hours > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table proposal_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  proposal_id uuid not null references proposals(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  snapshot jsonb not null,
  reason text,
  created_at timestamptz not null default now(),
  unique(proposal_id,version_number)
);

create table scope_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  proposal_item_id uuid references proposal_items(id) on delete set null,
  service_id uuid references services(id) on delete set null,
  title text not null check (length(trim(title)) between 1 and 240),
  description text,
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  agreed_value numeric(14,2) check (agreed_value is null or agreed_value >= 0),
  estimated_hours numeric(10,2) check (estimated_hours is null or estimated_hours > 0),
  status text not null default 'not_started' check (status in ('not_started','in_progress','delivered','removed')),
  included boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table scope_change_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  description text not null check (length(trim(description)) between 1 and 5000),
  estimated_value numeric(14,2) check (estimated_value is null or estimated_value >= 0),
  currency char(3) not null default 'MAD',
  approved boolean,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table business_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_currency char(3) not null default 'MAD',
  internal_hourly_cost numeric(14,2) check (internal_hourly_cost is null or internal_hourly_cost >= 0),
  default_proposal_validity_days integer check (default_proposal_validity_days is null or default_proposal_validity_days between 1 and 365),
  default_tax_rate numeric(6,3) check (default_tax_rate is null or default_tax_rate between 0 and 100),
  business_name text,
  proposal_number_prefix text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table projects add column if not exists lead_id uuid references leads(id) on delete set null;
alter table projects add column if not exists opportunity_id uuid references opportunities(id) on delete set null;
alter table projects add column if not exists proposal_id uuid references proposals(id) on delete set null;
alter table expenses add column if not exists service_id uuid references services(id) on delete set null;
alter table tasks add column if not exists scope_item_id uuid references scope_items(id) on delete set null;
alter table tasks add column if not exists scope_status text check (scope_status is null or scope_status in ('in_scope','out_of_scope','unclear'));
alter table calendar_events add column if not exists opportunity_id uuid references opportunities(id) on delete set null;
alter table email_threads add column if not exists linked_lead_id uuid references leads(id) on delete set null;
alter table email_threads add column if not exists linked_opportunity_id uuid references opportunities(id) on delete set null;

alter table attachments drop constraint if exists attachments_entity_type_check;
alter table attachments add constraint attachments_entity_type_check check (entity_type in ('task','project','client','note','content','decision','invoice','lead','opportunity','proposal')) not valid;

create index leads_owner_status_idx on leads(user_id,status,next_follow_up_at) where archived_at is null;
create index opportunities_owner_stage_idx on opportunities(user_id,stage,expected_close_date) where archived_at is null;
create index opportunities_owner_client_idx on opportunities(user_id,client_id,updated_at desc) where archived_at is null;
create index opportunity_stage_history_owner_opportunity_idx on opportunity_stage_history(user_id,opportunity_id,changed_at desc);
create index proposals_owner_status_idx on proposals(user_id,status,valid_until) where archived_at is null;
create index proposals_owner_client_idx on proposals(user_id,client_id,updated_at desc) where archived_at is null;
create index proposal_items_owner_proposal_idx on proposal_items(user_id,proposal_id,position);
create index scope_items_owner_project_idx on scope_items(user_id,project_id,status);
create index scope_change_requests_owner_project_idx on scope_change_requests(user_id,project_id,requested_at desc);
create unique index projects_owner_opportunity_idx on projects(user_id,opportunity_id) where opportunity_id is not null and deleted_at is null;
create index tasks_owner_scope_idx on tasks(user_id,scope_item_id) where deleted_at is null;

do $$ declare t text; begin
  foreach t in array array['leads','services','opportunities','opportunity_stage_history','proposals','proposal_items','proposal_versions','scope_items','scope_change_requests','business_settings'] loop
    execute format('alter table %I enable row level security',t);
    execute format('create policy %I_owner_all on %I for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)',t,t);
    execute format('grant select,insert,update,delete on table %I to authenticated',t);
  end loop;
end $$;

do $$ declare t text; begin
  foreach t in array array['leads','services','opportunities','proposals','proposal_items','scope_items','scope_change_requests','business_settings'] loop
    execute format('create trigger %I_updated before update on %I for each row execute function set_updated_at()',t||'_v5',t);
  end loop;
end $$;

create or replace function validate_v5_owned_link() returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if tg_table_name='opportunities' then
    if new.lead_id is not null and not exists(select 1 from leads where id=new.lead_id and user_id=new.user_id) then raise exception 'Lead is not owned by this user.'; end if;
    if new.client_id is not null and not exists(select 1 from clients where id=new.client_id and user_id=new.user_id and deleted_at is null) then raise exception 'Client is not owned by this user.'; end if;
  elsif tg_table_name='proposals' then
    if new.opportunity_id is not null and not exists(select 1 from opportunities where id=new.opportunity_id and user_id=new.user_id) then raise exception 'Opportunity is not owned by this user.'; end if;
    if new.lead_id is not null and not exists(select 1 from leads where id=new.lead_id and user_id=new.user_id) then raise exception 'Lead is not owned by this user.'; end if;
    if new.client_id is not null and not exists(select 1 from clients where id=new.client_id and user_id=new.user_id and deleted_at is null) then raise exception 'Client is not owned by this user.'; end if;
  elsif tg_table_name='proposal_items' then
    if not exists(select 1 from proposals where id=new.proposal_id and user_id=new.user_id) then raise exception 'Proposal is not owned by this user.'; end if;
    if new.service_id is not null and not exists(select 1 from services where id=new.service_id and user_id=new.user_id) then raise exception 'Service is not owned by this user.'; end if;
  elsif tg_table_name='scope_items' then
    if not exists(select 1 from projects where id=new.project_id and user_id=new.user_id and deleted_at is null) then raise exception 'Project is not owned by this user.'; end if;
    if new.proposal_item_id is not null and not exists(select 1 from proposal_items where id=new.proposal_item_id and user_id=new.user_id) then raise exception 'Proposal item is not owned by this user.'; end if;
    if new.service_id is not null and not exists(select 1 from services where id=new.service_id and user_id=new.user_id) then raise exception 'Service is not owned by this user.'; end if;
  elsif tg_table_name='scope_change_requests' then
    if not exists(select 1 from projects where id=new.project_id and user_id=new.user_id and deleted_at is null) then raise exception 'Project is not owned by this user.'; end if;
  elsif tg_table_name='opportunity_stage_history' then
    if not exists(select 1 from opportunities where id=new.opportunity_id and user_id=new.user_id) then raise exception 'Opportunity is not owned by this user.'; end if;
  elsif tg_table_name='proposal_versions' then
    if not exists(select 1 from proposals where id=new.proposal_id and user_id=new.user_id) then raise exception 'Proposal is not owned by this user.'; end if;
  end if;
  return new;
end $$;

create trigger opportunities_owned_links_v5 before insert or update on opportunities for each row execute function validate_v5_owned_link();
create trigger proposal_owned_links_v5 before insert or update on proposals for each row execute function validate_v5_owned_link();
create trigger proposal_items_owned_links_v5 before insert or update on proposal_items for each row execute function validate_v5_owned_link();
create trigger scope_items_owned_links_v5 before insert or update on scope_items for each row execute function validate_v5_owned_link();
create trigger scope_changes_owned_links_v5 before insert or update on scope_change_requests for each row execute function validate_v5_owned_link();
create trigger opportunity_history_owned_links_v5 before insert or update on opportunity_stage_history for each row execute function validate_v5_owned_link();
create trigger proposal_versions_owned_links_v5 before insert or update on proposal_versions for each row execute function validate_v5_owned_link();

create or replace function enforce_attachment_entity_owner() returns trigger language plpgsql security invoker set search_path=public as $$
declare entity_table text; owned boolean;
begin
  if tg_op='UPDATE' and new.user_id=old.user_id and new.entity_type=old.entity_type and new.entity_id=old.entity_id then return new; end if;
  entity_table:=case new.entity_type when 'task' then 'tasks' when 'project' then 'projects' when 'client' then 'clients' when 'note' then 'notes' when 'content' then 'content_items' when 'decision' then 'decisions' when 'invoice' then 'invoices' when 'lead' then 'leads' when 'opportunity' then 'opportunities' when 'proposal' then 'proposals' else null end;
  if entity_table is null then raise exception 'Unsupported attachment entity type.'; end if;
  if new.entity_type in ('lead','opportunity','proposal') then
    execute format('select exists(select 1 from %I where id=$1 and user_id=$2 and archived_at is null)',entity_table) into owned using new.entity_id,new.user_id;
  else
    execute format('select exists(select 1 from %I where id=$1 and user_id=$2 and deleted_at is null)',entity_table) into owned using new.entity_id,new.user_id;
  end if;
  if not owned then raise exception 'Attachment target is not owned by this user.'; end if;
  return new;
end $$;

-- Search remains an authenticated, owner-scoped workspace operation.
create or replace function search_workspace(search_query text,result_limit int default 30)
returns table(entity_type text,entity_id uuid,title text,snippet text,rank real,updated_at timestamptz)
language sql security invoker set search_path=public as $$
  select * from (
    select entity_type,entity_id,title,snippet,rank,updated_at from search_workspace_sources(search_query,result_limit)
    union all select 'memory',id,title,left(summary,240),0.65::real,memory_items.updated_at from memory_items where user_id=auth.uid() and archived_at is null and (title ilike '%'||search_query||'%' or summary ilike '%'||search_query||'%')
    union all select 'recommendation',id,label,left(reason,240),0.55::real,recommended_at from daily_recommendations where user_id=auth.uid() and resolved_at is null and (label ilike '%'||search_query||'%' or reason ilike '%'||search_query||'%')
    union all select 'risk',id,title,left(reason,240),0.50::real,created_at from risk_snapshots where user_id=auth.uid() and resolved_at is null and (title ilike '%'||search_query||'%' or reason ilike '%'||search_query||'%')
    union all select 'weekly_review',id,'Weekly review · '||period_start::text,left(summary::text,240),0.40::real,updated_at from weekly_reviews where user_id=auth.uid() and summary::text ilike '%'||search_query||'%'
    union all select 'lead',id,name,concat_ws(' · ',company,email),1::real,updated_at from leads where user_id=auth.uid() and archived_at is null and (name ilike '%'||search_query||'%' or coalesce(company,'') ilike '%'||search_query||'%')
    union all select 'opportunity',id,title,concat_ws(' · ',stage,next_action),1::real,updated_at from opportunities where user_id=auth.uid() and archived_at is null and title ilike '%'||search_query||'%'
    union all select 'proposal',id,coalesce(proposal_number,title),title,1::real,updated_at from proposals where user_id=auth.uid() and archived_at is null and (title ilike '%'||search_query||'%' or coalesce(proposal_number,'') ilike '%'||search_query||'%')
    union all select 'service',id,name,coalesce(description,''),1::real,updated_at from services where user_id=auth.uid() and archived_at is null and name ilike '%'||search_query||'%'
  ) results(entity_type,entity_id,title,snippet,rank,updated_at)
  order by results.rank desc,results.updated_at desc limit least(result_limit,50)
$$;
revoke all on function validate_v5_owned_link() from public,anon,authenticated;
revoke all on function enforce_attachment_entity_owner() from public,anon,authenticated;
revoke all on function search_workspace(text,int) from public,anon;
grant execute on function search_workspace(text,int) to authenticated;

-- Existing records gain V5 links without weakening the owner boundary.
create or replace function validate_v5_existing_entity_links() returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if tg_table_name='projects' then
    if new.lead_id is not null and not exists(select 1 from leads where id=new.lead_id and user_id=new.user_id) then raise exception 'Lead is not owned by this user.'; end if;
    if new.opportunity_id is not null and not exists(select 1 from opportunities where id=new.opportunity_id and user_id=new.user_id) then raise exception 'Opportunity is not owned by this user.'; end if;
    if new.proposal_id is not null and not exists(select 1 from proposals where id=new.proposal_id and user_id=new.user_id) then raise exception 'Proposal is not owned by this user.'; end if;
  elsif tg_table_name='tasks' then
    if new.scope_item_id is not null and not exists(select 1 from scope_items where id=new.scope_item_id and user_id=new.user_id) then raise exception 'Scope item is not owned by this user.'; end if;
  elsif tg_table_name='expenses' then
    if new.service_id is not null and not exists(select 1 from services where id=new.service_id and user_id=new.user_id) then raise exception 'Service is not owned by this user.'; end if;
  elsif tg_table_name='calendar_events' then
    if new.opportunity_id is not null and not exists(select 1 from opportunities where id=new.opportunity_id and user_id=new.user_id) then raise exception 'Opportunity is not owned by this user.'; end if;
  elsif tg_table_name='email_threads' then
    if new.linked_lead_id is not null and not exists(select 1 from leads where id=new.linked_lead_id and user_id=new.user_id) then raise exception 'Lead is not owned by this user.'; end if;
    if new.linked_opportunity_id is not null and not exists(select 1 from opportunities where id=new.linked_opportunity_id and user_id=new.user_id) then raise exception 'Opportunity is not owned by this user.'; end if;
  end if;
  return new;
end $$;

create trigger projects_v5_owned_links before insert or update on projects for each row execute function validate_v5_existing_entity_links();
create trigger tasks_v5_owned_links before insert or update on tasks for each row execute function validate_v5_existing_entity_links();
create trigger expenses_v5_owned_links before insert or update on expenses for each row execute function validate_v5_existing_entity_links();
create trigger calendar_events_v5_owned_links before insert or update on calendar_events for each row execute function validate_v5_existing_entity_links();
create trigger email_threads_v5_owned_links before insert or update on email_threads for each row execute function validate_v5_existing_entity_links();

-- A won opportunity converts once. The unique project opportunity index makes retries idempotent.
create or replace function convert_won_opportunity(p_opportunity_id uuid, p_create_client boolean default true, p_project_name text default null)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_user_id uuid:=auth.uid(); v_opportunity opportunities%rowtype; v_lead leads%rowtype; v_client_id uuid; v_project projects%rowtype; v_proposal_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  select * into v_opportunity from opportunities where id=p_opportunity_id and user_id=v_user_id and archived_at is null for update;
  if not found then raise exception 'Opportunity is unavailable.'; end if;
  if v_opportunity.stage<>'won' then raise exception 'Only a won opportunity can be converted.'; end if;
  select * into v_project from projects where opportunity_id=v_opportunity.id and user_id=v_user_id and deleted_at is null limit 1;
  if found then return jsonb_build_object('project_id',v_project.id,'client_id',v_project.client_id,'already_converted',true); end if;
  v_client_id:=v_opportunity.client_id;
  if v_opportunity.lead_id is not null then select * into v_lead from leads where id=v_opportunity.lead_id and user_id=v_user_id; end if;
  if v_client_id is null and p_create_client and v_lead.id is not null then
    insert into clients(user_id,name,company,email,phone,notes,status) values(v_user_id,v_lead.name,v_lead.company,v_lead.email,v_lead.phone,v_lead.notes,'active') returning id into v_client_id;
    update leads set status='converted' where id=v_lead.id and user_id=v_user_id;
  end if;
  select id into v_proposal_id from proposals where opportunity_id=v_opportunity.id and user_id=v_user_id and status='accepted' and archived_at is null order by accepted_at desc nulls last,updated_at desc limit 1;
  insert into projects(user_id,name,status,client_id,lead_id,opportunity_id,proposal_id,value_amount,currency)
  values(v_user_id,coalesce(nullif(trim(p_project_name),''),v_opportunity.title),'planning',v_client_id,v_opportunity.lead_id,v_opportunity.id,v_proposal_id,v_opportunity.estimated_value,v_opportunity.currency)
  returning * into v_project;
  insert into action_audit_log(user_id,actor,action_type,entity_type,entity_id,summary,metadata)
  values(v_user_id,'user','opportunity_converted','opportunity',v_opportunity.id,'Converted a won opportunity into a project.',jsonb_build_object('project_id',v_project.id,'client_id',v_client_id));
  return jsonb_build_object('project_id',v_project.id,'client_id',v_client_id,'already_converted',false);
end $$;
revoke all on function validate_v5_existing_entity_links() from public,anon,authenticated;
revoke all on function convert_won_opportunity(uuid,boolean,text) from public,anon;
grant execute on function convert_won_opportunity(uuid,boolean,text) to authenticated;

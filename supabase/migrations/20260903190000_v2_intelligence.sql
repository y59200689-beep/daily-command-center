-- Daily Command Center V2. Additive only: existing V1 columns and records remain valid.

alter table invoices add column if not exists title text;
alter table invoices add column if not exists description text;
alter table invoices add column if not exists subtotal numeric(14,2) not null default 0 check (subtotal >= 0);
alter table invoices add column if not exists tax_amount numeric(14,2) not null default 0 check (tax_amount >= 0);
alter table invoices add column if not exists discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0);
alter table invoices add column if not exists total_amount numeric(14,2) not null default 0 check (total_amount >= 0);
alter table invoices add column if not exists amount_paid numeric(14,2) not null default 0 check (amount_paid >= 0);
alter table invoices add column if not exists amount_remaining numeric(14,2) not null default 0 check (amount_remaining >= 0);
alter table invoices add column if not exists issue_date date;
alter table invoices add column if not exists external_reference text;
alter table invoices add column if not exists archived_at timestamptz;
update invoices set subtotal=amount,total_amount=amount,amount_remaining=greatest(amount-coalesce(amount_paid,0),0),issue_date=coalesce(issue_date,invoice_date) where total_amount=0 and amount>0;
alter table invoices drop constraint if exists invoices_status_check;
alter table invoices add constraint invoices_status_check check (status in ('draft','sent','partial','paid','overdue','cancelled'));
alter table invoices add constraint invoices_payment_balance_check check (amount_paid <= total_amount and amount_remaining = total_amount - amount_paid);
alter table invoices add constraint invoices_paid_status_check check (status <> 'paid' or (total_amount > 0 and amount_remaining = 0));
create unique index if not exists invoices_owner_number_idx on invoices(user_id,invoice_number) where invoice_number is not null and deleted_at is null;

alter table notes add column if not exists client_id uuid references clients(id) on delete set null;

create table payments (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references invoices(id) on delete restrict, client_id uuid references clients(id) on delete set null,
  project_id uuid references projects(id) on delete set null, amount numeric(14,2) not null check(amount > 0),
  currency char(3) not null default 'MAD', payment_date date not null default current_date,
  payment_method text, reference text, notes text, created_at timestamptz not null default now(), deleted_at timestamptz
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, provider text, amount numeric(14,2) not null check(amount >= 0), currency char(3) not null default 'MAD',
  billing_cycle text not null check(billing_cycle in ('monthly','quarterly','yearly','custom')),
  next_billing_date date, project_id uuid references projects(id) on delete set null, category text,
  status text not null default 'active' check(status in ('active','paused','cancelled')), notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

create table expenses (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references projects(id) on delete set null, client_id uuid references clients(id) on delete set null,
  category text not null check(category in ('Software','Hosting','Advertising','Design','Travel','Equipment','Contractors','Other')),
  vendor text, description text not null, amount numeric(14,2) not null check(amount >= 0), currency char(3) not null default 'MAD',
  expense_date date not null, recurring boolean not null default false, subscription_id uuid references subscriptions(id) on delete set null,
  receipt_url text, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

create table campaigns (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, client_id uuid not null references clients(id) on delete restrict, project_id uuid references projects(id) on delete set null,
  objective text, start_date date, end_date date, status text not null default 'planning' check(status in ('planning','active','paused','completed','archived')),
  description text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  check(end_date is null or start_date is null or end_date >= start_date)
);

alter table content_items add column if not exists campaign_id uuid references campaigns(id) on delete set null;
alter table content_items add column if not exists priority task_priority not null default 'none';
alter table content_items add column if not exists creative_brief text;
alter table content_items add column if not exists creative_direction text;
alter table content_items add column if not exists cta text;
alter table content_items add column if not exists scheduled_at timestamptz;
alter table content_items add column if not exists published_at timestamptz;
alter table content_items add column if not exists due_date date;
alter table content_items add column if not exists approval_status text not null default 'not_required' check(approval_status in ('not_required','pending','changes_requested','approved'));
alter table content_items add column if not exists approval_notes text;
alter table content_items add column if not exists approved_at timestamptz;
alter table content_items add column if not exists approved_by_name text;
alter table content_items add column if not exists performance_notes text;
alter table content_items add column if not exists prompt_id uuid references prompts(id) on delete set null;
update content_items set creative_brief=brief where creative_brief is null and brief is not null;
update content_items set status='idea' where status='ideas';
alter table content_items add constraint content_items_v2_status_check check(status in ('idea','brief','copy','designing','review','approved','scheduled','published','archived')) not valid;

create table content_assets (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  content_item_id uuid not null references content_items(id) on delete cascade, asset_type text not null check(asset_type in ('upload','drive','reference','link','copy')),
  label text not null, url text, storage_path text, mime_type text, size_bytes bigint check(size_bytes is null or size_bytes >= 0),
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), deleted_at timestamptz
);

alter table prompts add column if not exists prompt_text text;
alter table prompts add column if not exists last_used_at timestamptz;
alter table prompts add column if not exists rating smallint check(rating between 1 and 5);
alter table prompts add column if not exists client_id uuid references clients(id) on delete set null;
alter table prompts add column if not exists project_id uuid references projects(id) on delete set null;
alter table prompts add column if not exists campaign_id uuid references campaigns(id) on delete set null;
alter table prompts add column if not exists content_item_id uuid references content_items(id) on delete set null;
update prompts set prompt_text=prompt where prompt_text is null;

create table prompt_versions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  prompt_id uuid not null references prompts(id) on delete cascade, version_number integer not null check(version_number > 0),
  prompt_text text not null, change_note text, created_at timestamptz not null default now(), unique(prompt_id,version_number)
);
create table prompt_variables (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  prompt_id uuid not null references prompts(id) on delete cascade, name text not null check(name ~ '^[a-z][a-z0-9_]*$'),
  label text not null, default_value text, required boolean not null default true, created_at timestamptz not null default now(), unique(prompt_id,name)
);

alter table decisions add column if not exists client_id uuid references clients(id) on delete set null;
alter table decisions add column if not exists impact text not null default 'medium' check(impact in ('low','medium','high','critical'));
alter table decisions add column if not exists confidence text not null default 'medium' check(confidence in ('low','medium','high'));
alter table decisions add column if not exists status text not null default 'active' check(status in ('active','review_due','superseded','reversed','archived'));
alter table decisions add column if not exists review_date date;
alter table decisions add column if not exists superseded_by_decision_id uuid references decisions(id) on delete set null;
create table decision_alternatives (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  decision_id uuid not null references decisions(id) on delete cascade, title text not null, reason_rejected text,
  created_at timestamptz not null default now(), deleted_at timestamptz
);

alter table fitness_activities add column if not exists date date;
alter table fitness_activities add column if not exists duration_minutes integer check(duration_minutes is null or duration_minutes > 0);
alter table fitness_activities add column if not exists distance_km numeric(10,2) check(distance_km is null or distance_km >= 0);
alter table fitness_activities add column if not exists calories integer check(calories is null or calories >= 0);
alter table fitness_activities add column if not exists effort text check(effort in ('easy','moderate','hard'));
alter table fitness_activities add column if not exists external_id text;
update fitness_activities set date=activity_date,duration_minutes=round(duration_seconds/60.0),distance_km=distance_meters/1000 where date is null;
create unique index if not exists fitness_external_identity_idx on fitness_activities(user_id,source,external_id) where external_id is not null;
create table fitness_targets (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  activity_type text not null, target_type text not null check(target_type in ('sessions','distance_km','duration_minutes')),
  target_value numeric(12,2) not null check(target_value > 0), period text not null default 'week' check(period in ('week','month')),
  active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

alter table projects add column if not exists value_amount numeric(14,2) check(value_amount is null or value_amount >= 0);
alter table projects add column if not exists currency char(3) not null default 'MAD';
alter table focus_sessions add column if not exists project_id uuid references projects(id) on delete set null;

create table integration_connections (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check(provider in ('gmail','google_drive','github','strava')), status integration_status not null default 'disconnected',
  account_identifier text, access_token_encrypted bytea, refresh_token_encrypted bytea, expires_at timestamptz,
  scopes text[] not null default '{}', provider_metadata jsonb not null default '{}'::jsonb, last_synced_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,provider)
);
create table external_references (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null, external_id text not null, entity_type text not null, entity_id uuid not null,
  title text, url text, metadata jsonb not null default '{}'::jsonb, external_updated_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,provider,external_id,entity_type,entity_id)
);
create table notification_preferences (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  category text not null, enabled boolean not null default true, minimum_severity text not null default 'medium' check(minimum_severity in ('low','medium','high','critical')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,category)
);

create or replace function record_invoice_payment(
  payment_invoice_id uuid, payment_amount numeric, payment_date_value date default current_date,
  payment_method_value text default null, payment_reference text default null, payment_notes text default null
) returns public.payments language plpgsql security definer set search_path='' as $$
declare owned_invoice public.invoices; saved_payment public.payments; new_paid numeric;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if payment_amount <= 0 then raise exception 'Payment amount must be positive.'; end if;
  select * into owned_invoice from public.invoices where id=payment_invoice_id and user_id=auth.uid() and deleted_at is null for update;
  if not found then raise exception 'Invoice not found.'; end if;
  if owned_invoice.status='cancelled' then raise exception 'Cancelled invoices cannot receive payments.'; end if;
  if payment_amount > owned_invoice.amount_remaining then raise exception 'Payment exceeds the remaining balance.'; end if;
  perform set_config('dcc.recording_payment','on',true);
  insert into public.payments(user_id,invoice_id,client_id,project_id,amount,currency,payment_date,payment_method,reference,notes)
  values(auth.uid(),owned_invoice.id,owned_invoice.client_id,owned_invoice.project_id,payment_amount,owned_invoice.currency,payment_date_value,payment_method_value,payment_reference,payment_notes)
  returning * into saved_payment;
  new_paid:=owned_invoice.amount_paid+payment_amount;
  update public.invoices set amount_paid=new_paid,amount_remaining=total_amount-new_paid,
    status=case when new_paid=total_amount then 'paid' else 'partial' end,
    paid_at=case when new_paid=total_amount then payment_date_value::timestamptz else null end
  where id=owned_invoice.id;
  return saved_payment;
end $$;

create or replace function supersede_decision(
  previous_decision_id uuid,
  replacement_title text,
  replacement_decision text,
  replacement_reasoning text default null,
  replacement_impact text default 'medium',
  replacement_confidence text default 'medium',
  replacement_review_date date default null
) returns decisions language plpgsql security invoker set search_path=public as $$
declare previous decisions; replacement decisions;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if nullif(trim(replacement_title),'') is null or nullif(trim(replacement_decision),'') is null then
    raise exception 'A title and outcome are required.';
  end if;
  select * into previous from decisions
    where id=previous_decision_id and user_id=auth.uid() and deleted_at is null
    for update;
  if not found then raise exception 'Decision not found.'; end if;
  if previous.status='superseded' then raise exception 'Decision has already been superseded.'; end if;
  insert into decisions(user_id,title,decision,reasoning,project_id,client_id,impact,confidence,status,decision_date,review_date)
  values(auth.uid(),trim(replacement_title),trim(replacement_decision),replacement_reasoning,previous.project_id,previous.client_id,replacement_impact,replacement_confidence,'active',current_date,replacement_review_date)
  returning * into replacement;
  update decisions set status='superseded',superseded_by_decision_id=replacement.id where id=previous.id;
  return replacement;
end $$;

create index if not exists invoices_due_status_idx on invoices(user_id,due_date,status) where deleted_at is null;
create index if not exists invoices_client_project_idx on invoices(user_id,client_id,project_id) where deleted_at is null;
create index if not exists payments_invoice_date_idx on payments(user_id,invoice_id,payment_date desc) where deleted_at is null;
create index if not exists expenses_date_idx on expenses(user_id,expense_date desc) where deleted_at is null;
create index if not exists expenses_project_idx on expenses(user_id,project_id) where deleted_at is null;
create index if not exists subscriptions_renewal_idx on subscriptions(user_id,next_billing_date,status) where deleted_at is null;
create index if not exists campaigns_deadline_idx on campaigns(user_id,end_date,status) where deleted_at is null;
create index if not exists content_status_due_idx on content_items(user_id,status,due_date) where deleted_at is null;
create index if not exists content_campaign_idx on content_items(user_id,campaign_id) where deleted_at is null;
create index if not exists content_publish_idx on content_items(user_id,publish_date desc) where deleted_at is null;
create index if not exists decisions_review_idx on decisions(user_id,review_date,status) where deleted_at is null;
create index if not exists decisions_project_idx on decisions(user_id,project_id,decision_date desc) where deleted_at is null;
create index if not exists decisions_client_idx on decisions(user_id,client_id,decision_date desc) where deleted_at is null;
create index if not exists fitness_date_idx on fitness_activities(user_id,date desc) where deleted_at is null;
create index if not exists focus_project_date_idx on focus_sessions(user_id,project_id,started_at desc);
create index if not exists focus_owner_date_idx on focus_sessions(user_id,started_at desc);
create index if not exists external_refs_entity_idx on external_references(user_id,entity_type,entity_id);
create index if not exists notes_client_idx on notes(user_id,client_id,updated_at desc) where deleted_at is null;
create index if not exists payments_client_idx on payments(user_id,client_id,payment_date desc) where deleted_at is null;
create index if not exists payments_project_idx on payments(user_id,project_id,payment_date desc) where deleted_at is null;

do $$ declare t text; begin foreach t in array array['subscriptions','expenses','campaigns','content_assets','prompt_versions','prompt_variables','decision_alternatives','fitness_targets','integration_connections','external_references','notification_preferences'] loop execute format('alter table %I enable row level security',t); execute format('create policy %I_owner_all on %I for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()))',t,t); execute format('grant select,insert,update,delete on table %I to authenticated',t); end loop; end $$;
do $$ declare t text; begin foreach t in array array['profiles','clients','client_contacts','goals','projects','tasks','tags','task_tags','task_dependencies','milestones','followups','waiting_items','notes','ideas','decisions','prompts','note_links','goal_links','calendar_events','focus_sessions','invoices','finance_transactions','content_items','fitness_activities','integrations','notifications','activity_log','daily_plans','daily_priorities','daily_reviews','attachments','external_links','calendar_sync_state','ai_conversations','ai_messages','inbox_items'] loop execute format('grant select,insert,update,delete on table %I to authenticated',t); end loop; end $$;
alter table payments enable row level security;
create policy payments_owner_read on payments for select to authenticated using(user_id=(select auth.uid()));
grant select on table payments to authenticated;
revoke insert,update,delete on table payments from authenticated;
do $$ declare t text; begin foreach t in array array['subscriptions','expenses','campaigns','fitness_targets','integration_connections','external_references','notification_preferences'] loop execute format('create trigger %I_updated before update on %I for each row execute function set_updated_at()',t,t); end loop; end $$;

-- Defense in depth: a known UUID must never allow a relationship across owners.
create or replace function enforce_owned_references() returns trigger language plpgsql security invoker set search_path=public as $$
declare i integer; reference_id uuid; owned boolean;
begin
  i:=0;
  while i<array_length(tg_argv,1) loop
    reference_id:=nullif(to_jsonb(new)->>tg_argv[i],'')::uuid;
    if reference_id is not null then
      execute format('select exists(select 1 from %I where id=$1 and user_id=$2)',tg_argv[i+1]) into owned using reference_id,new.user_id;
      if not owned then raise exception 'Referenced % is not owned by this user.',tg_argv[i]; end if;
    end if;
    i:=i+2;
  end loop;
  return new;
end $$;
create or replace function protect_invoice_payment_fields() returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if tg_op='INSERT' and new.amount_paid<>0 then raise exception 'Payments must be recorded through record_invoice_payment.'; end if;
  if tg_op='UPDATE' and new.amount_paid<>old.amount_paid and current_setting('dcc.recording_payment',true)<>'on' then raise exception 'Payments must be recorded through record_invoice_payment.'; end if;
  return new;
end $$;
create trigger invoices_protect_payment_fields before insert or update on invoices for each row execute function protect_invoice_payment_fields();
create trigger invoices_owned_links before insert or update on invoices for each row execute function enforce_owned_references('client_id','clients','project_id','projects');
create trigger payments_owned_links before insert or update on payments for each row execute function enforce_owned_references('invoice_id','invoices','client_id','clients','project_id','projects');
create trigger expenses_owned_links before insert or update on expenses for each row execute function enforce_owned_references('client_id','clients','project_id','projects','subscription_id','subscriptions');
create trigger subscriptions_owned_links before insert or update on subscriptions for each row execute function enforce_owned_references('project_id','projects');
create trigger campaigns_owned_links before insert or update on campaigns for each row execute function enforce_owned_references('client_id','clients','project_id','projects');
create trigger content_owned_links before insert or update on content_items for each row execute function enforce_owned_references('client_id','clients','project_id','projects','campaign_id','campaigns','prompt_id','prompts');
create trigger prompts_owned_links before insert or update on prompts for each row execute function enforce_owned_references('client_id','clients','project_id','projects','campaign_id','campaigns','content_item_id','content_items');
create trigger decisions_owned_links before insert or update on decisions for each row execute function enforce_owned_references('client_id','clients','project_id','projects','superseded_by_decision_id','decisions');
create trigger tasks_owned_links before insert or update on tasks for each row execute function enforce_owned_references('client_id','clients','project_id','projects','goal_id','goals');
create trigger notes_owned_links before insert or update on notes for each row execute function enforce_owned_references('client_id','clients');
create trigger content_assets_owned_links before insert or update on content_assets for each row execute function enforce_owned_references('content_item_id','content_items');
create trigger prompt_versions_owned_links before insert or update on prompt_versions for each row execute function enforce_owned_references('prompt_id','prompts');
create trigger prompt_variables_owned_links before insert or update on prompt_variables for each row execute function enforce_owned_references('prompt_id','prompts');
create trigger decision_alternatives_owned_links before insert or update on decision_alternatives for each row execute function enforce_owned_references('decision_id','decisions');

revoke all on function record_invoice_payment(uuid,numeric,date,text,text,text) from public,anon;
grant execute on function record_invoice_payment(uuid,numeric,date,text,text,text) to authenticated;
revoke all on function supersede_decision(uuid,text,text,text,text,text,date) from public,anon;
grant execute on function supersede_decision(uuid,text,text,text,text,text,date) to authenticated;
revoke all on function enforce_owned_references() from public,anon,authenticated;
revoke all on function protect_invoice_payment_fields() from public,anon,authenticated;

create or replace function search_workspace(search_query text,result_limit int default 30) returns table(entity_type text,entity_id uuid,title text,snippet text,rank real,updated_at timestamptz) language sql security invoker set search_path=public as $$
  select * from (
    select 'task',id,title,coalesce(description,''),1::real,tasks.updated_at from tasks where user_id=auth.uid() and deleted_at is null and title ilike '%'||search_query||'%'
    union all select 'project',id,name,coalesce(description,''),1::real,projects.updated_at from projects where user_id=auth.uid() and deleted_at is null and name ilike '%'||search_query||'%'
    union all select 'note',id,title,left(content,240),1::real,notes.updated_at from notes where user_id=auth.uid() and deleted_at is null and title ilike '%'||search_query||'%'
    union all select 'invoice',id,coalesce(title,invoice_number,'Invoice'),coalesce(description,''),1::real,invoices.updated_at from invoices where user_id=auth.uid() and deleted_at is null and (coalesce(title,'') ilike '%'||search_query||'%' or coalesce(invoice_number,'') ilike '%'||search_query||'%')
    union all select 'payment',id,coalesce(reference,'Payment'),coalesce(notes,''),1::real,created_at from payments where user_id=auth.uid() and deleted_at is null and coalesce(reference,'') ilike '%'||search_query||'%'
    union all select 'expense',id,description,coalesce(vendor,''),1::real,updated_at from expenses where user_id=auth.uid() and deleted_at is null and (description ilike '%'||search_query||'%' or coalesce(vendor,'') ilike '%'||search_query||'%')
    union all select 'subscription',id,name,coalesce(provider,''),1::real,updated_at from subscriptions where user_id=auth.uid() and deleted_at is null and name ilike '%'||search_query||'%'
    union all select 'campaign',id,name,coalesce(description,''),1::real,updated_at from campaigns where user_id=auth.uid() and deleted_at is null and name ilike '%'||search_query||'%'
    union all select 'content',id,title,coalesce(caption,''),1::real,updated_at from content_items where user_id=auth.uid() and deleted_at is null and title ilike '%'||search_query||'%'
    union all select 'prompt',id,title,coalesce(description,''),1::real,updated_at from prompts where user_id=auth.uid() and deleted_at is null and title ilike '%'||search_query||'%'
    union all select 'decision',id,title,left(decision,240),1::real,updated_at from decisions where user_id=auth.uid() and deleted_at is null and title ilike '%'||search_query||'%'
    union all select 'fitness',id,activity_type,coalesce(notes,''),1::real,created_at from fitness_activities where user_id=auth.uid() and deleted_at is null and activity_type ilike '%'||search_query||'%'
  ) as results(
    entity_type,
    entity_id,
    title,
    snippet,
    rank,
    updated_at
  ) order by results.rank desc,results.updated_at desc limit least(result_limit,50)
$$;
revoke all on function search_workspace(text,int) from public,anon;
grant execute on function search_workspace(text,int) to authenticated;

create policy attachments_storage_delete_v2 on storage.objects for delete to authenticated
using(bucket_id='attachments' and (storage.foldername(name))[1]=(select auth.uid())::text);

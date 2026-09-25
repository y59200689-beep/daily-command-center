-- Tier 2B: continuity metadata on the canonical system registry; local activation only.
alter table public.operational_systems
 add column project_id uuid references public.projects(id),
 add column risk_id uuid references public.operating_risks(id),
 add column billing_contact text check(length(billing_contact)<=240),
 add column billing_frequency text check(billing_frequency in ('monthly','quarterly','annual','usage','one_time','unknown')),
 add column cost numeric check(cost>=0),
 add column currency text check(currency ~ '^[A-Z]{3}$'),
 add column backup_provider text check(length(backup_provider)<=240),
 add column domain_name text check(length(domain_name)<=240),
 add column registrar text check(length(registrar)<=240),
 add column dns_owner text check(length(dns_owner)<=240),
 add column production_dependency boolean not null default false,
 add column branch text check(length(branch)<=240),
 add column deployment_provider text check(length(deployment_provider)<=240),
 add column current_version text check(length(current_version)<=240),
 add column migration_status text check(migration_status in ('unknown','current','pending','blocked'));
create table public.system_health_checks (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 system_id uuid not null references public.operational_systems(id),
 component text not null check(component in ('production','database','authentication','payments','external_api','webhook','cron','storage','monitoring','backup','migration')),
 name text not null check(length(trim(name)) between 1 and 240),
 status text not null default 'unknown' check(status in ('unknown','ok','attention','failed')),
 reason text not null check(length(trim(reason)) between 1 and 10000),
 checked_on date not null, source text not null default 'manual' check(source in ('manual','integration')),
 source_reference text check(length(source_reference)<=240), integration_id uuid references public.integrations(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(source<>'integration' or (integration_id is not null and source_reference is not null))
);
alter table public.system_health_checks enable row level security;
grant select,insert,update,delete on public.system_health_checks to authenticated;
revoke all on public.system_health_checks from anon;
create policy system_health_checks_owner on public.system_health_checks for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create index system_health_owner_date on public.system_health_checks(user_id,system_id,checked_on desc);
create function public.tier2_owned_links() returns trigger language plpgsql set search_path=public as $$
declare refs jsonb; pair record; target uuid; owned boolean;
begin
 if to_jsonb(new)::text ~ '(sb_secret_[A-Za-z0-9_-]{12,}|ghp_[A-Za-z0-9]{16,}|sk_live_[A-Za-z0-9]{16,}|-----BEGIN [A-Z ]*PRIVATE KEY|eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]+\.)' then raise exception 'Store continuity metadata, not credentials' using errcode='23514'; end if;
 if tg_op='UPDATE' and new.user_id<>old.user_id then raise exception 'Owner cannot change' using errcode='23514'; end if;
 refs:=case tg_table_name when 'operational_systems' then '{"project_id":"projects","risk_id":"operating_risks"}'::jsonb when 'system_health_checks' then '{"system_id":"operational_systems","integration_id":"integrations"}'::jsonb else '{}'::jsonb end;
 for pair in select * from jsonb_each_text(refs) loop
  target:=nullif(to_jsonb(new)->>pair.key,'')::uuid;
  if target is not null then
   execute format('select exists(select 1 from public.%I where id=$1 and user_id=$2)',pair.value) into owned using target,new.user_id;
   if not owned then raise exception 'Related record must belong to owner' using errcode='23514'; end if;
  end if;
 end loop;
 new.updated_at:=now();return new;
end $$;
revoke all on function public.tier2_owned_links() from public,anon,authenticated;
create trigger tier2_owned_links before insert or update on public.operational_systems for each row execute function public.tier2_owned_links();
create trigger tier2_owned_links before insert or update on public.system_health_checks for each row execute function public.tier2_owned_links();
create trigger founder_audit_change after insert or update or delete on public.system_health_checks for each row execute function public.founder_audit_change();

create trigger tier2_owned_links before insert or update on public.system_access_records for each row execute function public.tier2_owned_links();

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
 ) r where length(trim(search_query)) between 2 and 240 order by r.updated_at desc,r.entity_id limit least(greatest(result_limit,1),30);
$$;
revoke all on function public.search_founder_records(text,integer) from public,anon;
grant execute on function public.search_founder_records(text,integer) to authenticated;

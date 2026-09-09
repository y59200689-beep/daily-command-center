-- V15 planning layer. Intentionally unapplied. Canonical invoices/payments/expenses remain unchanged.
create table financial_cash_accounts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 name text not null check(length(trim(name)) between 1 and 240), type text not null check(type in ('bank','cash','processor','wallet','other')),
 currency text not null check(currency ~ '^[A-Z]{3}$'), status text not null default 'active' check(status in ('active','inactive','archived')),
 notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,id,currency)
);
create table financial_cash_snapshots (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), cash_account_id uuid not null,
 currency text not null, balance numeric(18,2) not null, as_of timestamptz not null check(as_of <= now()),
 source text not null default 'manual' check(source in ('manual','import')), notes text,
 request_id uuid not null, created_at timestamptz not null default now(), unique(user_id,request_id),
 foreign key(user_id,cash_account_id,currency) references financial_cash_accounts(user_id,id,currency)
);
create table financial_obligations (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), title text not null check(length(trim(title)) between 1 and 240),
 amount numeric(18,2) not null check(amount>0), currency text not null check(currency ~ '^[A-Z]{3}$'), due_at date not null,
 status text not null default 'planned' check(status in ('planned','committed','due','paid','deferred','cancelled')),
 criticality text not null default 'standard' check(criticality in ('optional','standard','critical')), category text not null default 'Other',
 can_delay boolean not null default false, paid_at date, expense_id uuid references expenses(id),
 source_type text, source_id uuid, owner_person_id uuid references team_people(id), notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((source_type is null)=(source_id is null)), check(status<>'paid' or paid_at is not null)
);
create table financial_budgets (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), name text not null check(length(trim(name)) between 1 and 240),
 period_start date not null, period_end date not null, currency text not null check(currency ~ '^[A-Z]{3}$'), amount numeric(18,2) not null check(amount>=0),
 scope_type text not null default 'custom', scope_id uuid, category text,
 status text not null default 'draft' check(status in ('draft','active','closed','archived')), owner_person_id uuid references team_people(id), notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(period_start<=period_end)
);
create table financial_budget_lines (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), budget_id uuid not null references financial_budgets(id),
 category text not null, amount numeric(18,2) not null check(amount>=0), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table financial_scenarios (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), title text not null check(length(trim(title)) between 1 and 240),
 type text not null default 'custom' check(type in ('base','best','stress','custom')), currency text not null check(currency ~ '^[A-Z]{3}$'),
 collection_delay_days integer not null default 0 check(collection_delay_days between 0 and 365),
 inflow_change_percent numeric not null default 0 check(inflow_change_percent between -100 and 500),
 outflow_change_percent numeric not null default 0 check(outflow_change_percent between -100 and 500),
 monthly_cost numeric(18,2) not null default 0 check(monthly_cost>=0), setup_cost numeric(18,2) not null default 0 check(setup_cost>=0),
 starts_at date, include_pipeline boolean not null default false, status text not null default 'active' check(status in ('active','archived')),
 notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((monthly_cost=0 and setup_cost=0) or starts_at is not null)
);
create table financial_investments (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), title text not null check(length(trim(title)) between 1 and 240),
 amount numeric(18,2) not null check(amount>0), currency text not null check(currency ~ '^[A-Z]{3}$'), target_date date,
 priority text not null default 'medium' check(priority in ('low','medium','high','critical')),
 status text not null default 'idea' check(status in ('idea','considering','approved','scheduled','spent','cancelled')),
 commitment_id uuid references strategic_commitments(id), expense_id uuid references expenses(id), notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table financial_payment_promises (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), invoice_id uuid not null references invoices(id),
 amount numeric(18,2) not null check(amount>0), currency text not null check(currency ~ '^[A-Z]{3}$'), promised_date date not null,
 status text not null default 'open' check(status in ('open','met','missed','cancelled')), notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index financial_one_open_promise on financial_payment_promises(user_id,invoice_id) where status='open';
create table financial_settings (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), currency text not null check(currency ~ '^[A-Z]{3}$'),
 buffer_amount numeric(18,2) check(buffer_amount>=0), buffer_months numeric check(buffer_months>=0), baseline_monthly_cost numeric(18,2) check(baseline_monthly_cost>=0),
 cash_history_complete_from date, concentration_threshold numeric not null default 0.5 check(concentration_threshold>0 and concentration_threshold<=1),
 stale_days integer not null default 7 check(stale_days between 1 and 90), notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,currency)
);
create table financial_subscription_reviews (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), subscription_id uuid not null references subscriptions(id),
 status text not null default 'unknown' check(status in ('keep','review','cancel_candidate','unknown')), reviewed_at date,
 criticality text not null default 'standard' check(criticality in ('optional','standard','critical')), owner_person_id uuid references team_people(id), notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,subscription_id)
);
create table financial_context_links (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), origin_type text not null, origin_id uuid not null,
 target_type text not null, target_id uuid not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,origin_type,origin_id,target_type,target_id)
);
create table financial_audit_events (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), entity_type text not null, entity_id uuid not null,
 operation text not null, before_value jsonb, after_value jsonb, created_at timestamptz not null default now()
);
-- Every mutable row is audited transactionally; callers cannot edit audit history.
create function financial_audit_change() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='DELETE' then
  insert into financial_audit_events(user_id,entity_type,entity_id,operation,before_value,after_value) values(old.user_id,tg_table_name,old.id,tg_op,to_jsonb(old),null);
  return old;
 end if;
 insert into financial_audit_events(user_id,entity_type,entity_id,operation,before_value,after_value)
 values(new.user_id,tg_table_name,new.id,tg_op,case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return new;
end $$;
revoke all on function financial_audit_change() from public;

-- Safe table lookup for owner checks; identifiers never come from a free-form table name.
create function financial_owned(p_type text,p_id uuid,p_owner uuid) returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare t text; ok boolean;
begin
 t:=case p_type
 when 'account' then 'financial_cash_accounts' when 'budget' then 'financial_budgets' when 'obligation' then 'financial_obligations'
 when 'scenario' then 'financial_scenarios' when 'investment' then 'financial_investments'
 when 'invoice' then 'invoices' when 'payment' then 'payments' when 'expense' then 'expenses' when 'subscription' then 'subscriptions'
 when 'client' then 'clients' when 'project' then 'projects' when 'opportunity' then 'opportunities' when 'supplier' then 'supplier_records'
 when 'supplier_order' then 'supplier_orders' when 'product' then 'product_catalog_refs' when 'campaign' then 'campaigns' when 'goal' then 'goals'
 when 'commitment' then 'strategic_commitments' when 'milestone' then 'strategic_milestones' when 'period' then 'planning_periods' when 'gate' then 'decision_gates'
 when 'person' then 'team_people' when 'process' then 'process_templates' when 'decision' then 'decisions'
 when 'topic' then 'research_topics' when 'finding' then 'research_findings' when 'source' then 'knowledge_sources' when 'brief' then 'research_briefs'
 when 'company' then 'companies' when 'roadmap' then 'product_roadmap_items' else null end;
 if t is null then return false; end if;
 execute format('select exists(select 1 from %I where id=$1 and user_id=$2)',t) into ok using p_id,p_owner;
 return ok;
end $$;
revoke all on function financial_owned(text,uuid,uuid) from public;
grant execute on function financial_owned(text,uuid,uuid) to authenticated;
create function financial_validate_links() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare j jsonb:=to_jsonb(new); k text; pair text[]; target_currency text;
begin
 if new.user_id is distinct from auth.uid() then raise exception 'Owner required'; end if;
 if tg_op='UPDATE' and j ? 'currency' and j->>'currency' is distinct from to_jsonb(old)->>'currency' then raise exception 'Currency cannot change'; end if;
 foreach pair slice 1 in array array[['cash_account_id','account'],['budget_id','budget'],['invoice_id','invoice'],['expense_id','expense'],['subscription_id','subscription'],['commitment_id','commitment'],['owner_person_id','person']] loop
  k:=pair[1]; if j->>k is not null and not financial_owned(pair[2],(j->>k)::uuid,new.user_id) then raise exception 'Related record unavailable'; end if;
 end loop;
 foreach pair slice 1 in array array[['source_type','source_id'],['scope_type','scope_id'],['origin_type','origin_id'],['target_type','target_id']] loop
  if j->>pair[2] is not null and not financial_owned(j->>pair[1],(j->>pair[2])::uuid,new.user_id) then raise exception 'Related record unavailable'; end if;
 end loop;
 if tg_table_name='financial_payment_promises' then
  select currency into target_currency from invoices where id=new.invoice_id and user_id=new.user_id;
  if new.currency<>trim(target_currency) then raise exception 'Invoice currency mismatch'; end if;
 end if;
 if j->>'expense_id' is not null then
  select currency into target_currency from expenses where id=(j->>'expense_id')::uuid and user_id=new.user_id;
  if j->>'currency' is distinct from trim(target_currency) then raise exception 'Expense currency mismatch'; end if;
 end if;
 if tg_op='UPDATE' then new.updated_at:=now(); end if;
 return new;
end $$;
revoke all on function financial_validate_links() from public;
do $$ declare t text; begin
 foreach t in array array['financial_cash_accounts','financial_cash_snapshots','financial_obligations','financial_budgets','financial_budget_lines','financial_scenarios','financial_investments','financial_payment_promises','financial_settings','financial_subscription_reviews','financial_context_links'] loop
  execute format('alter table %I enable row level security',t);
  execute format('revoke all on %I from anon,authenticated',t);
  execute format('grant select,insert on %I to authenticated',t);
  if t<>'financial_cash_snapshots' then execute format('grant update on %I to authenticated',t); end if;
  if t='financial_context_links' then execute format('grant delete on %I to authenticated',t); end if;
  execute format('create policy %I on %I for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()))',t||'_owner',t);
  execute format('create index %I on %I(user_id,created_at desc)',t||'_owner_date',t);
  execute format('create trigger validate_financial_links before insert or update on %I for each row execute function financial_validate_links()',t);
  execute format('create trigger audit_financial_change after insert or update on %I for each row execute function financial_audit_change()',t);
 end loop;
end $$;
create trigger audit_financial_link_removal after delete on financial_context_links for each row execute function financial_audit_change();
alter table financial_audit_events enable row level security;
revoke all on financial_audit_events from anon,authenticated;
grant select on financial_audit_events to authenticated;
create policy financial_audit_owner on financial_audit_events for select to authenticated using(user_id=(select auth.uid()));
create index financial_audit_owner_date on financial_audit_events(user_id,entity_id,created_at desc);
create index financial_snapshot_history on financial_cash_snapshots(user_id,cash_account_id,as_of desc);
create index financial_obligations_due on financial_obligations(user_id,currency,status,due_at);
create index financial_budgets_period on financial_budgets(user_id,currency,period_start,period_end);
create index financial_budget_line_parent on financial_budget_lines(user_id,budget_id);
create index financial_promises_date on financial_payment_promises(user_id,invoice_id,promised_date);
create index financial_investments_target on financial_investments(user_id,currency,status,target_date);
-- Existing notification/run infrastructure; financial-only concurrency guards.
create unique index financial_notification_condition_once on public.notifications(user_id,dedupe_key)
where dedupe_key like 'financial:%' and resolved_at is null;
create unique index financial_automation_slot_once on public.automation_runs(user_id,automation_id,(metadata->>'financial_slot'))
where metadata ? 'financial_slot';

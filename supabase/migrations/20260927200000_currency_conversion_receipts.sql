begin;
create table if not exists public.currency_conversion_receipts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 route text not null,
 method text not null,
 original_input jsonb not null,
 conversions jsonb not null,
 state text not null default 'pending' check(state in ('pending','saved','rejected','migrated')),
 result jsonb,
 created_at timestamptz not null default now()
);
alter table public.currency_conversion_receipts enable row level security;
create policy currency_receipts_owner on public.currency_conversion_receipts for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke all on public.currency_conversion_receipts from anon,authenticated;
grant select,insert on public.currency_conversion_receipts to authenticated;
grant update(state,result) on public.currency_conversion_receipts to authenticated;
create index currency_receipts_owner_date on public.currency_conversion_receipts(user_id,created_at desc);

-- Canonical reporting and new-record defaults use US dollars.
alter table public.client_renewals alter column currency set default 'USD';
alter table public.commerce_orders alter column currency set default 'USD';
alter table public.companies alter column currency set default 'USD';
alter table public.content_items alter column metric_currency set default 'USD';
alter table public.decisions alter column currency set default 'USD';
alter table public.expenses alter column currency set default 'USD';
alter table public.finance_transactions alter column currency set default 'USD';
alter table public.growth_experiments alter column currency set default 'USD';
alter table public.invoices alter column currency set default 'USD';
alter table public.leads alter column currency set default 'USD';
alter table public.marketing_attribution_records alter column currency set default 'USD';
alter table public.operating_risks alter column currency set default 'USD';
alter table public.opportunities alter column currency set default 'USD';
alter table public.payments alter column currency set default 'USD';
alter table public.personal_balance_entries alter column currency set default 'USD';
alter table public.personal_renewals alter column currency set default 'USD';
alter table public.product_catalog_refs alter column currency set default 'USD';
alter table public.projects alter column currency set default 'USD';
alter table public.proposals alter column currency set default 'USD';
alter table public.quality_incidents alter column currency set default 'USD';
alter table public.sales_targets alter column currency set default 'USD';
alter table public.scope_change_requests alter column currency set default 'USD';
alter table public.services alter column currency set default 'USD';
alter table public.subscriptions alter column currency set default 'USD';
alter table public.supplier_orders alter column currency set default 'USD';
alter table public.supplier_records alter column currency set default 'USD';
alter table public.travel_reservations alter column currency set default 'USD';
alter table public.trips alter column currency set default 'USD';

CREATE OR REPLACE FUNCTION public.create_supplier_order_with_items(order_payload jsonb, item_payload jsonb)
 RETURNS supplier_orders
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare saved supplier_orders; item jsonb; product_owner uuid;
begin
  if auth.uid() is null or (order_payload->>'user_id')::uuid <> auth.uid() then raise exception 'Unauthorized'; end if;
  if not exists (select 1 from companies where id = (order_payload->>'company_id')::uuid and user_id = auth.uid()) then raise exception 'Company not available'; end if;
  if not exists (select 1 from supplier_records where id = (order_payload->>'supplier_id')::uuid and user_id = auth.uid() and company_id = (order_payload->>'company_id')::uuid) then raise exception 'Supplier not available'; end if;
  insert into supplier_orders(user_id,company_id,supplier_id,status,reference,ordered_at,expected_at,received_at,total_value,currency,notes)
  values(auth.uid(),(order_payload->>'company_id')::uuid,(order_payload->>'supplier_id')::uuid,coalesce(order_payload->>'status','draft'),nullif(order_payload->>'reference',''),nullif(order_payload->>'ordered_at','')::timestamptz,nullif(order_payload->>'expected_at','')::timestamptz,nullif(order_payload->>'received_at','')::timestamptz,nullif(order_payload->>'total_value','')::numeric,coalesce(order_payload->>'currency','USD'),nullif(order_payload->>'notes','')) returning * into saved;
  for item in select value from jsonb_array_elements(coalesce(item_payload,'[]'::jsonb)) loop
    if nullif(item->>'product_id','') is not null then select user_id into product_owner from product_catalog_refs where id = (item->>'product_id')::uuid; if product_owner is distinct from auth.uid() then raise exception 'Product not available'; end if; end if;
    insert into supplier_order_items(user_id,company_id,supplier_order_id,product_id,product_name,quantity,unit_cost) values(auth.uid(),saved.company_id,saved.id,nullif(item->>'product_id','')::uuid,item->>'product_name',(item->>'quantity')::numeric,nullif(item->>'unit_cost','')::numeric);
  end loop;
  return saved;
end $function$
;

CREATE OR REPLACE FUNCTION public.update_supplier_order_draft(order_id_value uuid, order_payload jsonb, item_payload jsonb)
 RETURNS supplier_orders
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare saved supplier_orders; item jsonb; product_owner uuid;
begin
  select * into saved from supplier_orders where id = order_id_value and user_id = auth.uid() for update;
  if not found then raise exception 'Supplier order not available'; end if;
  if saved.status <> 'draft' then raise exception 'Only draft supplier orders can be edited'; end if;
  if not exists (select 1 from supplier_records where id = (order_payload->>'supplier_id')::uuid and user_id = auth.uid() and company_id = saved.company_id) then raise exception 'Supplier not available'; end if;
  update supplier_orders set supplier_id = (order_payload->>'supplier_id')::uuid, reference = nullif(order_payload->>'reference',''), ordered_at = nullif(order_payload->>'ordered_at','')::timestamptz, expected_at = nullif(order_payload->>'expected_at','')::timestamptz, total_value = nullif(order_payload->>'total_value','')::numeric, currency = coalesce(order_payload->>'currency','USD'), notes = nullif(order_payload->>'notes',''), updated_at = now() where id = saved.id returning * into saved;
  delete from supplier_order_items where supplier_order_id = saved.id and user_id = auth.uid();
  for item in select value from jsonb_array_elements(coalesce(item_payload,'[]'::jsonb)) loop
    if nullif(item->>'product_id','') is not null then select user_id into product_owner from product_catalog_refs where id = (item->>'product_id')::uuid and company_id = saved.company_id; if product_owner is distinct from auth.uid() then raise exception 'Product not available'; end if; end if;
    insert into supplier_order_items(user_id,company_id,supplier_order_id,product_id,product_name,quantity,unit_cost) values(auth.uid(),saved.company_id,saved.id,nullif(item->>'product_id','')::uuid,item->>'product_name',(item->>'quantity')::numeric,nullif(item->>'unit_cost','')::numeric);
  end loop;
  return saved;
end $function$
;

CREATE OR REPLACE FUNCTION public.tier1_postmortem_action(issue_key uuid, action_kind text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
  values(auth.uid(),left('Recurrence: '||incident.title,240),incident.postmortem->>'recurrence_risk','operational','identified',null,null,coalesce(incident.currency,'USD'),content,incident.company_id,incident.project_id,issue_key,incident.postmortem->>'prevention_owner') returning id into result;
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
end $function$
;

commit;

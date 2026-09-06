-- V6: narrow procurement detail for normalized supplier orders. Intentionally unapplied.
alter table supplier_orders add column if not exists expected_at timestamptz;

create table if not exists supplier_order_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  supplier_order_id uuid not null references supplier_orders(id) on delete cascade,
  product_id uuid references product_catalog_refs(id) on delete set null,
  product_name text not null check (length(trim(product_name)) between 1 and 240),
  quantity numeric(14,2) not null check (quantity > 0),
  unit_cost numeric(14,2) check (unit_cost is null or unit_cost >= 0),
  created_at timestamptz not null default now()
);
create index if not exists supplier_order_items_owner_order_idx on supplier_order_items(user_id, supplier_order_id);
alter table supplier_order_items enable row level security;
grant select, insert, update, delete on supplier_order_items to authenticated;
drop policy if exists supplier_order_items_owner on supplier_order_items;
create policy supplier_order_items_owner on supplier_order_items for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function create_supplier_order_with_items(order_payload jsonb, item_payload jsonb)
returns supplier_orders language plpgsql security invoker set search_path = public as $$
declare saved supplier_orders; item jsonb; product_owner uuid;
begin
  if auth.uid() is null or (order_payload->>'user_id')::uuid <> auth.uid() then raise exception 'Unauthorized'; end if;
  if not exists (select 1 from companies where id = (order_payload->>'company_id')::uuid and user_id = auth.uid()) then raise exception 'Company not available'; end if;
  if not exists (select 1 from supplier_records where id = (order_payload->>'supplier_id')::uuid and user_id = auth.uid() and company_id = (order_payload->>'company_id')::uuid) then raise exception 'Supplier not available'; end if;
  insert into supplier_orders(user_id,company_id,supplier_id,status,reference,ordered_at,expected_at,received_at,total_value,currency,notes)
  values(auth.uid(),(order_payload->>'company_id')::uuid,(order_payload->>'supplier_id')::uuid,coalesce(order_payload->>'status','draft'),nullif(order_payload->>'reference',''),nullif(order_payload->>'ordered_at','')::timestamptz,nullif(order_payload->>'expected_at','')::timestamptz,nullif(order_payload->>'received_at','')::timestamptz,nullif(order_payload->>'total_value','')::numeric,coalesce(order_payload->>'currency','MAD'),nullif(order_payload->>'notes','')) returning * into saved;
  for item in select value from jsonb_array_elements(coalesce(item_payload,'[]'::jsonb)) loop
    if nullif(item->>'product_id','') is not null then select user_id into product_owner from product_catalog_refs where id = (item->>'product_id')::uuid; if product_owner is distinct from auth.uid() then raise exception 'Product not available'; end if; end if;
    insert into supplier_order_items(user_id,company_id,supplier_order_id,product_id,product_name,quantity,unit_cost) values(auth.uid(),saved.company_id,saved.id,nullif(item->>'product_id','')::uuid,item->>'product_name',(item->>'quantity')::numeric,nullif(item->>'unit_cost','')::numeric);
  end loop;
  return saved;
end $$;

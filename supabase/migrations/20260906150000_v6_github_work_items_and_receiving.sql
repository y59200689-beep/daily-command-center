-- V6: normalized GitHub work items and idempotent supplier receiving. Intentionally unapplied.
create table if not exists github_work_items (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  repository_external_id text not null, external_id text not null, kind text not null check (kind in ('issue','pull_request')),
  title text not null, state text not null, is_draft boolean not null default false, is_merged boolean not null default false,
  labels jsonb not null default '[]'::jsonb, milestone text, branch text, html_url text, created_at_provider timestamptz, updated_at_provider timestamptz,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id, repository_external_id, external_id, kind)
);
create index if not exists github_work_items_owner_state_idx on github_work_items(user_id, repository_external_id, state, updated_at_provider desc);
alter table github_work_items enable row level security;
grant select, insert, update, delete on github_work_items to authenticated;
create policy github_work_items_owner on github_work_items for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table supplier_order_items add column if not exists quantity_received numeric(14,2) not null default 0 check (quantity_received >= 0 and quantity_received <= quantity);
create table if not exists supplier_order_receipts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, company_id uuid not null references companies(id) on delete cascade,
  supplier_order_id uuid not null references supplier_orders(id) on delete cascade, idempotency_key text not null, received_at timestamptz not null default now(), created_at timestamptz not null default now(), unique(user_id, supplier_order_id, idempotency_key)
);
alter table supplier_order_receipts enable row level security;
grant select, insert on supplier_order_receipts to authenticated;
create policy supplier_order_receipts_owner on supplier_order_receipts for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create or replace function receive_supplier_order_items(order_id_value uuid, receipt_key text, receipt_items jsonb)
returns supplier_orders language plpgsql security invoker set search_path = public as $$
declare saved supplier_orders; line jsonb; current_item supplier_order_items; received numeric; delta numeric; prior_stock inventory_snapshots;
begin
  select * into saved from supplier_orders where id = order_id_value and user_id = auth.uid() for update;
  if not found then raise exception 'Supplier order not available'; end if;
  if saved.status in ('received','canceled') then raise exception 'Supplier order cannot receive items'; end if;
  insert into supplier_order_receipts(user_id,company_id,supplier_order_id,idempotency_key) values(auth.uid(),saved.company_id,saved.id,receipt_key) on conflict (user_id,supplier_order_id,idempotency_key) do nothing;
  if not found then return saved; end if;
  for line in select value from jsonb_array_elements(receipt_items) loop
    select * into current_item from supplier_order_items where id = (line->>'item_id')::uuid and supplier_order_id = saved.id and user_id = auth.uid() for update;
    if not found then raise exception 'Supplier order line not available'; end if;
    received := (line->>'quantity_received')::numeric; if received <= 0 or current_item.quantity_received + received > current_item.quantity then raise exception 'Received quantity is invalid'; end if;
    update supplier_order_items set quantity_received = quantity_received + received where id = current_item.id;
    if current_item.product_id is not null then select * into prior_stock from inventory_snapshots where product_id=current_item.product_id and user_id=auth.uid() order by captured_at desc limit 1; insert into inventory_snapshots(user_id,company_id,product_id,available_stock,reserved_stock,reorder_level,source) values(auth.uid(),saved.company_id,current_item.product_id,coalesce(prior_stock.available_stock,0)+received,prior_stock.reserved_stock,prior_stock.reorder_level,'supplier_receipt'); end if;
  end loop;
  update supplier_orders set status = case when exists(select 1 from supplier_order_items where supplier_order_id=saved.id and quantity_received < quantity) then 'partially_received' else 'received' end, received_at = case when not exists(select 1 from supplier_order_items where supplier_order_id=saved.id and quantity_received < quantity) then now() else received_at end where id=saved.id returning * into saved;
  return saved;
end $$;

create or replace function update_supplier_order_draft(order_id_value uuid, order_payload jsonb, item_payload jsonb)
returns supplier_orders language plpgsql security invoker set search_path = public as $$
declare saved supplier_orders; item jsonb; product_owner uuid;
begin
  select * into saved from supplier_orders where id = order_id_value and user_id = auth.uid() for update;
  if not found then raise exception 'Supplier order not available'; end if;
  if saved.status <> 'draft' then raise exception 'Only draft supplier orders can be edited'; end if;
  if not exists (select 1 from supplier_records where id = (order_payload->>'supplier_id')::uuid and user_id = auth.uid() and company_id = saved.company_id) then raise exception 'Supplier not available'; end if;
  update supplier_orders set supplier_id = (order_payload->>'supplier_id')::uuid, reference = nullif(order_payload->>'reference',''), ordered_at = nullif(order_payload->>'ordered_at','')::timestamptz, expected_at = nullif(order_payload->>'expected_at','')::timestamptz, total_value = nullif(order_payload->>'total_value','')::numeric, currency = coalesce(order_payload->>'currency','MAD'), notes = nullif(order_payload->>'notes',''), updated_at = now() where id = saved.id returning * into saved;
  delete from supplier_order_items where supplier_order_id = saved.id and user_id = auth.uid();
  for item in select value from jsonb_array_elements(coalesce(item_payload,'[]'::jsonb)) loop
    if nullif(item->>'product_id','') is not null then select user_id into product_owner from product_catalog_refs where id = (item->>'product_id')::uuid and company_id = saved.company_id; if product_owner is distinct from auth.uid() then raise exception 'Product not available'; end if; end if;
    insert into supplier_order_items(user_id,company_id,supplier_order_id,product_id,product_name,quantity,unit_cost) values(auth.uid(),saved.company_id,saved.id,nullif(item->>'product_id','')::uuid,item->>'product_name',(item->>'quantity')::numeric,nullif(item->>'unit_cost','')::numeric);
  end loop;
  return saved;
end $$;

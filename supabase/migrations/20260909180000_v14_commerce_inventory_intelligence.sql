-- V14 Commerce, Inventory & Purchasing Operating System. Additive, owner-scoped commerce intelligence layer.
-- DO NOT APPLY. Intentionally unapplied. Existing V1-V13 schemas remain canonical.

-- 1. Product catalog extensions (brand, selling price)
alter table product_catalog_refs add column if not exists brand text;
alter table product_catalog_refs add column if not exists selling_price numeric(14,2) check (selling_price is null or selling_price >= 0);

-- 2. Inventory Policies per product
create table if not exists inventory_policies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  product_id uuid not null references product_catalog_refs(id) on delete cascade,
  minimum_stock numeric(14,2) default 0 check (minimum_stock is null or minimum_stock >= 0),
  reorder_point numeric(14,2) default 0 check (reorder_point is null or reorder_point >= 0),
  target_coverage_days integer default 30 check (target_coverage_days is null or target_coverage_days >= 0),
  safety_stock numeric(14,2) default 0 check (safety_stock is null or safety_stock >= 0),
  preferred_supplier_id uuid references supplier_records(id) on delete set null,
  priority text not null default 'standard' check (priority in ('standard', 'important', 'critical')),
  review_cadence text not null default 'monthly' check (review_cadence in ('weekly', 'monthly', 'quarterly', 'none')),
  last_reviewed_at timestamptz,
  next_review_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, product_id)
);

-- 3. Inventory Discrepancies
create table if not exists inventory_discrepancies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  product_id uuid not null references product_catalog_refs(id) on delete cascade,
  discrepancy_type text not null check (discrepancy_type in ('count_mismatch', 'receiving_mismatch', 'damaged_stock', 'missing_stock', 'duplicate_entry', 'unknown', 'other')),
  expected_quantity numeric(14,2) not null,
  observed_quantity numeric(14,2) not null,
  difference numeric(14,2) not null,
  source text not null default 'cycle_count',
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'investigating', 'resolved', 'dismissed')),
  notes text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Inventory Audits (Cycle counts / Audits)
create table if not exists inventory_audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 240),
  scope text not null default 'full' check (scope in ('full', 'category', 'brand', 'spot_check')),
  scope_filter text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'needs_review', 'completed', 'cancelled')),
  products_counted integer not null default 0 check (products_counted >= 0),
  discrepancies_found integer not null default 0 check (discrepancies_found >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. Inventory Audit Lines
create table if not exists inventory_audit_lines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  audit_id uuid not null references inventory_audits(id) on delete cascade,
  product_id uuid not null references product_catalog_refs(id) on delete cascade,
  expected_stock numeric(14,2) not null default 0,
  counted_stock numeric(14,2) not null,
  difference numeric(14,2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

-- 6. Inventory Adjustments (Audited stock mutations)
create table if not exists inventory_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  product_id uuid not null references product_catalog_refs(id) on delete cascade,
  quantity_delta numeric(14,2) not null,
  reason text not null check (reason in ('cycle_count', 'damage', 'correction', 'return', 'loss', 'other')),
  discrepancy_id uuid references inventory_discrepancies(id) on delete set null,
  audit_id uuid references inventory_audits(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

-- 7. Product Supplier Links (Alternate / Preferred suppliers)
create table if not exists product_supplier_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  product_id uuid not null references product_catalog_refs(id) on delete cascade,
  supplier_id uuid not null references supplier_records(id) on delete cascade,
  link_type text not null default 'preferred' check (link_type in ('preferred', 'alternate', 'inactive')),
  supplier_sku text,
  supplier_unit_cost numeric(14,2) check (supplier_unit_cost is null or supplier_unit_cost >= 0),
  lead_time_days integer check (lead_time_days is null or lead_time_days >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, product_id, supplier_id)
);

-- 8. Saved Inventory Scenarios
create table if not exists saved_inventory_scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 240),
  scenario_type text not null check (scenario_type in ('demand_delta', 'supplier_delay', 'custom')),
  parameters jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);

-- 9. Commerce Review Records
create table if not exists commerce_review_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  period_type text not null check (period_type in ('week', 'month')),
  period_start date not null,
  period_end date not null,
  metrics jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  unique(company_id, period_type, period_start)
);

-- Performance Indexes
create index if not exists inventory_policies_owner_idx on inventory_policies(user_id, company_id, priority);
create index if not exists inventory_policies_review_idx on inventory_policies(user_id, next_review_at);
create index if not exists inventory_discrepancies_owner_status_idx on inventory_discrepancies(user_id, company_id, status, severity);
create index if not exists inventory_discrepancies_product_idx on inventory_discrepancies(user_id, product_id, created_at desc);
create index if not exists inventory_audits_owner_status_idx on inventory_audits(user_id, company_id, status);
create index if not exists inventory_audit_lines_audit_idx on inventory_audit_lines(user_id, audit_id, product_id);
create index if not exists inventory_adjustments_product_idx on inventory_adjustments(user_id, company_id, product_id, created_at desc);
create index if not exists product_supplier_links_product_idx on product_supplier_links(user_id, company_id, product_id, link_type);
create index if not exists product_supplier_links_supplier_idx on product_supplier_links(user_id, company_id, supplier_id);
create index if not exists saved_inventory_scenarios_owner_idx on saved_inventory_scenarios(user_id, company_id);
create index if not exists commerce_review_records_owner_period_idx on commerce_review_records(user_id, company_id, period_start desc);
create index if not exists product_catalog_refs_brand_idx on product_catalog_refs(user_id, company_id, brand);

-- RLS
do $$ declare t text; begin
  foreach t in array array[
    'inventory_policies', 'inventory_discrepancies', 'inventory_audits',
    'inventory_audit_lines', 'inventory_adjustments', 'product_supplier_links',
    'saved_inventory_scenarios', 'commerce_review_records'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I_owner_all on %I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t, t);
    execute format('grant select,insert,update,delete on table %I to authenticated', t);
  end loop;
end $$;

-- Triggers for updated_at
do $$ declare t text; begin
  foreach t in array array[
    'inventory_policies', 'inventory_discrepancies', 'inventory_audits', 'product_supplier_links'
  ] loop
    execute format('create trigger %I_updated before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

-- V6 Founder Operating System: normalized, owner-scoped snapshots for company operations.
create table if not exists companies (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 240), primary_project_id uuid references projects(id) on delete set null,
  industry text, country_code text check (country_code is null or length(country_code) = 2), currency text not null default 'MAD' check (length(currency) = 3),
  active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id, name)
);
alter table projects add column if not exists company_id uuid references companies(id) on delete set null;

create table if not exists company_metrics_snapshots (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, company_id uuid not null references companies(id) on delete cascade,
  source text not null check (source in ('commerce','analytics','marketing','deployment','manual')), snapshot_date date not null,
  currency text check (currency is null or length(currency) = 3), metrics jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
  unique(company_id, source, snapshot_date, currency)
);
create table if not exists product_catalog_refs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, company_id uuid not null references companies(id) on delete cascade,
  external_id text, sku text, name text not null check (length(trim(name)) between 1 and 240), category text, currency text not null default 'MAD' check (length(currency) = 3),
  unit_cost numeric(14,2) check (unit_cost is null or unit_cost >= 0), active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(company_id, external_id), unique(company_id, sku)
);
create table if not exists inventory_snapshots (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, company_id uuid not null references companies(id) on delete cascade, product_id uuid not null references product_catalog_refs(id) on delete cascade,
  available_stock numeric(14,2) check (available_stock is null or available_stock >= 0), reserved_stock numeric(14,2) check (reserved_stock is null or reserved_stock >= 0), reorder_level numeric(14,2) check (reorder_level is null or reorder_level >= 0), captured_at timestamptz not null default now(), source text not null default 'manual', unique(product_id, captured_at)
);
create table if not exists supplier_records (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, company_id uuid not null references companies(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 240), contact_reference text, lead_time_days integer check (lead_time_days is null or lead_time_days >= 0), minimum_order_value numeric(14,2) check (minimum_order_value is null or minimum_order_value >= 0), currency text not null default 'MAD' check (length(currency) = 3), payment_terms text, notes text, active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists supplier_orders (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, company_id uuid not null references companies(id) on delete cascade, supplier_id uuid not null references supplier_records(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft','ordered','partially_received','received','canceled')), reference text, ordered_at timestamptz, received_at timestamptz, total_value numeric(14,2) check (total_value is null or total_value >= 0), currency text not null default 'MAD' check (length(currency) = 3), notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists commerce_orders (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, company_id uuid not null references companies(id) on delete cascade,
  external_id text, customer_reference text, status text not null check (status in ('pending','confirmed','preparing','shipped','delivered','canceled','failed_payment','cod_pending','refunded')), currency text not null default 'MAD' check (length(currency) = 3),
  total_amount numeric(14,2) not null check (total_amount >= 0), shipping_cost numeric(14,2), payment_fee numeric(14,2), marketing_cost numeric(14,2), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(company_id, external_id)
);
create table if not exists commerce_order_items (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, company_id uuid not null references companies(id) on delete cascade, order_id uuid not null references commerce_orders(id) on delete cascade, product_id uuid references product_catalog_refs(id) on delete set null,
  product_name text not null, sku text, quantity numeric(14,2) not null check (quantity > 0), unit_price numeric(14,2) not null check (unit_price >= 0), unit_cost numeric(14,2) check (unit_cost is null or unit_cost >= 0), created_at timestamptz not null default now()
);
create table if not exists support_cases (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, company_id uuid not null references companies(id) on delete cascade, order_id uuid references commerce_orders(id) on delete set null, product_id uuid references product_catalog_refs(id) on delete set null,
  customer_reference text, category text not null check (category in ('payment','delivery','product','refund','account','website','other')), priority text not null default 'medium' check (priority in ('low','medium','high','critical')), status text not null default 'open' check (status in ('open','investigating','resolved','closed')), summary text not null check (length(trim(summary)) between 1 and 5000), incident_id uuid, created_at timestamptz not null default now(), resolved_at timestamptz
);
create table if not exists deployment_records (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, company_id uuid not null references companies(id) on delete cascade, project_id uuid references projects(id) on delete set null,
  provider text not null default 'vercel', external_id text, environment text not null check (environment in ('production','preview')), status text not null check (status in ('building','ready','failed','canceled')), branch text, commit_sha text, commit_message text, deployment_url text, started_at timestamptz, completed_at timestamptz, created_at timestamptz not null default now(), unique(company_id, provider, external_id)
);
create table if not exists release_records (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, company_id uuid not null references companies(id) on delete cascade, deployment_id uuid references deployment_records(id) on delete set null, title text not null, notes text, released_at timestamptz, rollback_of_id uuid references release_records(id) on delete set null, created_at timestamptz not null default now()
);
create table if not exists product_roadmap_items (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, company_id uuid not null references companies(id) on delete cascade, project_id uuid references projects(id) on delete set null,
  title text not null check (length(trim(title)) between 1 and 240), type text not null check (type in ('feature','improvement','bug','infrastructure','experiment')), status text not null default 'backlog' check (status in ('backlog','planned','in_progress','testing','shipped','paused')), priority text not null default 'medium' check (priority in ('low','medium','high','critical')), horizon text not null default 'later' check (horizon in ('now','next','later')), github_issue_ref text, github_pr_ref text, business_impact text, effort_estimate text, target_date date, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists incidents (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, company_id uuid not null references companies(id) on delete cascade, deployment_id uuid references deployment_records(id) on delete set null,
  title text not null check (length(trim(title)) between 1 and 240), severity text not null check (severity in ('minor','major','critical')), status text not null default 'detected' check (status in ('detected','investigating','resolved')), customer_impact text, revenue_impact numeric(14,2) check (revenue_impact is null or revenue_impact >= 0), currency text check (currency is null or length(currency) = 3), github_issue_ref text, notes text, started_at timestamptz not null default now(), resolved_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists marketing_attribution_records (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, company_id uuid not null references companies(id) on delete cascade, campaign_id uuid references campaigns(id) on delete set null,
  channel text, utm_source text, utm_campaign text, snapshot_date date not null, currency text not null default 'MAD' check (length(currency) = 3), spend numeric(14,2), attributed_revenue numeric(14,2), orders_count integer check (orders_count is null or orders_count >= 0), new_customers integer check (new_customers is null or new_customers >= 0), created_at timestamptz not null default now()
);
create table if not exists ai_usage_records (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, company_id uuid not null references companies(id) on delete cascade, feature text not null, model text, occurred_at timestamptz not null default now(), input_tokens integer check (input_tokens is null or input_tokens >= 0), output_tokens integer check (output_tokens is null or output_tokens >= 0), estimated_cost numeric(14,6), currency text not null default 'USD' check (length(currency) = 3), status text not null default 'success' check (status in ('success','failed'))
);
create table if not exists company_targets (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, company_id uuid not null references companies(id) on delete cascade, title text not null, metric_key text not null, target_value numeric(14,2), currency text check (currency is null or length(currency) = 3), period_start date, period_end date, active boolean not null default true, created_at timestamptz not null default now()
);

alter table support_cases add constraint support_cases_incident_fk foreign key (incident_id) references incidents(id) on delete set null;
create index if not exists companies_owner_idx on companies(user_id, active);
create index if not exists company_metrics_owner_date_idx on company_metrics_snapshots(user_id, company_id, snapshot_date desc);
create index if not exists commerce_orders_owner_date_idx on commerce_orders(user_id, company_id, created_at desc);
create index if not exists commerce_orders_owner_status_idx on commerce_orders(user_id, company_id, status);
create index if not exists inventory_owner_product_idx on inventory_snapshots(user_id, company_id, product_id, captured_at desc);
create index if not exists supplier_orders_owner_idx on supplier_orders(user_id, company_id, status);
create index if not exists deployments_owner_env_idx on deployment_records(user_id, company_id, environment, completed_at desc);
create index if not exists incidents_owner_status_idx on incidents(user_id, company_id, status, severity);

do $$ declare t text; begin foreach t in array array['companies','company_metrics_snapshots','product_catalog_refs','inventory_snapshots','supplier_records','supplier_orders','commerce_orders','commerce_order_items','support_cases','deployment_records','release_records','product_roadmap_items','incidents','marketing_attribution_records','ai_usage_records','company_targets'] loop execute format('alter table %I enable row level security',t); execute format('grant select,insert,update,delete on table %I to authenticated',t); execute format('create policy %I_owner_all on %I for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)',t,t); end loop; end $$;

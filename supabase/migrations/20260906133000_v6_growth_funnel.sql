-- V6 growth funnel snapshots. Aggregated counts only; no high-volume visitor events or PII.
create table if not exists company_funnel_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  source text not null default 'analytics',
  period_start timestamptz not null,
  period_end timestamptz not null,
  sessions integer check (sessions is null or sessions >= 0),
  product_views integer check (product_views is null or product_views >= 0),
  add_to_cart integer check (add_to_cart is null or add_to_cart >= 0),
  checkout_started integer check (checkout_started is null or checkout_started >= 0),
  orders_created integer check (orders_created is null or orders_created >= 0),
  orders_confirmed integer check (orders_confirmed is null or orders_confirmed >= 0),
  created_at timestamptz not null default now(),
  check (period_end > period_start),
  unique(company_id, source, period_start, period_end)
);
alter table company_funnel_snapshots enable row level security;
grant select, insert, update, delete on table company_funnel_snapshots to authenticated;
create policy company_funnel_snapshots_owner_all on company_funnel_snapshots for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create index if not exists company_funnel_snapshots_owner_period_idx on company_funnel_snapshots(user_id, company_id, period_end desc);

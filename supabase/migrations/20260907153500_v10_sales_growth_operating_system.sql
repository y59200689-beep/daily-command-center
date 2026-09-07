-- V10 Sales & Growth Operating System. Additive, owner-scoped growth layer.
-- DO NOT APPLY. Intentionally unapplied. Existing V1-V9 schemas remain canonical.

create table if not exists sales_playbooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 240),
  purpose text,
  target_type text not null check (target_type in ('lead', 'opportunity', 'client')),
  steps jsonb not null default '[]'::jsonb,
  default_delays jsonb not null default '[]'::jsonb,
  suggested_channel text check (suggested_channel is null or suggested_channel in ('email', 'whatsapp', 'call', 'meeting', 'linkedin', 'other')),
  template_ref text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists playbook_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  playbook_id uuid not null references sales_playbooks(id) on delete cascade,
  target_type text not null check (target_type in ('lead', 'opportunity', 'client')),
  target_id uuid not null,
  current_step integer not null default 0 check (current_step >= 0),
  status text not null default 'active' check (status in ('active', 'completed', 'paused', 'cancelled')),
  step_states jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists growth_experiments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 240),
  hypothesis text not null check (length(trim(hypothesis)) between 1 and 2000),
  target_metric text not null check (length(trim(target_metric)) between 1 and 240),
  channel text,
  offer text,
  audience text,
  start_date date,
  end_date date,
  budget numeric(14,2) check (budget is null or budget >= 0),
  currency char(3) not null default 'MAD',
  status text not null default 'idea' check (status in ('idea', 'planned', 'running', 'completed', 'cancelled')),
  result text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists deal_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  review_type text not null check (review_type in ('lost', 'won')),
  reason text check (reason is null or reason in ('price', 'timing', 'budget', 'scope', 'no_response', 'internal_decision', 'not_a_fit', 'competitor', 'other')),
  competitor text,
  lessons text,
  could_reactivate_later boolean not null default false,
  review_date date not null default current_date,
  why_we_won text,
  what_helped text,
  potential_expansion text,
  discount_given numeric(14,2) check (discount_given is null or discount_given >= 0),
  final_value numeric(14,2) check (final_value is null or final_value >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, opportunity_id, review_type)
);

create table if not exists sales_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid references goals(id) on delete set null,
  metric_type text not null check (metric_type in ('monthly_revenue', 'new_leads', 'qualified_leads', 'proposals_sent', 'deals_won', 'new_clients', 'expansion_revenue', 'pipeline_generated')),
  target_value numeric(14,2) not null check (target_value >= 0),
  current_value numeric(14,2) not null default 0 check (current_value >= 0),
  currency char(3) not null default 'MAD',
  period text not null check (period in ('week', 'month', 'quarter', 'year')),
  period_start date not null,
  period_end date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create index if not exists sales_playbooks_owner_status_idx on sales_playbooks(user_id, status);
create index if not exists playbook_runs_owner_target_idx on playbook_runs(user_id, target_type, target_id, status);
create index if not exists growth_experiments_owner_status_idx on growth_experiments(user_id, status, start_date);
create index if not exists deal_reviews_owner_opp_idx on deal_reviews(user_id, opportunity_id);
create index if not exists sales_targets_owner_period_idx on sales_targets(user_id, metric_type, period_start, period_end);

do $$ declare t text; begin
  foreach t in array array['sales_playbooks', 'playbook_runs', 'growth_experiments', 'deal_reviews', 'sales_targets'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I_owner_all on %I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t, t);
    execute format('grant select,insert,update,delete on table %I to authenticated', t);
  end loop;
end $$;

do $$ declare t text; begin
  foreach t in array array['sales_playbooks', 'playbook_runs', 'growth_experiments', 'deal_reviews', 'sales_targets'] loop
    execute format('create trigger %I_updated before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

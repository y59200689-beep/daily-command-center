-- V13 Customer Success & Retention Operating System. Additive, owner-scoped customer success layer.
-- DO NOT APPLY. Intentionally unapplied. Existing V1-V12 schemas remain canonical.

create table if not exists client_outcomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 240),
  description text,
  target_date date,
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'at_risk', 'achieved', 'cancelled', 'unknown')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  success_criteria text,
  evidence text,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists client_success_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 240),
  period text default 'annual',
  objective text not null,
  key_outcomes text,
  risks text,
  stakeholders text,
  responsibilities text,
  review_cadence text default 'quarterly' check (review_cadence in ('weekly', 'monthly', 'quarterly', 'semi_annual', 'annual', 'none')),
  next_review_at date,
  last_reviewed_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'active', 'needs_review', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists client_commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  direction text not null check (direction in ('we_owe_client', 'client_owes_us')),
  statement text not null check (length(trim(statement)) between 1 and 500),
  due_at timestamptz,
  status text not null default 'open' check (status in ('open', 'completed', 'cancelled', 'unclear')),
  source_entity_type text,
  source_entity_id uuid,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists client_check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  check_in_type text not null default 'routine' check (check_in_type in ('routine', 'success_review', 'delivery_review', 'renewal', 'risk_recovery', 'expansion', 'executive_review', 'other')),
  scheduled_at timestamptz,
  completed_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled', 'rescheduled')),
  purpose text not null check (length(trim(purpose)) between 1 and 240),
  summary text,
  next_action text,
  meeting_id uuid references calendar_events(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists client_satisfaction_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  signal_type text not null check (signal_type in ('positive_feedback', 'neutral_feedback', 'negative_feedback', 'complaint', 'praise', 'requested_change', 'referral', 'renewal_intent')),
  source text not null default 'manual',
  recorded_at timestamptz not null default now(),
  summary text not null check (length(trim(summary)) between 1 and 500),
  severity text check (severity in ('low', 'medium', 'high', 'critical')),
  linked_entity_type text,
  linked_entity_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists client_risks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  risk_type text not null check (risk_type in ('delivery_delay', 'communication_gap', 'quality_issue', 'payment_issue', 'stakeholder_issue', 'unmet_outcome', 'renewal_risk', 'low_engagement', 'scope_mismatch', 'dependency', 'support_issue', 'other')),
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  description text not null check (length(trim(description)) between 1 and 500),
  evidence text,
  status text not null default 'open' check (status in ('open', 'monitoring', 'mitigating', 'resolved', 'dismissed')),
  owner_person_id uuid references team_people(id) on delete set null,
  mitigation text,
  review_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists client_renewals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  service_id uuid references services(id) on delete set null,
  renewal_date date not null,
  renewal_type text not null default 'retainer' check (renewal_type in ('subscription', 'retainer', 'maintenance', 'service_contract', 'license', 'custom')),
  status text not null default 'upcoming' check (status in ('upcoming', 'preparing', 'discussing', 'renewed', 'not_renewing', 'deferred', 'unknown')),
  forecast_category text not null default 'uncertain' check (forecast_category in ('committed', 'likely', 'uncertain', 'at_risk')),
  value numeric(14,2),
  currency char(3) not null default 'MAD',
  owner_person_id uuid references team_people(id) on delete set null,
  preparation_state text not null default 'not_started' check (preparation_state in ('not_started', 'in_progress', 'ready', 'not_needed')),
  last_review_at timestamptz,
  next_action text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists client_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  milestone_type text not null check (milestone_type in ('onboarding_completed', 'first_delivery', 'first_outcome', 'first_renewal', 'anniversary', 'major_launch', 'target_achieved', 'other')),
  title text not null check (length(trim(title)) between 1 and 240),
  achieved_date date,
  status text not null default 'planned' check (status in ('planned', 'achieved', 'missed')),
  notes text,
  evidence text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists client_issues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 240),
  description text not null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  source text default 'client',
  owner_person_id uuid references team_people(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'investigating', 'waiting_on_client', 'waiting_on_us', 'resolved', 'closed')),
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists client_account_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  period text not null default 'quarter' check (period in ('week', 'month', 'quarter', 'annual')),
  health_state text not null check (health_state in ('healthy', 'needs_attention', 'at_risk', 'critical', 'insufficient_data')),
  wins text,
  risks text,
  open_commitments_count integer default 0,
  outcomes_summary text,
  renewal_status text,
  expansion_readiness text check (expansion_readiness in ('ready', 'potential', 'not_yet', 'do_not_pursue', 'unknown')),
  next_actions text,
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists client_recovery_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  risk_summary text not null,
  target_state text not null,
  actions text not null,
  owner_person_id uuid references team_people(id) on delete set null,
  review_date date,
  status text not null default 'draft' check (status in ('draft', 'active', 'monitoring', 'resolved', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists client_evidence_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  target_entity_type text not null,
  target_entity_id uuid not null,
  evidence_type text not null check (evidence_type in ('deliverable', 'metric', 'testimonial', 'document', 'report', 'approval', 'other')),
  title text not null check (length(trim(title)) between 1 and 240),
  url text,
  notes text,
  created_at timestamptz not null default now()
);

-- Performance Indexes
create index if not exists client_outcomes_owner_client_idx on client_outcomes(user_id, client_id, status);
create index if not exists client_outcomes_owner_target_idx on client_outcomes(user_id, status, target_date);
create index if not exists client_success_plans_owner_client_idx on client_success_plans(user_id, client_id, status);
create index if not exists client_success_plans_owner_review_idx on client_success_plans(user_id, next_review_at);
create index if not exists client_commitments_owner_client_idx on client_commitments(user_id, client_id, status, direction);
create index if not exists client_commitments_owner_due_idx on client_commitments(user_id, status, due_at);
create index if not exists client_check_ins_owner_client_idx on client_check_ins(user_id, client_id, status, scheduled_at);
create index if not exists client_signals_owner_client_idx on client_satisfaction_signals(user_id, client_id, recorded_at);
create index if not exists client_risks_owner_client_idx on client_risks(user_id, client_id, status, severity);
create index if not exists client_risks_owner_review_idx on client_risks(user_id, status, review_at);
create index if not exists client_renewals_owner_client_idx on client_renewals(user_id, client_id, status, renewal_date);
create index if not exists client_renewals_owner_date_idx on client_renewals(user_id, renewal_date);
create index if not exists client_milestones_owner_client_idx on client_milestones(user_id, client_id, status);
create index if not exists client_issues_owner_client_idx on client_issues(user_id, client_id, status, severity);
create index if not exists client_reviews_owner_client_idx on client_account_reviews(user_id, client_id, reviewed_at);
create index if not exists client_recovery_owner_client_idx on client_recovery_plans(user_id, client_id, status);
create index if not exists client_evidence_owner_client_idx on client_evidence_links(user_id, client_id);

-- RLS
do $$ declare t text; begin
  foreach t in array array[
    'client_outcomes', 'client_success_plans', 'client_commitments',
    'client_check_ins', 'client_satisfaction_signals', 'client_risks',
    'client_renewals', 'client_milestones', 'client_issues',
    'client_account_reviews', 'client_recovery_plans', 'client_evidence_links'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I_owner_all on %I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t, t);
    execute format('grant select,insert,update,delete on table %I to authenticated', t);
  end loop;
end $$;

-- Triggers for updated_at
do $$ declare t text; begin
  foreach t in array array[
    'client_outcomes', 'client_success_plans', 'client_commitments',
    'client_check_ins', 'client_risks', 'client_renewals',
    'client_milestones', 'client_issues', 'client_recovery_plans'
  ] loop
    execute format('create trigger %I_updated before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

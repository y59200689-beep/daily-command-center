-- V16 Executive Reporting & Decision Intelligence Layer
-- Strictly unapplied additive migration. Canonical domain tables remain unchanged.

create table if not exists executive_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  scope text not null default 'business' check(scope in ('business','personal','combined')),
  snapshot_date date not null default current_date,
  metrics jsonb not null default '{}'::jsonb,
  risk_states jsonb not null default '[]'::jsonb,
  decision_states jsonb not null default '[]'::jsonb,
  priority_states jsonb not null default '[]'::jsonb,
  domain_health jsonb not null default '{}'::jsonb,
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists executive_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  report_type text not null check(report_type in ('daily_brief','weekly_executive','monthly_business','quarterly_executive','founder_report','custom')),
  scope text not null default 'business' check(scope in ('business','personal','combined')),
  period_start date,
  period_end date,
  title text not null check(length(trim(title)) between 1 and 240),
  summary text not null,
  sections jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  immutable_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists executive_assumptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  statement text not null check(length(trim(statement)) between 1 and 500),
  domain text not null check(domain in ('finance','growth','success','commerce','operations','team','strategy','life','knowledge')),
  source text not null default 'manual',
  review_at date,
  status text not null default 'active' check(status in ('active','validated','invalidated','changed','retired','unknown')),
  confidence_label text check(confidence_label in ('strong_evidence','partial_evidence','insufficient_data')),
  linked_entities jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists executive_decision_briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  decision_id uuid not null references decisions(id),
  why_now text not null,
  alternatives jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  unknowns jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  financial_impact text,
  strategic_impact text,
  operational_impact text,
  team_impact text,
  reversibility text not null default 'moderate' check(reversibility in ('easy','moderate','hard','unknown')),
  cost_of_delay text not null default 'moderate' check(cost_of_delay in ('low','moderate','high','critical','unknown')),
  dependencies jsonb not null default '[]'::jsonb,
  recommendation_context text,
  next_action text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, decision_id)
);

create table if not exists executive_signal_dismissals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  signal_key text not null,
  dismissed_until timestamptz,
  dismissed_reason text,
  snoozed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, signal_key)
);

create table if not exists executive_decision_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  decision_id uuid not null references decisions(id),
  expected_outcome text,
  actual_outcome text not null,
  variance text,
  lessons_learned text,
  reviewed_at date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists executive_audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  entity_type text not null,
  entity_id uuid not null,
  operation text not null,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz not null default now()
);

-- Composite Indexes
create index if not exists idx_executive_snapshots_user_date on executive_snapshots(user_id, snapshot_date desc);
create index if not exists idx_executive_reports_user_type on executive_reports(user_id, report_type, created_at desc);
create index if not exists idx_executive_assumptions_user_status on executive_assumptions(user_id, status, review_at);
create index if not exists idx_executive_decision_briefs_user_dec on executive_decision_briefs(user_id, decision_id);
create index if not exists idx_executive_dismissals_user_key on executive_signal_dismissals(user_id, signal_key);
create index if not exists idx_executive_decision_reviews_user_dec on executive_decision_reviews(user_id, decision_id);

-- Enable RLS
alter table executive_snapshots enable row level security;
alter table executive_reports enable row level security;
alter table executive_assumptions enable row level security;
alter table executive_decision_briefs enable row level security;
alter table executive_signal_dismissals enable row level security;
alter table executive_decision_reviews enable row level security;
alter table executive_audit_events enable row level security;

-- Policies enforcing owner scoping (auth.uid())
create policy "executive_snapshots_owner" on executive_snapshots for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "executive_reports_owner" on executive_reports for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "executive_assumptions_owner" on executive_assumptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "executive_decision_briefs_owner" on executive_decision_briefs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "executive_signal_dismissals_owner" on executive_signal_dismissals for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "executive_decision_reviews_owner" on executive_decision_reviews for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "executive_audit_events_owner" on executive_audit_events for all using (user_id = auth.uid()) with check (user_id = auth.uid());

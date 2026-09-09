-- V17 Chief of Staff Safe Action Orchestration Layer
-- Strictly unapplied additive migration. Reuses V4 approval_items, automations, action_audit_log.

create table if not exists action_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check(length(trim(title)) between 1 and 240),
  description text,
  source_domain text not null default 'chief_of_staff' check(source_domain in ('executive','finance','growth','success','commerce','operations','team','strategy','knowledge','life','chief_of_staff','manual')),
  status text not null default 'draft' check(status in ('draft','pending_approval','partially_approved','approved','executing','partially_completed','completed','failed','cancelled')),
  bundle_approved boolean not null default false,
  template_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists action_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check(length(trim(title)) between 1 and 240),
  description text,
  source_domain text not null check(source_domain in ('executive','finance','growth','success','commerce','operations','team','strategy','knowledge','life','integrations','manual','automation')),
  source_entity_type text,
  source_entity_id uuid,
  action_type text not null,
  target_type text,
  target_id uuid,
  risk_level text not null default 'low' check(risk_level in ('safe_internal','low','moderate','high','critical')),
  reversibility text not null default 'reversible' check(reversibility in ('reversible','partially_reversible','hard_to_reverse','irreversible','unknown')),
  reason text not null,
  evidence text,
  proposed_payload jsonb not null default '{}'::jsonb,
  approval_id uuid references approval_items(id) on delete set null,
  plan_id uuid references action_plans(id) on delete cascade,
  expires_at timestamptz,
  status text not null default 'proposed' check(status in ('proposed','preparing','ready_for_review','approved','rejected','expired','cancelled','executed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists action_plan_steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references action_plans(id) on delete cascade,
  position integer not null default 0 check(position >= 0),
  title text not null check(length(trim(title)) between 1 and 240),
  action_type text not null,
  risk_level text not null default 'low' check(risk_level in ('safe_internal','low','moderate','high','critical')),
  reversibility text not null default 'reversible' check(reversibility in ('reversible','partially_reversible','hard_to_reverse','irreversible','unknown')),
  requires_approval boolean not null default true,
  status text not null default 'pending' check(status in ('pending','preparing','awaiting_approval','ready','executing','verifying','completed','blocked','failed','skipped','cancelled')),
  input_payload jsonb not null default '{}'::jsonb,
  output_payload jsonb,
  approval_id uuid references approval_items(id) on delete set null,
  execution_id uuid,
  verification_rule jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists action_dependencies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references action_plans(id) on delete cascade,
  step_id uuid not null references action_plan_steps(id) on delete cascade,
  depends_on_step_id uuid not null references action_plan_steps(id) on delete cascade,
  dependency_state text not null default 'waiting' check(dependency_state in ('waiting','ready','blocked','satisfied','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, step_id, depends_on_step_id)
);

create table if not exists action_executions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references action_plans(id) on delete set null,
  step_id uuid references action_plan_steps(id) on delete set null,
  proposal_id uuid references action_proposals(id) on delete set null,
  approval_id uuid references approval_items(id) on delete set null,
  action_type text not null,
  target_type text,
  target_id uuid,
  idempotency_key text not null,
  payload_hash text not null,
  payload jsonb not null default '{}'::jsonb,
  risk_level text not null default 'low' check(risk_level in ('safe_internal','low','moderate','high','critical')),
  reversibility text not null default 'reversible' check(reversibility in ('reversible','partially_reversible','hard_to_reverse','irreversible','unknown')),
  status text not null default 'prepared' check(status in ('prepared','awaiting_approval','approved','preflight','executing','executed','verifying','verified','failed','blocked','cancelled','rolled_back')),
  started_at timestamptz,
  completed_at timestamptz,
  verified_at timestamptz,
  execution_result jsonb,
  error_category text check(error_category in ('validation','authentication','authorization','provider_unavailable','rate_limited','conflict','context_changed','expired_approval','unsupported','network','verification_failed','unknown')),
  error_message text,
  retry_count integer not null default 0 check(retry_count >= 0),
  max_retries integer not null default 3 check(max_retries >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, idempotency_key)
);

create table if not exists action_execution_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  execution_id uuid not null references action_executions(id) on delete cascade,
  attempt_number integer not null check(attempt_number >= 1),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'executing' check(status in ('executing','success','failed','uncertain')),
  error_message text,
  error_category text,
  provider_response jsonb not null default '{}'::jsonb,
  retry_decision text check(retry_decision in ('retry_available','retry_scheduled','manual_review','do_not_retry')),
  created_at timestamptz not null default now()
);

create table if not exists action_execution_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  execution_id uuid not null references action_executions(id) on delete cascade,
  action_type text not null,
  title text not null,
  summary text not null,
  what_happened text not null,
  what_changed jsonb not null default '{}'::jsonb,
  external_reference text,
  provider text,
  executed_at timestamptz not null default now(),
  verification_state text not null default 'unverified' check(verification_state in ('verified','partially_verified','unverified','verification_failed','not_applicable')),
  verification_summary text,
  next_steps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique(user_id, execution_id)
);

create table if not exists action_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  execution_id uuid not null references action_executions(id) on delete cascade,
  verification_type text not null default 'execution' check(verification_type in ('execution','outcome')),
  state text not null default 'unverified' check(state in ('verified','partially_verified','unverified','verification_failed','not_applicable')),
  outcome_state text not null default 'pending' check(outcome_state in ('pending','achieved','not_achieved','unknown','not_applicable')),
  evidence text,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists action_rollbacks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  execution_id uuid not null references action_executions(id) on delete cascade,
  rollback_type text not null default 'reversal' check(rollback_type in ('reversal','compensating_action')),
  status text not null default 'pending' check(status in ('pending','executing','completed','failed')),
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  created_at timestamptz not null default now()
);

create table if not exists action_policy_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check(length(trim(name)) between 1 and 120),
  action_type text not null,
  condition jsonb not null default '{}'::jsonb,
  policy text not null default 'approval_required' check(policy in ('auto_executable','approval_required','additional_confirmation_required','unsupported')),
  autonomy_level integer not null default 1 check(autonomy_level in (0,1,2)),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists action_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check(length(trim(name)) between 1 and 240),
  description text,
  domain text not null default 'general',
  steps jsonb not null default '[]'::jsonb,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists action_context_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_id uuid,
  approval_id uuid references approval_items(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  snapshot_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists action_escalations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  execution_id uuid references action_executions(id) on delete set null,
  plan_id uuid references action_plans(id) on delete set null,
  title text not null check(length(trim(title)) between 1 and 240),
  reason text not null,
  severity text not null default 'important' check(severity in ('attention','important','critical')),
  status text not null default 'open' check(status in ('open','acknowledged','resolved')),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_action_proposals_owner_status on action_proposals(user_id, status, created_at desc);
create index if not exists idx_action_plans_owner_status on action_plans(user_id, status, created_at desc);
create index if not exists idx_action_plan_steps_plan_pos on action_plan_steps(user_id, plan_id, position);
create index if not exists idx_action_dependencies_step on action_dependencies(user_id, plan_id, step_id);
create index if not exists idx_action_executions_owner_status on action_executions(user_id, status, created_at desc);
create index if not exists idx_action_attempts_exec on action_execution_attempts(user_id, execution_id, attempt_number);
create index if not exists idx_action_receipts_exec on action_execution_receipts(user_id, execution_id);
create index if not exists idx_action_context_snapshots_appr on action_context_snapshots(user_id, approval_id);
create index if not exists idx_action_escalations_owner_status on action_escalations(user_id, status, created_at desc);

-- RLS
alter table action_plans enable row level security;
alter table action_proposals enable row level security;
alter table action_plan_steps enable row level security;
alter table action_dependencies enable row level security;
alter table action_executions enable row level security;
alter table action_execution_attempts enable row level security;
alter table action_execution_receipts enable row level security;
alter table action_verifications enable row level security;
alter table action_rollbacks enable row level security;
alter table action_policy_rules enable row level security;
alter table action_templates enable row level security;
alter table action_context_snapshots enable row level security;
alter table action_escalations enable row level security;

create policy "action_plans_owner" on action_plans for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "action_proposals_owner" on action_proposals for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "action_plan_steps_owner" on action_plan_steps for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "action_dependencies_owner" on action_dependencies for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "action_executions_owner" on action_executions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "action_execution_attempts_owner" on action_execution_attempts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "action_execution_receipts_owner" on action_execution_receipts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "action_verifications_owner" on action_verifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "action_rollbacks_owner" on action_rollbacks for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "action_policy_rules_owner" on action_policy_rules for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "action_templates_owner" on action_templates for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "action_context_snapshots_owner" on action_context_snapshots for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "action_escalations_owner" on action_escalations for all using (user_id = auth.uid()) with check (user_id = auth.uid());

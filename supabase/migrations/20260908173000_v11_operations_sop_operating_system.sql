-- V11 Operations & SOP Operating System. Additive, owner-scoped operations layer.
-- DO NOT APPLY. Intentionally unapplied. Existing V1-V10 schemas remain canonical.

create table if not exists operational_sops (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 240),
  purpose text,
  description text,
  status text not null default 'draft' check (status in ('draft', 'active', 'needs_review', 'deprecated', 'archived')),
  category text not null default 'other',
  owner_label text,
  review_cadence text default 'quarterly',
  last_reviewed_at timestamptz,
  next_review_at date,
  criticality text not null default 'medium' check (criticality in ('low', 'medium', 'high', 'critical')),
  estimated_duration_minutes integer check (estimated_duration_minutes is null or estimated_duration_minutes > 0),
  trigger text,
  expected_outcome text,
  notes text,
  current_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sop_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sop_id uuid not null references operational_sops(id) on delete cascade,
  version_number integer not null check (version_number >= 1),
  change_summary text,
  effective_date date not null default current_date,
  status text not null default 'active' check (status in ('draft', 'active', 'deprecated', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, sop_id, version_number)
);

create table if not exists sop_steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sop_id uuid not null references operational_sops(id) on delete cascade,
  sop_version_id uuid references sop_versions(id) on delete cascade,
  position integer not null default 0 check (position >= 0),
  title text not null check (length(trim(title)) between 1 and 240),
  instructions text,
  required boolean not null default true,
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes >= 0),
  step_type text not null default 'action' check (step_type in ('action', 'check', 'decision', 'approval', 'reference', 'wait', 'manual_entry', 'other')),
  linked_tool_or_system text,
  linked_file_id uuid references attachments(id) on delete set null,
  linked_note_id uuid references notes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sop_checklist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sop_id uuid not null references operational_sops(id) on delete cascade,
  sop_version_id uuid references sop_versions(id) on delete cascade,
  label text not null check (length(trim(label)) between 1 and 240),
  required boolean not null default true,
  position integer not null default 0 check (position >= 0),
  instructions text,
  evidence_required boolean not null default false,
  completion_rule text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists process_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 240),
  description text,
  status text not null default 'active' check (status in ('draft', 'active', 'paused', 'archived')),
  category text not null default 'other',
  sop_id uuid references operational_sops(id) on delete set null,
  default_priority text not null default 'medium' check (default_priority in ('low', 'medium', 'high', 'critical')),
  default_frequency text check (default_frequency is null or default_frequency in ('daily', 'weekly', 'monthly', 'quarterly', 'custom')),
  default_duration_minutes integer check (default_duration_minutes is null or default_duration_minutes > 0),
  trigger text,
  owner_label text,
  criticality text not null default 'medium' check (criticality in ('low', 'medium', 'high', 'critical')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists process_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  process_template_id uuid references process_templates(id) on delete set null,
  sop_id uuid references operational_sops(id) on delete set null,
  sop_version_id uuid references sop_versions(id) on delete set null,
  sop_version_number integer default 1,
  title text not null check (length(trim(title)) between 1 and 240),
  status text not null default 'planned' check (status in ('planned', 'ready', 'in_progress', 'blocked', 'needs_review', 'completed', 'failed', 'cancelled')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  trigger_source text,
  linked_entity_type text,
  linked_entity_id uuid,
  started_at timestamptz,
  due_at timestamptz,
  completed_at timestamptz,
  notes text,
  result_summary text,
  failure_reason text,
  step_progress jsonb not null default '[]'::jsonb,
  completion_override boolean not null default false,
  completion_override_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists run_checklist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null references process_runs(id) on delete cascade,
  checklist_item_id uuid references sop_checklist_items(id) on delete set null,
  label text not null check (length(trim(label)) between 1 and 240),
  required boolean not null default true,
  position integer not null default 0,
  completed boolean not null default false,
  completed_at timestamptz,
  evidence_required boolean not null default false,
  evidence_text text,
  evidence_attachment_id uuid references attachments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists process_failures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null references process_runs(id) on delete cascade,
  step_id uuid references sop_steps(id) on delete set null,
  failure_type text not null check (failure_type in ('human_error', 'missing_information', 'dependency_unavailable', 'tool_failure', 'integration_failure', 'quality_failure', 'timing', 'approval_blocked', 'external_dependency', 'unknown', 'other')),
  description text not null check (length(trim(description)) between 1 and 2000),
  detected_at timestamptz not null default now(),
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  resolved_at timestamptz,
  resolution text,
  prevent_recurrence_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists operational_blockers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null references process_runs(id) on delete cascade,
  description text not null check (length(trim(description)) between 1 and 2000),
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  blocked_since timestamptz not null default now(),
  owner_label text,
  dependency_type text,
  linked_entity_type text,
  linked_entity_id uuid,
  resolution text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists quality_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 240),
  description text,
  check_type text not null default 'manual' check (check_type in ('manual', 'automated', 'peer_review', 'metric_threshold', 'other')),
  pass_criteria text not null,
  sop_id uuid references operational_sops(id) on delete cascade,
  process_template_id uuid references process_templates(id) on delete set null,
  required boolean not null default true,
  severity_if_failed text not null default 'high' check (severity_if_failed in ('low', 'medium', 'high', 'critical')),
  evidence_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists quality_executions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null references process_runs(id) on delete cascade,
  quality_check_id uuid not null references quality_checks(id) on delete cascade,
  status text not null default 'needs_review' check (status in ('pass', 'fail', 'needs_review', 'not_applicable')),
  evidence_text text,
  evidence_attachment_id uuid references attachments(id) on delete set null,
  executed_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists quality_incidents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 240),
  description text not null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'investigating', 'corrective_action', 'monitoring', 'resolved', 'archived')),
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  process_template_id uuid references process_templates(id) on delete set null,
  run_id uuid references process_runs(id) on delete set null,
  sop_id uuid references operational_sops(id) on delete set null,
  linked_entity_type text,
  linked_entity_id uuid,
  root_cause text,
  corrective_action text,
  preventive_action text,
  corrective_task_id uuid references tasks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists operational_runbooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sop_id uuid references operational_sops(id) on delete set null,
  title text not null check (length(trim(title)) between 1 and 240),
  trigger text not null,
  severity text not null default 'high' check (severity in ('low', 'medium', 'high', 'critical')),
  symptoms text not null,
  diagnostic_steps text not null,
  recovery_steps text not null,
  escalation text,
  validation text,
  post_incident_steps text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists operational_dependencies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('sop', 'process', 'run')),
  source_id uuid not null,
  dependency_type text not null check (dependency_type in ('process', 'task', 'project', 'client', 'opportunity', 'supplier', 'product', 'campaign', 'calendar_event', 'integration', 'tool_system', 'approval', 'strategic_milestone', 'other')),
  dependency_id uuid,
  dependency_label text not null,
  state text not null default 'ready' check (state in ('ready', 'waiting', 'blocked', 'unavailable', 'unknown')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists operational_systems (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 240),
  system_type text not null default 'other',
  purpose text not null,
  status text not null default 'active' check (status in ('active', 'degraded', 'unavailable', 'deprecated', 'unknown')),
  owner_label text,
  criticality text not null default 'medium' check (criticality in ('low', 'medium', 'high', 'critical')),
  external_url text check (external_url is null or external_url ~* '^https?://[^[:space:]]+$'),
  notes text,
  linked_integration_id uuid references integrations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists operational_handoffs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid references process_runs(id) on delete cascade,
  from_label text not null,
  to_label text not null,
  handoff_description text not null,
  expected_handoff_time timestamptz,
  accepted boolean not null default false,
  accepted_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists process_improvements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 240),
  process_template_id uuid references process_templates(id) on delete set null,
  problem text not null,
  evidence text,
  proposed_change text not null,
  expected_benefit text,
  status text not null default 'idea' check (status in ('idea', 'reviewing', 'approved', 'testing', 'adopted', 'rejected', 'archived')),
  decision text,
  review_date date,
  result text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists operational_timeline (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null references process_runs(id) on delete cascade,
  event_type text not null check (event_type in ('created', 'started', 'step_completed', 'step_skipped', 'blocked', 'unblocked', 'quality_failure', 'incident_created', 'completed', 'failed', 'cancelled', 'reopened', 'override')),
  details text,
  created_at timestamptz not null default now()
);

create table if not exists operational_entity_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  operational_type text not null check (operational_type in ('sop', 'process', 'run', 'incident', 'quality_check', 'failure', 'improvement')),
  operational_id uuid not null,
  entity_type text not null,
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  unique(user_id, operational_type, operational_id, entity_type, entity_id)
);

create index if not exists operational_sops_owner_status_idx on operational_sops(user_id, status, next_review_at);
create index if not exists sop_versions_owner_sop_idx on sop_versions(user_id, sop_id, version_number);
create index if not exists sop_steps_owner_sop_idx on sop_steps(user_id, sop_id, position);
create index if not exists sop_checklist_owner_sop_idx on sop_checklist_items(user_id, sop_id, position);
create index if not exists process_templates_owner_status_idx on process_templates(user_id, status);
create index if not exists process_runs_owner_status_idx on process_runs(user_id, status, due_at);
create index if not exists process_runs_owner_template_idx on process_runs(user_id, process_template_id, status);
create index if not exists process_runs_owner_sop_idx on process_runs(user_id, sop_id);
create index if not exists run_checklist_owner_run_idx on run_checklist_items(user_id, run_id, position);
create index if not exists process_failures_owner_run_idx on process_failures(user_id, run_id, severity);
create index if not exists operational_blockers_owner_run_idx on operational_blockers(user_id, run_id, severity);
create index if not exists quality_checks_owner_sop_idx on quality_checks(user_id, sop_id);
create index if not exists quality_executions_owner_run_idx on quality_executions(user_id, run_id, status);
create index if not exists quality_incidents_owner_status_idx on quality_incidents(user_id, status, severity);
create index if not exists operational_runbooks_owner_sev_idx on operational_runbooks(user_id, severity);
create index if not exists operational_deps_owner_source_idx on operational_dependencies(user_id, source_type, source_id);
create index if not exists operational_systems_owner_status_idx on operational_systems(user_id, status, criticality);
create index if not exists operational_handoffs_owner_run_idx on operational_handoffs(user_id, run_id);
create index if not exists process_improvements_owner_status_idx on process_improvements(user_id, status);
create index if not exists operational_timeline_owner_run_idx on operational_timeline(user_id, run_id, created_at);
create index if not exists operational_links_owner_entity_idx on operational_entity_links(user_id, entity_type, entity_id);

do $$ declare t text; begin
  foreach t in array array[
    'operational_sops', 'sop_versions', 'sop_steps', 'sop_checklist_items',
    'process_templates', 'process_runs', 'run_checklist_items', 'process_failures',
    'operational_blockers', 'quality_checks', 'quality_executions', 'quality_incidents',
    'operational_runbooks', 'operational_dependencies', 'operational_systems',
    'operational_handoffs', 'process_improvements', 'operational_timeline',
    'operational_entity_links'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I_owner_all on %I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t, t);
    execute format('grant select,insert,update,delete on table %I to authenticated', t);
  end loop;
end $$;

do $$ declare t text; begin
  foreach t in array array[
    'operational_sops', 'sop_versions', 'sop_steps', 'sop_checklist_items',
    'process_templates', 'process_runs', 'run_checklist_items', 'process_failures',
    'operational_blockers', 'quality_checks', 'quality_executions', 'quality_incidents',
    'operational_runbooks', 'operational_dependencies', 'operational_systems',
    'operational_handoffs', 'process_improvements'
  ] loop
    execute format('create trigger %I_updated before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

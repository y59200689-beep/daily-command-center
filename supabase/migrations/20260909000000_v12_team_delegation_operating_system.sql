-- V12 Team & Delegation Operating System. Additive, owner-scoped team coordination layer.
-- DO NOT APPLY. Intentionally unapplied. Existing V1-V11 schemas remain canonical.

create table if not exists team_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 240),
  description text,
  responsibility_summary text,
  default_capacity text default 'standard',
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists team_people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 240),
  display_name text,
  role_title text,
  role_id uuid references team_roles(id) on delete set null,
  company_team text,
  email text,
  phone text,
  relationship_type text not null default 'team_member' check (relationship_type in ('team_member', 'contractor', 'freelancer', 'partner', 'advisor', 'client_contact', 'supplier_contact', 'collaborator', 'other')),
  status text not null default 'active' check (status in ('active', 'inactive', 'external', 'archived')),
  timezone text,
  working_hours text,
  notes text,
  avatar_url text,
  linked_contact_id uuid references client_contacts(id) on delete set null,
  linked_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists team_responsibilities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 240),
  description text,
  primary_owner_id uuid references team_people(id) on delete set null,
  backup_owner_id uuid references team_people(id) on delete set null,
  role_id uuid references team_roles(id) on delete set null,
  criticality text not null default 'medium' check (criticality in ('low', 'medium', 'high', 'critical')),
  status text not null default 'active' check (status in ('active', 'needs_owner', 'needs_backup', 'paused', 'archived')),
  review_cadence text default 'monthly',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists team_delegations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 240),
  description text,
  delegated_to_person_id uuid not null references team_people(id) on delete cascade,
  delegated_by_person_id uuid references team_people(id) on delete set null,
  source_entity_type text,
  source_entity_id uuid,
  expected_outcome text not null,
  delegated_at timestamptz not null default now(),
  due_at timestamptz,
  review_at timestamptz,
  status text not null default 'assigned' check (status in ('draft', 'assigned', 'acknowledged', 'in_progress', 'blocked', 'needs_review', 'completed', 'cancelled')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  acknowledged_at timestamptz,
  completed_at timestamptz,
  completion_summary text,
  blocked_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists team_delegation_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delegation_id uuid not null references team_delegations(id) on delete cascade,
  action text not null check (action in ('created', 'assigned', 'acknowledged', 'started', 'blocked', 'unblocked', 'reviewed', 'completed', 'cancelled', 'reassigned')),
  from_person_id uuid references team_people(id) on delete set null,
  to_person_id uuid references team_people(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists team_commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_person_id uuid references team_people(id) on delete set null,
  to_person_id uuid references team_people(id) on delete set null,
  statement text not null check (length(trim(statement)) between 1 and 500),
  source text,
  due_at timestamptz,
  status text not null default 'open' check (status in ('open', 'done', 'cancelled', 'unclear')),
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists team_escalations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_entity_type text,
  source_entity_id uuid,
  person_id uuid references team_people(id) on delete set null,
  reason text not null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  resolution text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists team_availability (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  person_id uuid not null references team_people(id) on delete cascade,
  status text not null default 'available' check (status in ('available', 'limited', 'unavailable')),
  start_at timestamptz,
  end_at timestamptz,
  reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists team_entity_ownership (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  person_id uuid not null references team_people(id) on delete cascade,
  ownership_role text not null default 'owner' check (ownership_role in ('owner', 'backup', 'contributor', 'reviewer', 'consulted')),
  created_at timestamptz not null default now(),
  unique(user_id, entity_type, entity_id, person_id, ownership_role)
);

create table if not exists team_one_on_one_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  person_id uuid not null references team_people(id) on delete cascade,
  note_id uuid references notes(id) on delete cascade,
  meeting_date date not null default current_date,
  topics_discussed text,
  action_items text,
  created_at timestamptz not null default now()
);

create table if not exists team_handoff_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  handoff_id uuid not null references operational_handoffs(id) on delete cascade,
  from_person_id uuid references team_people(id) on delete set null,
  to_person_id uuid references team_people(id) on delete set null,
  handoff_type text not null default 'operational' check (handoff_type in ('project', 'client', 'process', 'sales', 'content', 'finance', 'operational', 'other')),
  created_at timestamptz not null default now()
);

-- Performance indexes
create index if not exists team_people_owner_status_idx on team_people(user_id, status);
create index if not exists team_roles_owner_status_idx on team_roles(user_id, status);
create index if not exists team_responsibilities_owner_status_idx on team_responsibilities(user_id, status, criticality);
create index if not exists team_responsibilities_primary_owner_idx on team_responsibilities(user_id, primary_owner_id);
create index if not exists team_responsibilities_backup_owner_idx on team_responsibilities(user_id, backup_owner_id);
create index if not exists team_delegations_owner_person_idx on team_delegations(user_id, delegated_to_person_id, status);
create index if not exists team_delegations_owner_due_idx on team_delegations(user_id, status, due_at);
create index if not exists team_delegations_owner_review_idx on team_delegations(user_id, status, review_at);
create index if not exists team_delegations_source_idx on team_delegations(user_id, source_entity_type, source_entity_id);
create index if not exists team_delegation_history_owner_del_idx on team_delegation_history(user_id, delegation_id, created_at);
create index if not exists team_commitments_owner_status_idx on team_commitments(user_id, status, due_at);
create index if not exists team_escalations_owner_status_idx on team_escalations(user_id, status, severity);
create index if not exists team_availability_owner_person_idx on team_availability(user_id, person_id, start_at, end_at);
create index if not exists team_ownership_owner_entity_idx on team_entity_ownership(user_id, entity_type, entity_id);
create index if not exists team_ownership_owner_person_idx on team_entity_ownership(user_id, person_id, ownership_role);
create index if not exists team_1on1_owner_person_idx on team_one_on_one_notes(user_id, person_id, meeting_date);
create index if not exists team_handoff_links_owner_handoff_idx on team_handoff_links(user_id, handoff_id);

-- RLS
do $$ declare t text; begin
  foreach t in array array[
    'team_roles', 'team_people', 'team_responsibilities', 'team_delegations',
    'team_delegation_history', 'team_commitments', 'team_escalations',
    'team_availability', 'team_entity_ownership', 'team_one_on_one_notes',
    'team_handoff_links'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I_owner_all on %I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t, t);
    execute format('grant select,insert,update,delete on table %I to authenticated', t);
  end loop;
end $$;

-- Triggers for updated_at
do $$ declare t text; begin
  foreach t in array array[
    'team_roles', 'team_people', 'team_responsibilities', 'team_delegations',
    'team_commitments', 'team_escalations', 'team_availability'
  ] loop
    execute format('create trigger %I_updated before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

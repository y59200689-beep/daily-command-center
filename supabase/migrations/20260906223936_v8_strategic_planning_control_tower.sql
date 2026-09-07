-- V8 Strategic Planning & Control Tower. Additive, owner-scoped planning layer.
create table if not exists planning_periods (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('week','month','quarter','custom')), title text not null check (length(trim(title)) between 1 and 240),
  starts_at date not null, ends_at date not null, status text not null default 'draft' check (status in ('draft','active','completed','archived')),
  theme text, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check (ends_at >= starts_at)
);
create table if not exists strategic_commitments (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  planning_period_id uuid not null references planning_periods(id) on delete cascade, title text not null check (length(trim(title)) between 1 and 240),
  description text, status text not null default 'planned' check (status in ('planned','committed','at_risk','completed','dropped')),
  priority smallint not null default 3 check (priority between 1 and 5), source_type text, source_id uuid, target_date date, confidence numeric(4,3) check (confidence is null or confidence between 0 and 1), notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists strategic_milestones (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  commitment_id uuid references strategic_commitments(id) on delete set null, title text not null check (length(trim(title)) between 1 and 240), milestone_date date,
  status text not null default 'upcoming' check (status in ('upcoming','at_risk','reached','missed','canceled')), source_type text, source_id uuid, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists strategic_dependencies (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  commitment_id uuid not null references strategic_commitments(id) on delete cascade, depends_on_type text not null, depends_on_id uuid not null,
  relation_type text not null default 'depends_on' check (relation_type in ('blocks','depends_on','related')), status text not null default 'open' check (status in ('open','blocked','resolved')), notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(commitment_id, depends_on_type, depends_on_id, relation_type)
);
create table if not exists strategic_scenarios (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 240), description text, assumptions jsonb not null default '[]'::jsonb, impact_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists decision_gates (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  decision_id uuid references decisions(id) on delete set null, commitment_id uuid references strategic_commitments(id) on delete set null, milestone_id uuid references strategic_milestones(id) on delete set null,
  title text not null check (length(trim(title)) between 1 and 240), due_date date, status text not null default 'open' check (status in ('open','resolved','canceled')), notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists planning_periods_owner_range_idx on planning_periods(user_id, starts_at, ends_at) where status <> 'archived';
create index if not exists strategic_commitments_owner_period_idx on strategic_commitments(user_id, planning_period_id, target_date);
create index if not exists strategic_milestones_owner_date_idx on strategic_milestones(user_id, milestone_date);
create index if not exists strategic_dependencies_owner_commitment_idx on strategic_dependencies(user_id, commitment_id, status);
create index if not exists decision_gates_owner_due_idx on decision_gates(user_id, due_date, status);
do $$ declare t text; begin foreach t in array array['planning_periods','strategic_commitments','strategic_milestones','strategic_dependencies','strategic_scenarios','decision_gates'] loop execute format('alter table %I enable row level security',t); execute format('grant select,insert,update,delete on table %I to authenticated',t); execute format('create policy %I_owner_all on %I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',t,t); end loop; end $$;

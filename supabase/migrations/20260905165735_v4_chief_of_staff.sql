-- V4 chief-of-staff layer. Existing integrations and external_references stay canonical.
alter table integrations add column if not exists provider_account_id text;
alter table integrations add column if not exists provider_email text;
alter table integrations add column if not exists display_name text;
alter table integrations add column if not exists scopes text[] not null default '{}';
alter table integrations add column if not exists sync_status text not null default 'idle'
  check (sync_status in ('idle','syncing','healthy','error','attention'));
alter table integrations add column if not exists last_successful_sync_at timestamptz;
alter table integrations add column if not exists last_error text;
create unique index if not exists integrations_provider_account_identity_idx
  on integrations(user_id,provider,provider_account_id) where provider_account_id is not null;

create table email_threads (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  integration_id uuid not null references integrations(id) on delete cascade, provider_thread_id text not null,
  subject text not null default '', snippet text, participants jsonb not null default '[]'::jsonb,
  last_message_at timestamptz, message_count integer not null default 0 check(message_count >= 0), unread boolean not null default false,
  reply_state text not null default 'unknown' check(reply_state in ('awaiting_user_reply','waiting_for_other','no_action_detected','unknown')),
  linked_client_id uuid references clients(id) on delete set null, linked_project_id uuid references projects(id) on delete set null,
  linked_invoice_id uuid references invoices(id) on delete set null, linked_content_id uuid references content_items(id) on delete set null,
  provider_url text, metadata jsonb not null default '{}'::jsonb, last_synced_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id,integration_id,provider_thread_id)
);

create table external_files (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  integration_id uuid not null references integrations(id) on delete cascade, provider text not null check(provider in ('google_drive')),
  provider_file_id text not null, name text not null, mime_type text, web_url text not null, modified_at_external timestamptz,
  linked_entity_type text, linked_entity_id uuid, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id,integration_id,provider_file_id)
);

create table external_repositories (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  integration_id uuid not null references integrations(id) on delete cascade, project_id uuid not null references projects(id) on delete cascade,
  provider_repo_id text not null, full_name text not null, html_url text not null, default_branch text,
  open_issue_count integer not null default 0, open_pr_count integer not null default 0, last_commit_at timestamptz,
  latest_release_name text, workflow_status text, metadata jsonb not null default '{}'::jsonb, last_synced_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id,integration_id,provider_repo_id), unique(user_id,project_id)
);

create table approval_items (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null, entity_type text, entity_id uuid, title text not null, summary text not null,
  payload jsonb not null default '{}'::jsonb, risk_level text not null default 'medium' check(risk_level in ('low','medium','high')),
  status text not null default 'pending' check(status in ('pending','approved','rejected','executed','failed','expired')),
  expires_at timestamptz, approved_at timestamptz, rejected_at timestamptz, executed_at timestamptz, error text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table automations (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  type text not null, name text not null, enabled boolean not null default true, schedule_or_condition jsonb not null default '{}'::jsonb,
  configuration jsonb not null default '{}'::jsonb, last_run_at timestamptz, next_run_at timestamptz,
  last_status text not null default 'idle' check(last_status in ('idle','running','healthy','error')),
  last_error text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id,type)
);

create table automation_runs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  automation_id uuid not null references automations(id) on delete cascade, started_at timestamptz not null default now(),
  finished_at timestamptz, result text not null default 'running' check(result in ('running','success','skipped','failed')),
  records_affected integer not null default 0 check(records_affected >= 0), error text, metadata jsonb not null default '{}'::jsonb
);

create table action_audit_log (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  actor text not null check(actor in ('user','ai','automation','provider')), action_type text not null,
  entity_type text, entity_id uuid, provider text, summary text not null, status text not null default 'success', metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table provider_sync_state (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  integration_id uuid not null references integrations(id) on delete cascade, resource_type text not null, resource_id text not null default 'default',
  sync_token text, etag text, last_external_updated_at timestamptz, last_synced_at timestamptz, last_error text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,integration_id,resource_type,resource_id)
);

create index if not exists email_threads_user_activity_idx on email_threads(user_id,last_message_at desc);
create index if not exists email_threads_client_idx on email_threads(user_id,linked_client_id,last_message_at desc);
create index if not exists external_files_entity_idx on external_files(user_id,linked_entity_type,linked_entity_id);
create index if not exists approvals_queue_idx on approval_items(user_id,status,created_at desc);
create index if not exists automations_owner_next_run_idx on automations(user_id,enabled,next_run_at);
create index if not exists action_audit_owner_created_idx on action_audit_log(user_id,created_at desc);

do $$ declare t text; begin
  foreach t in array array['email_threads','external_files','external_repositories','approval_items','automations','automation_runs','action_audit_log','provider_sync_state'] loop
    execute format('alter table %I enable row level security',t);
    execute format('create policy %I on %I for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)',t||'_owner_all',t);
    execute format('grant select,insert,update,delete on table %I to authenticated',t);
  end loop;
end $$;
do $$ declare t text; begin
  foreach t in array array['email_threads','external_files','external_repositories','approval_items','automations','provider_sync_state'] loop
    execute format('create trigger %I before update on %I for each row execute function set_updated_at()',t||'_updated',t);
  end loop;
end $$;

-- Cross-owner relationship validation for V4 rows. The server validates again before writes.
create or replace function validate_v4_owned_link() returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if tg_table_name in ('email_threads','external_files','external_repositories','provider_sync_state') and not exists(select 1 from integrations where id=new.integration_id and user_id=new.user_id) then
    raise exception 'Integration is not owned by this user.';
  end if;
  if tg_table_name='email_threads' then
    if new.linked_client_id is not null and not exists(select 1 from clients where id=new.linked_client_id and user_id=new.user_id) then raise exception 'Linked client is not owned by this user.'; end if;
    if new.linked_project_id is not null and not exists(select 1 from projects where id=new.linked_project_id and user_id=new.user_id) then raise exception 'Linked project is not owned by this user.'; end if;
  elsif tg_table_name='external_repositories' and not exists(select 1 from projects where id=new.project_id and user_id=new.user_id) then
    raise exception 'Linked project is not owned by this user.';
  end if;
  return new;
end $$;
create trigger email_threads_owned_links before insert or update on email_threads for each row execute function validate_v4_owned_link();
create trigger external_repositories_owned_links before insert or update on external_repositories for each row execute function validate_v4_owned_link();
create trigger external_files_owned_links before insert or update on external_files for each row execute function validate_v4_owned_link();
create trigger provider_sync_state_owned_links before insert or update on provider_sync_state for each row execute function validate_v4_owned_link();

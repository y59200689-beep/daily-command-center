create table public.brainstorm_boards (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 project_id uuid not null references public.projects(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 160),
 task_ids uuid[] not null default '{}',
 scene jsonb not null default '{"elements":[],"appState":{},"files":{}}'::jsonb,
 version integer not null default 1 check(version>0),
 archived boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(cardinality(task_ids)<=100), check(jsonb_typeof(scene)='object'),check(octet_length(scene::text)<=4000000)
);
create index brainstorm_boards_owner_project on public.brainstorm_boards(user_id,project_id,updated_at desc);
alter table public.brainstorm_boards enable row level security;
revoke all on public.brainstorm_boards from anon,authenticated;
grant select,insert,update on public.brainstorm_boards to authenticated;
grant all on public.brainstorm_boards to service_role;
create policy boards_owner_read on public.brainstorm_boards for select to authenticated using((select auth.uid())=user_id);
create policy boards_owner_insert on public.brainstorm_boards for insert to authenticated with check((select auth.uid())=user_id and exists(select 1 from public.projects p where p.id=project_id and p.user_id=(select auth.uid()) and p.deleted_at is null) and not exists(select 1 from unnest(task_ids) t where not exists(select 1 from public.tasks task where task.id=t and task.user_id=(select auth.uid()) and task.project_id=brainstorm_boards.project_id and task.deleted_at is null)));
create policy boards_owner_update on public.brainstorm_boards for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id and exists(select 1 from public.projects p where p.id=project_id and p.user_id=(select auth.uid()) and p.deleted_at is null) and not exists(select 1 from unnest(task_ids) t where not exists(select 1 from public.tasks task where task.id=t and task.user_id=(select auth.uid()) and task.project_id=brainstorm_boards.project_id and task.deleted_at is null)));

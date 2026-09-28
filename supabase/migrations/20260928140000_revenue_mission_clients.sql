-- Clients count toward the First 10K mission only when explicitly linked.
create table if not exists public.revenue_mission_clients (
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  linked_at timestamptz not null default now(),
  primary key (user_id, client_id)
);
alter table public.revenue_mission_clients enable row level security;
create policy revenue_mission_clients_owner_select on public.revenue_mission_clients for select to authenticated using ((select auth.uid()) = user_id);
create policy revenue_mission_clients_owner_insert on public.revenue_mission_clients for insert to authenticated with check ((select auth.uid()) = user_id and exists (select 1 from public.clients c where c.id = client_id and c.user_id = (select auth.uid()) and c.deleted_at is null));
create policy revenue_mission_clients_owner_delete on public.revenue_mission_clients for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, delete on public.revenue_mission_clients to authenticated;

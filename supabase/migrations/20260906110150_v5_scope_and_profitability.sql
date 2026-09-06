-- V5 delivery completion: additive scope-change fields and indexes only.
alter table scope_change_requests add column if not exists title text;
alter table scope_change_requests add column if not exists scope_item_id uuid references scope_items(id) on delete set null;
alter table scope_change_requests add column if not exists estimated_hours numeric(10,2) check (estimated_hours is null or estimated_hours > 0);
alter table scope_change_requests add column if not exists status text not null default 'proposed' check (status in ('proposed','approved','rejected','completed'));

update scope_change_requests set title=left(description,240) where title is null;
alter table scope_change_requests alter column title set not null;
alter table scope_change_requests add constraint scope_change_requests_title_length check (length(trim(title)) between 1 and 240);

create index scope_change_requests_owner_status_idx on scope_change_requests(user_id,project_id,status,requested_at desc);
create index scope_change_requests_owner_scope_item_idx on scope_change_requests(user_id,scope_item_id) where scope_item_id is not null;
create unique index scope_items_project_proposal_item_unique on scope_items(project_id,proposal_item_id) where proposal_item_id is not null;

create or replace function validate_v5_owned_link() returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if tg_table_name='opportunities' then
    if new.lead_id is not null and not exists(select 1 from leads where id=new.lead_id and user_id=new.user_id) then raise exception 'Lead is not owned by this user.'; end if;
    if new.client_id is not null and not exists(select 1 from clients where id=new.client_id and user_id=new.user_id and deleted_at is null) then raise exception 'Client is not owned by this user.'; end if;
  elsif tg_table_name='proposals' then
    if new.opportunity_id is not null and not exists(select 1 from opportunities where id=new.opportunity_id and user_id=new.user_id) then raise exception 'Opportunity is not owned by this user.'; end if;
    if new.lead_id is not null and not exists(select 1 from leads where id=new.lead_id and user_id=new.user_id) then raise exception 'Lead is not owned by this user.'; end if;
    if new.client_id is not null and not exists(select 1 from clients where id=new.client_id and user_id=new.user_id and deleted_at is null) then raise exception 'Client is not owned by this user.'; end if;
  elsif tg_table_name='proposal_items' then
    if not exists(select 1 from proposals where id=new.proposal_id and user_id=new.user_id) then raise exception 'Proposal is not owned by this user.'; end if;
    if new.service_id is not null and not exists(select 1 from services where id=new.service_id and user_id=new.user_id) then raise exception 'Service is not owned by this user.'; end if;
  elsif tg_table_name='scope_items' then
    if not exists(select 1 from projects where id=new.project_id and user_id=new.user_id and deleted_at is null) then raise exception 'Project is not owned by this user.'; end if;
    if new.proposal_item_id is not null and not exists(select 1 from proposal_items where id=new.proposal_item_id and user_id=new.user_id) then raise exception 'Proposal item is not owned by this user.'; end if;
    if new.service_id is not null and not exists(select 1 from services where id=new.service_id and user_id=new.user_id) then raise exception 'Service is not owned by this user.'; end if;
  elsif tg_table_name='scope_change_requests' then
    if not exists(select 1 from projects where id=new.project_id and user_id=new.user_id and deleted_at is null) then raise exception 'Project is not owned by this user.'; end if;
    if new.scope_item_id is not null and not exists(select 1 from scope_items where id=new.scope_item_id and project_id=new.project_id and user_id=new.user_id) then raise exception 'Scope item is not available for this project.'; end if;
  elsif tg_table_name='opportunity_stage_history' then
    if not exists(select 1 from opportunities where id=new.opportunity_id and user_id=new.user_id) then raise exception 'Opportunity is not owned by this user.'; end if;
  elsif tg_table_name='proposal_versions' then
    if not exists(select 1 from proposals where id=new.proposal_id and user_id=new.user_id) then raise exception 'Proposal is not owned by this user.'; end if;
  end if;
  return new;
end $$;
revoke all on function validate_v5_owned_link() from public,anon,authenticated;

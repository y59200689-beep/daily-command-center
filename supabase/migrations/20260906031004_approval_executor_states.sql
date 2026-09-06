-- Approval execution is claimed in the database before any provider or ledger
-- mutation. This makes a refresh or double click return the existing state
-- rather than running an action twice.
alter table approval_items drop constraint if exists approval_items_status_check;
alter table approval_items add constraint approval_items_status_check
  check (status in ('pending','approved','executing','executed','failed','rejected','expired','needs_review'));

create or replace function claim_approval_execution(approval_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare approval approval_items;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;

  select * into approval
  from approval_items
  where id = approval_id and user_id = auth.uid()
  for update;

  if not found then raise exception 'Approval not found.'; end if;

  if approval.expires_at is not null and approval.expires_at <= now()
    and approval.status in ('pending','approved','needs_review') then
    update approval_items set status = 'expired', error = 'Approval expired.' where id = approval.id;
    return jsonb_build_object('status', 'expired', 'approval', to_jsonb(approval));
  end if;

  if approval.status = 'executed' then
    return jsonb_build_object('status', 'executed', 'approval', to_jsonb(approval));
  end if;

  if approval.status = 'executing' then
    return jsonb_build_object('status', 'executing', 'approval', to_jsonb(approval));
  end if;

  if approval.status not in ('pending','approved','needs_review') then
    return jsonb_build_object('status', approval.status, 'approval', to_jsonb(approval));
  end if;

  update approval_items
  set status = 'executing', approved_at = coalesce(approved_at, now()), error = null
  where id = approval.id;

  select * into approval from approval_items where id = approval.id;
  return jsonb_build_object('status', 'claimed', 'approval', to_jsonb(approval));
end $$;

revoke all on function claim_approval_execution(uuid) from public, anon;
grant execute on function claim_approval_execution(uuid) to authenticated;

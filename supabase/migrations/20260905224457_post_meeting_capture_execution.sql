-- Atomic, idempotent execution for explicitly confirmed post-meeting records.
alter table approval_items add column if not exists idempotency_key text;

create unique index if not exists approval_items_owner_action_idempotency_idx
  on approval_items(user_id, action_type, idempotency_key)
  where idempotency_key is not null;

create or replace function execute_meeting_capture(capture_approval_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_approval approval_items%rowtype;
  v_event calendar_events%rowtype;
  v_item jsonb;
  v_input jsonb;
  v_type text;
  v_id uuid;
  v_title text;
  v_project_id uuid;
  v_client_id uuid;
  v_project_ids uuid[] := '{}'::uuid[];
  v_client_ids uuid[] := '{}'::uuid[];
  v_created jsonb := '[]'::jsonb;
  v_counts jsonb := '{"task":0,"decision":0,"followup":0,"waiting":0,"note":0}'::jsonb;
  v_summary text;
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;

  select * into v_approval
  from approval_items
  where id = capture_approval_id
    and user_id = v_user_id
    and action_type = 'create_multiple_meeting_actions'
  for update;

  if not found then raise exception 'Meeting capture is not available.'; end if;
  if v_approval.status = 'executed' then return coalesce(v_approval.payload->'result', '{}'::jsonb); end if;
  if v_approval.status not in ('pending', 'approved') then raise exception 'Meeting capture cannot be executed in its current state.'; end if;
  if v_approval.expires_at is not null and v_approval.expires_at <= now() then raise exception 'Meeting capture has expired.'; end if;

  select * into v_event from calendar_events
  where id = v_approval.entity_id and user_id = v_user_id and deleted_at is null;
  if not found then raise exception 'Meeting is no longer available.'; end if;

  v_summary := nullif(trim(coalesce(v_approval.payload->>'summary', '')), '');

  for v_item in select value from jsonb_array_elements(coalesce(v_approval.payload->'items', '[]'::jsonb)) loop
    v_type := v_item->>'type';
    v_input := coalesce(v_item->'input', '{}'::jsonb);
    v_title := nullif(trim(v_input->>'title'), '');
    if v_type is null or v_type not in ('task','decision','followup','waiting','note') or v_title is null then
      raise exception 'Meeting capture contains an invalid selected item.';
    end if;

    v_project_id := nullif(v_input->>'project_id', '')::uuid;
    v_client_id := nullif(v_input->>'client_id', '')::uuid;
    if v_project_id is not null and not exists(select 1 from projects where id=v_project_id and user_id=v_user_id and deleted_at is null) then
      raise exception 'A selected project is no longer available.';
    end if;
    if v_client_id is not null and not exists(select 1 from clients where id=v_client_id and user_id=v_user_id and deleted_at is null) then
      raise exception 'A selected client is no longer available.';
    end if;
    if v_project_id is not null and not (v_project_id = any(v_project_ids)) then v_project_ids := array_append(v_project_ids,v_project_id); end if;
    if v_client_id is not null and not (v_client_id = any(v_client_ids)) then v_client_ids := array_append(v_client_ids,v_client_id); end if;

    if v_type = 'task' then
      insert into tasks(user_id,title,description,status,priority,project_id,client_id,due_date,created_by)
      values(v_user_id,v_title,nullif(v_input->>'description',''),coalesce(nullif(v_input->>'status',''),'planned')::task_status,coalesce(nullif(v_input->>'priority',''),'none')::task_priority,v_project_id,v_client_id,nullif(v_input->>'due_date','')::date,'user') returning id into v_id;
    elsif v_type = 'decision' then
      insert into decisions(user_id,title,decision,reasoning,project_id,client_id,impact,confidence,status,decision_date,review_date)
      values(v_user_id,v_title,v_input->>'decision',nullif(v_input->>'reasoning',''),v_project_id,v_client_id,coalesce(nullif(v_input->>'impact',''),'medium'),coalesce(nullif(v_input->>'confidence',''),'medium'),coalesce(nullif(v_input->>'status',''),'active'),coalesce(nullif(v_input->>'decision_date','')::date,current_date),nullif(v_input->>'review_date','')::date) returning id into v_id;
    elsif v_type = 'followup' then
      insert into followups(user_id,title,client_id,project_id,due_at,status,notes)
      values(v_user_id,v_title,v_client_id,v_project_id,nullif(v_input->>'due_at','')::timestamptz,coalesce(nullif(v_input->>'status',''),'open'),nullif(v_input->>'notes','')) returning id into v_id;
    elsif v_type = 'waiting' then
      insert into waiting_items(user_id,title,client_id,project_id,contact,expected_by,status,notes)
      values(v_user_id,v_title,v_client_id,v_project_id,nullif(v_input->>'contact',''),nullif(v_input->>'expected_by','')::timestamptz,coalesce(nullif(v_input->>'status',''),'waiting'),nullif(v_input->>'notes','')) returning id into v_id;
    else
      insert into notes(user_id,title,content,category,project_id,client_id,created_by)
      values(v_user_id,v_title,coalesce(v_input->>'content',''),coalesce(nullif(v_input->>'category',''),'meeting'),v_project_id,v_client_id,'user') returning id into v_id;
    end if;

    v_created := v_created || jsonb_build_array(jsonb_build_object(
      'type', v_type, 'id', v_id, 'title', v_title,
      'route', '/' || case v_type when 'task' then 'tasks' when 'decision' then 'decisions' when 'followup' then 'followups' when 'waiting' then 'waiting' else 'notes' end || '/' || v_id::text
    ));
    v_counts := jsonb_set(v_counts, array[v_type], to_jsonb(coalesce((v_counts->>v_type)::integer,0)+1));
  end loop;

  if jsonb_array_length(v_created)=0 and v_summary is null then
    raise exception 'Choose at least one item or add a meeting summary.';
  end if;

  v_project_id := nullif(v_approval.payload->>'projectId','')::uuid;
  v_client_id := nullif(v_approval.payload->>'clientId','')::uuid;
  if v_project_id is not null and not exists(select 1 from projects where id=v_project_id and user_id=v_user_id and deleted_at is null) then
    raise exception 'The meeting project is no longer available.';
  end if;
  if v_client_id is not null and not exists(select 1 from clients where id=v_client_id and user_id=v_user_id and deleted_at is null) then
    raise exception 'The meeting client is no longer available.';
  end if;
  if v_project_id is not null and not (v_project_id = any(v_project_ids)) then v_project_ids := array_append(v_project_ids,v_project_id); end if;
  if v_client_id is not null and not (v_client_id = any(v_client_ids)) then v_client_ids := array_append(v_client_ids,v_client_id); end if;

  foreach v_project_id in array v_project_ids loop
    insert into activity_log(user_id,action,entity_type,entity_id,metadata,actor)
    values(v_user_id,'meeting_outcome_captured','project',v_project_id,jsonb_build_object('meeting_id',v_event.id,'meeting_title',v_event.title,'summary',v_summary,'counts',v_counts),'user');
  end loop;
  foreach v_client_id in array v_client_ids loop
    insert into activity_log(user_id,action,entity_type,entity_id,metadata,actor)
    values(v_user_id,'meeting_outcome_captured','client',v_client_id,jsonb_build_object('meeting_id',v_event.id,'meeting_title',v_event.title,'summary',v_summary,'counts',v_counts),'user');
  end loop;

  insert into action_audit_log(user_id,actor,action_type,entity_type,entity_id,summary,status,metadata)
  values(v_user_id,'user','meeting_outcome_executed','calendar_event',v_event.id,'Saved confirmed outcomes for '||v_event.title,'success',jsonb_build_object('created_count',jsonb_array_length(v_created),'counts',v_counts));

  update approval_items set
    status='executed', approved_at=coalesce(approved_at,now()), executed_at=now(), error=null,
    payload=jsonb_set(payload,'{result}',jsonb_build_object('records',v_created,'summary',v_summary,'counts',v_counts,'meetingId',v_event.id),true)
  where id=v_approval.id and user_id=v_user_id;

  return jsonb_build_object('records',v_created,'summary',v_summary,'counts',v_counts,'meetingId',v_event.id);
end;
$$;

revoke all on function execute_meeting_capture(uuid) from public, anon;
grant execute on function execute_meeting_capture(uuid) to authenticated;

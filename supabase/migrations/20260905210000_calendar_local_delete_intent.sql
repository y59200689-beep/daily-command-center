alter table calendar_event_sync_state
  add column if not exists local_delete_intent boolean not null default false;

create index if not exists calendar_event_sync_state_delete_intent_idx
  on calendar_event_sync_state(user_id, local_delete_intent)
  where local_delete_intent;

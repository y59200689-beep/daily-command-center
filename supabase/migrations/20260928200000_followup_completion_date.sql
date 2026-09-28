-- Persist when a follow-up is completed so daily mission activity is not inferred from later edits.
alter table public.followups add column if not exists completed_at timestamptz;
update public.followups set completed_at = updated_at where status = 'done' and completed_at is null;
create or replace function public.track_followup_completion() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status = 'done' and old.status is distinct from 'done' then
    new.completed_at := now();
  elsif new.status is distinct from 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;
drop trigger if exists followups_completion_timestamp on public.followups;
create trigger followups_completion_timestamp before update of status on public.followups
for each row execute function public.track_followup_completion();

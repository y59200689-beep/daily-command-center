-- V7 follow-up: link existing notes to a trip without duplicating the notes system.
alter table notes add column if not exists trip_id uuid references trips(id) on delete set null;
create index if not exists notes_owner_trip_idx on notes(user_id, trip_id) where deleted_at is null;
create trigger notes_v7_owned before insert or update on notes for each row execute function validate_v7_owned_link('trip_id','trips');

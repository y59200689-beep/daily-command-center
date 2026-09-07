-- V7 Personal Life Operating System. This migration is additive and intentionally
-- excludes sensitive identity values such as passport, national-ID, bank, and card numbers.

create table if not exists personal_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  home_country text check (home_country is null or length(trim(home_country)) between 2 and 120),
  home_city text check (home_city is null or length(trim(home_city)) between 1 and 120),
  default_currency text not null default 'MAD' check (length(default_currency) = 3),
  preferred_timezone text,
  emergency_contact_reference text check (emergency_contact_reference is null or length(trim(emergency_contact_reference)) <= 240),
  passport_country text check (passport_country is null or length(trim(passport_country)) between 2 and 120),
  travel_preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists trips (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 240),
  destination_country text, destination_city text,
  start_date date, end_date date,
  purpose text, status text not null default 'idea' check (status in ('idea','planning','booked','in_progress','completed','canceled')),
  budget numeric(14,2) check (budget is null or budget >= 0), currency text not null default 'MAD' check (length(currency) = 3),
  notes text, archived_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table if not exists trip_segments (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid not null references trips(id) on delete cascade,
  calendar_event_id uuid references calendar_events(id) on delete set null,
  title text not null check (length(trim(title)) between 1 and 240),
  type text not null default 'other' check (type in ('flight','train','bus','hotel','activity','meeting','transfer','other')),
  location text, starts_at timestamptz, ends_at timestamptz, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create table if not exists travel_reservations (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid not null references trips(id) on delete cascade,
  segment_id uuid references trip_segments(id) on delete set null,
  type text not null check (type in ('flight','hotel','riad','apartment','activity','car_rental','restaurant','other')),
  provider text, name text not null check (length(trim(name)) between 1 and 240), location text,
  confirmation_reference text, status text not null default 'booked' check (status in ('booked','scheduled','delayed','canceled','completed')),
  payment_status text check (payment_status is null or payment_status in ('paid','partially_paid','pay_at_property','not_paid')),
  amount numeric(14,2) check (amount is null or amount >= 0), currency text not null default 'MAD' check (length(currency) = 3),
  check_in timestamptz, check_out timestamptz,
  airline text, flight_number text, departure_airport text, arrival_airport text,
  departure_at timestamptz, arrival_at timestamptz, terminal text, gate text,
  checked_baggage text, cabin_baggage text, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (check_out is null or check_in is null or check_out >= check_in),
  check (arrival_at is null or departure_at is null or arrival_at >= departure_at)
);

create table if not exists personal_documents (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('passport','national_id','residence_permit','travel_insurance','vaccination_certificate','driving_permit','insurance','bank_document','vehicle_document','membership','certificate','contract','other')),
  label text not null check (length(trim(label)) between 1 and 240), country text,
  issued_at date, expires_at date, verified_at timestamptz, notes text,
  archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (expires_at is null or issued_at is null or expires_at >= issued_at)
);

create table if not exists trip_document_links (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid not null references trips(id) on delete cascade,
  document_id uuid not null references personal_documents(id) on delete cascade,
  required boolean not null default false, notes text, created_at timestamptz not null default now(),
  unique(trip_id, document_id)
);

create table if not exists visa_applications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid references trips(id) on delete set null,
  country text not null, visa_type text, status text not null default 'researching' check (status in ('researching','preparing','appointment_booked','submitted','additional_documents_requested','approved','rejected','withdrawn')),
  application_date date, appointment_date date, submission_date date, decision_date date, valid_from date, valid_until date,
  application_reference text, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists visa_requirements (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  visa_application_id uuid not null references visa_applications(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 240), completed boolean not null default false, completed_at timestamptz, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists packing_lists (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid references trips(id) on delete cascade, title text not null check (length(trim(title)) between 1 and 240),
  template_name text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists packing_items (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  packing_list_id uuid not null references packing_lists(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 240), category text not null default 'other' check (category in ('documents','clothes','electronics','health','toiletries','sports','work','other')),
  quantity numeric(10,2) check (quantity is null or quantity > 0), packed boolean not null default false, required boolean not null default false, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists personal_renewals (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 240), category text, due_date date,
  lead_time_days integer not null default 30 check (lead_time_days between 0 and 730), cost numeric(14,2) check (cost is null or cost >= 0), currency text not null default 'MAD' check (length(currency) = 3),
  status text not null default 'upcoming' check (status in ('upcoming','in_progress','renewed','expired','canceled')),
  document_id uuid references personal_documents(id) on delete set null, subscription_id uuid references subscriptions(id) on delete set null,
  notes text, completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists personal_admin_items (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 240), category text not null default 'other',
  status text not null default 'todo' check (status in ('todo','waiting','appointment_booked','submitted','completed','canceled')),
  due_date date, next_action text, document_id uuid references personal_documents(id) on delete set null, trip_id uuid references trips(id) on delete set null,
  waiting_item_id uuid references waiting_items(id) on delete set null, notes text, completed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists important_dates (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 240), date date not null, recurrence text check (recurrence is null or recurrence in ('yearly','monthly','none')),
  person_reference text, reminder_lead_days integer not null default 7 check (reminder_lead_days between 0 and 730),
  calendar_event_id uuid references calendar_events(id) on delete set null, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists personal_routines (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 240), frequency text not null default 'weekly' check (frequency in ('daily','weekly')),
  days smallint[] not null default '{}'::smallint[] check (array_length(days,1) is null or (days <@ array[0,1,2,3,4,5,6]::smallint[])),
  time_of_day time, category text, active boolean not null default true, goal_id uuid references goals(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists routine_completions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  routine_id uuid not null references personal_routines(id) on delete cascade, completed_on date not null default current_date,
  created_at timestamptz not null default now(), unique(routine_id, completed_on)
);

alter table tasks add column if not exists trip_id uuid references trips(id) on delete set null;
alter table expenses add column if not exists trip_id uuid references trips(id) on delete set null;

create index if not exists trips_owner_start_idx on trips(user_id,start_date) where archived_at is null;
create index if not exists trip_segments_owner_trip_idx on trip_segments(user_id,trip_id,starts_at);
create index if not exists travel_reservations_owner_trip_idx on travel_reservations(user_id,trip_id,departure_at,check_in);
create index if not exists personal_documents_owner_expiry_idx on personal_documents(user_id,expires_at) where archived_at is null;
create index if not exists visa_applications_owner_status_idx on visa_applications(user_id,status,appointment_date);
create index if not exists personal_renewals_owner_due_idx on personal_renewals(user_id,due_date,status);
create index if not exists personal_admin_owner_due_idx on personal_admin_items(user_id,due_date,status);
create index if not exists important_dates_owner_date_idx on important_dates(user_id,date);
create index if not exists routine_completions_owner_date_idx on routine_completions(user_id,completed_on desc);

-- Generic ownership checks are deliberately database-enforced for every cross-entity link.
create or replace function validate_v7_owned_link() returns trigger language plpgsql security invoker set search_path=public as $$
declare i integer := 0; ref_id uuid; owned boolean;
begin
  while i < coalesce(array_length(tg_argv, 1), 0) loop
    ref_id := nullif(to_jsonb(new)->>tg_argv[i], '')::uuid;
    if ref_id is not null then
      execute format('select exists(select 1 from %I where id=$1 and user_id=$2)', tg_argv[i+1]) into owned using ref_id, new.user_id;
      if not owned then raise exception 'Referenced V7 entity is not owned by this user.'; end if;
    end if;
    i := i + 2;
  end loop;
  return new;
end $$;

create trigger trip_segments_v7_owned before insert or update on trip_segments for each row execute function validate_v7_owned_link('trip_id','trips','calendar_event_id','calendar_events');
create trigger reservations_v7_owned before insert or update on travel_reservations for each row execute function validate_v7_owned_link('trip_id','trips','segment_id','trip_segments');
create trigger trip_document_links_v7_owned before insert or update on trip_document_links for each row execute function validate_v7_owned_link('trip_id','trips','document_id','personal_documents');
create trigger visas_v7_owned before insert or update on visa_applications for each row execute function validate_v7_owned_link('trip_id','trips');
create trigger visa_requirements_v7_owned before insert or update on visa_requirements for each row execute function validate_v7_owned_link('visa_application_id','visa_applications');
create trigger packing_lists_v7_owned before insert or update on packing_lists for each row execute function validate_v7_owned_link('trip_id','trips');
create trigger packing_items_v7_owned before insert or update on packing_items for each row execute function validate_v7_owned_link('packing_list_id','packing_lists');
create trigger renewals_v7_owned before insert or update on personal_renewals for each row execute function validate_v7_owned_link('document_id','personal_documents','subscription_id','subscriptions');
create trigger admin_v7_owned before insert or update on personal_admin_items for each row execute function validate_v7_owned_link('document_id','personal_documents','trip_id','trips','waiting_item_id','waiting_items');
create trigger dates_v7_owned before insert or update on important_dates for each row execute function validate_v7_owned_link('calendar_event_id','calendar_events');
create trigger routines_v7_owned before insert or update on personal_routines for each row execute function validate_v7_owned_link('goal_id','goals');
create trigger routine_completions_v7_owned before insert or update on routine_completions for each row execute function validate_v7_owned_link('routine_id','personal_routines');
create trigger tasks_v7_owned before insert or update on tasks for each row execute function validate_v7_owned_link('trip_id','trips');
create trigger expenses_v7_owned before insert or update on expenses for each row execute function validate_v7_owned_link('trip_id','trips');

do $$ declare t text; begin
  foreach t in array array['personal_profiles','trips','trip_segments','travel_reservations','personal_documents','trip_document_links','visa_applications','visa_requirements','packing_lists','packing_items','personal_renewals','personal_admin_items','important_dates','personal_routines','routine_completions'] loop
    execute format('alter table %I enable row level security', t);
    execute format('grant select,insert,update,delete on table %I to authenticated', t);
    execute format('create policy %I_owner_all on %I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t, t);
  end loop;
end $$;

alter table attachments drop constraint if exists attachments_entity_type_check;
alter table attachments add constraint attachments_entity_type_check check (entity_type in ('task','project','client','note','content','decision','invoice','lead','opportunity','proposal','trip','personal_document')) not valid;

create or replace function enforce_attachment_entity_owner() returns trigger language plpgsql security invoker set search_path=public as $$
declare entity_table text; owned boolean;
begin
  if tg_op = 'UPDATE' and new.user_id = old.user_id and new.entity_type = old.entity_type and new.entity_id = old.entity_id then return new; end if;
  entity_table := case new.entity_type
    when 'task' then 'tasks' when 'project' then 'projects' when 'client' then 'clients' when 'note' then 'notes'
    when 'content' then 'content_items' when 'decision' then 'decisions' when 'invoice' then 'invoices'
    when 'lead' then 'leads' when 'opportunity' then 'opportunities' when 'proposal' then 'proposals'
    when 'trip' then 'trips' when 'personal_document' then 'personal_documents' else null end;
  if entity_table is null then raise exception 'Unsupported attachment entity type.'; end if;
  if new.entity_type in ('lead','opportunity','proposal','trip','personal_document') then
    execute format('select exists(select 1 from %I where id=$1 and user_id=$2 and archived_at is null)', entity_table) into owned using new.entity_id, new.user_id;
  else
    execute format('select exists(select 1 from %I where id=$1 and user_id=$2 and deleted_at is null)', entity_table) into owned using new.entity_id, new.user_id;
  end if;
  if not owned then raise exception 'Attachment target is not owned by this user.'; end if;
  return new;
end $$;

revoke all on function validate_v7_owned_link() from public, anon, authenticated;
revoke all on function enforce_attachment_entity_owner() from public, anon, authenticated;

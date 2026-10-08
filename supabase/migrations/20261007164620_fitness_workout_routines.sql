-- Routines and resumable set logs; completed sessions feed existing Fitness activities.
alter table public.fitness_activities add column if not exists metadata jsonb not null default '{}'::jsonb;
create table public.fitness_routines (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(name) between 1 and 120), notes text not null default '' check(length(notes)<=2000),
 exercises jsonb not null check(jsonb_typeof(exercises)='array' and jsonb_array_length(exercises) between 1 and 30),
 version integer not null default 1, archived boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,id)
);
create table public.fitness_workout_sessions (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 routine_id uuid, name text not null check(length(name) between 1 and 120), notes text not null default '' check(length(notes)<=2000),
 exercises jsonb not null check(jsonb_typeof(exercises)='array' and jsonb_array_length(exercises) between 1 and 30),
 status text not null default 'in_progress' check(status in ('in_progress','completed','discarded')),
 version integer not null default 1, started_at timestamptz not null default now(), completed_at timestamptz,
 activity_id uuid references public.fitness_activities(id), updated_at timestamptz not null default now(),
 foreign key(user_id,routine_id) references public.fitness_routines(user_id,id)
);
create index fitness_routines_owner_updated on public.fitness_routines(user_id,updated_at desc);
create index fitness_workout_sessions_owner_started on public.fitness_workout_sessions(user_id,started_at desc);
alter table public.fitness_routines enable row level security;
alter table public.fitness_workout_sessions enable row level security;
revoke all on public.fitness_routines,public.fitness_workout_sessions from anon,authenticated;
grant select,insert,update on public.fitness_routines,public.fitness_workout_sessions to authenticated;
grant all on public.fitness_routines,public.fitness_workout_sessions to service_role;
create policy fitness_routines_owner on public.fitness_routines for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy fitness_workout_sessions_owner on public.fitness_workout_sessions for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create function public.fitness_finish_workout() returns trigger language plpgsql security invoker set search_path='' as $$
declare e jsonb; s jsonb; volume numeric; set_count integer; finish_time timestamptz; workout_day date;
begin
 if TG_OP='UPDATE' then
  if old.status<>'in_progress' then raise exception 'Finished sessions cannot be modified' using errcode='23514'; end if;
  if new.user_id<>old.user_id or new.started_at<>old.started_at then raise exception 'Workout owner and start are immutable' using errcode='23514'; end if;
 end if;
 if new.version<>(case when TG_OP='UPDATE' then old.version+1 else 1 end) then raise exception 'Invalid workout version' using errcode='23514'; end if;
 for e in select value from jsonb_array_elements(new.exercises) loop
  if jsonb_typeof(e->'sets') is distinct from 'array' or jsonb_array_length(e->'sets') not between 1 and 20 then raise exception 'Invalid sets' using errcode='23514'; end if;
  for s in select value from jsonb_array_elements(e->'sets') loop
   if jsonb_typeof(s->'completed') is distinct from 'boolean' or jsonb_typeof(s->'reps') is distinct from 'number' or jsonb_typeof(s->'weightKg') is distinct from 'number' then raise exception 'Invalid set values' using errcode='23514'; end if;
   if (s->>'reps')::numeric not between 0 and 500 or (s->>'reps')::numeric<>trunc((s->>'reps')::numeric) or (s->>'weightKg')::numeric not between 0 and 1500 or ((s->>'completed')::boolean and (s->>'reps')::numeric<1) then raise exception 'Invalid reps or weight' using errcode='23514'; end if;
  end loop;
 end loop;
 new.updated_at=now();
 new.completed_at=null; new.activity_id=null;
 if new.started_at>now()+interval '5 minutes' then raise exception 'Workout start cannot be in the future' using errcode='23514'; end if;
 if new.status='completed' then
  select coalesce(sum((st.value->>'reps')::numeric*(st.value->>'weightKg')::numeric),0),count(*) into volume,set_count
  from jsonb_array_elements(new.exercises) as ex(value) cross join lateral jsonb_array_elements(ex.value->'sets') as st(value) where (st.value->>'completed')::boolean;
  if set_count=0 then raise exception 'Complete at least one set' using errcode='23514'; end if;
  finish_time=now(); workout_day=(new.started_at at time zone 'Africa/Casablanca')::date;
  insert into public.fitness_activities(user_id,activity_type,activity_date,date,duration_seconds,duration_minutes,source,external_activity_id,notes,metadata)
  values(new.user_id,'Gym',workout_day,workout_day,greatest(1,extract(epoch from finish_time-new.started_at)::integer),greatest(1,ceil(extract(epoch from finish_time-new.started_at)/60)::integer),'workout',new.id::text,new.name||case when new.notes<>'' then E'\n'||new.notes else '' end,jsonb_build_object('total_volume_kg',volume,'completed_sets',set_count,'workout_session_id',new.id,'exercises',new.exercises))
  returning id into new.activity_id;
  new.completed_at=finish_time;
 end if;
 return new;
end; $$;
revoke all on function public.fitness_finish_workout() from public,anon,authenticated;
create trigger fitness_workout_finish before insert or update on public.fitness_workout_sessions for each row execute function public.fitness_finish_workout();

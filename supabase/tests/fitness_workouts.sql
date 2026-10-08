-- Run in a test database or through SQL Editor. Every synthetic record is rolled back.
begin;
insert into auth.users(id) values('f1700000-0000-4000-8000-000000000001'),('f1700000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub','f1700000-0000-4000-8000-000000000001',true);
insert into public.fitness_routines(id,user_id,name,exercises) values('f1700000-0000-4000-8000-000000000003','f1700000-0000-4000-8000-000000000001','Transaction verification','[{"exerciseId":"0025","name":"barbell bench press","sets":2,"reps":8,"weightKg":42.5,"restSeconds":90}]');
insert into public.fitness_workout_sessions(id,user_id,routine_id,name,exercises) values('f1700000-0000-4000-8000-000000000004','f1700000-0000-4000-8000-000000000001','f1700000-0000-4000-8000-000000000003','Transaction verification','[{"exerciseId":"0025","name":"barbell bench press","restSeconds":90,"sets":[{"reps":8,"weightKg":42.5,"completed":true},{"reps":10,"weightKg":40,"completed":false}]}]');
do $$ begin
 if exists(select 1 from public.fitness_activities where external_activity_id='f1700000-0000-4000-8000-000000000004') then raise exception 'Draft counted as activity'; end if;
end $$;
update public.fitness_workout_sessions set status='completed',version=2 where id='f1700000-0000-4000-8000-000000000004' and version=1;
do $$ begin
 if (select count(*) from public.fitness_activities where external_activity_id='f1700000-0000-4000-8000-000000000004')<>1 then raise exception 'Completion activity missing or duplicated'; end if;
 if (select (metadata->>'total_volume_kg')::numeric from public.fitness_activities where external_activity_id='f1700000-0000-4000-8000-000000000004')<>340 then raise exception 'Wrong completed volume'; end if;
 update public.fitness_workout_sessions set status='completed',version=2 where id='f1700000-0000-4000-8000-000000000004' and version=1;
 if found then raise exception 'Stale retry updated completed session'; end if;
 begin
  update public.fitness_workout_sessions set version=3 where id='f1700000-0000-4000-8000-000000000004';
  raise exception 'Finished session was mutable';
 exception when check_violation then null;
 end;
end $$;
select set_config('request.jwt.claim.sub','f1700000-0000-4000-8000-000000000002',true);
do $$ begin
 if exists(select 1 from public.fitness_routines where id='f1700000-0000-4000-8000-000000000003') or exists(select 1 from public.fitness_workout_sessions where id='f1700000-0000-4000-8000-000000000004') then raise exception 'Cross-account read allowed'; end if;
 update public.fitness_workout_sessions set name='Other account' where id='f1700000-0000-4000-8000-000000000004';
 if found then raise exception 'Cross-account update allowed'; end if;
 begin
  insert into public.fitness_workout_sessions(id,user_id,routine_id,name,exercises) values('f1700000-0000-4000-8000-000000000005','f1700000-0000-4000-8000-000000000002','f1700000-0000-4000-8000-000000000003','Other account','[{"exerciseId":"0025","name":"bench","sets":[{"reps":8,"weightKg":40,"completed":false}]}]');
  raise exception 'Cross-account routine accepted';
 exception when foreign_key_violation then null;
 end;
end $$;
reset role;
do $$ begin
 if has_table_privilege('anon','public.fitness_routines','INSERT') or has_table_privilege('anon','public.fitness_workout_sessions','INSERT') then raise exception 'Anonymous insert allowed'; end if;
end $$;
rollback;

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import {boardInput} from '../src/lib/brainstorm';
const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',project='00000000-0000-4000-8000-000000000003',otherProject='00000000-0000-4000-8000-000000000004',task='00000000-0000-4000-8000-000000000005',board='00000000-0000-4000-8000-000000000006';
const input={id:board,projectId:project,title:' Campaign ideas ',taskIds:[task,task],scene:{elements:[],appState:{},files:{}},version:0};
test('board validation preserves scene, trims title and deduplicates linked tasks',()=>{const result=boardInput.parse(input);assert.equal(result.title,'Campaign ideas');assert.deepEqual(result.taskIds,[task]);assert.deepEqual(result.scene,input.scene);assert.ok(!boardInput.safeParse({...input,title:'  '}).success);assert.ok(!boardInput.safeParse({...input,version:-1}).success);assert.ok(!boardInput.safeParse({...input,scene:{elements:'invalid'}}).success);});
test('private boards enforce ownership and project task linkage; CAS prevents stale overwrites',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create table public.projects(id uuid primary key,user_id uuid,deleted_at timestamptz);create table public.tasks(id uuid primary key,user_id uuid,project_id uuid,deleted_at timestamptz);grant select on public.projects,public.tasks to authenticated;insert into auth.users values('${owner}'),('${other}');insert into public.projects values('${project}','${owner}',null),('${otherProject}','${other}',null);insert into public.tasks values('${task}','${owner}','${project}',null);`);
 await db.exec(readFileSync(new URL('../supabase/migrations/20261011110413_project_brainstorm_boards.sql',import.meta.url),'utf8'));
 await db.exec(`set role authenticated;set request.jwt.claim.sub='${owner}';insert into public.brainstorm_boards(id,user_id,project_id,title,task_ids) values('${board}','${owner}','${project}','Ideas',array['${task}']::uuid[]);`);
 await assert.rejects(db.exec(`insert into public.brainstorm_boards(user_id,project_id,title) values('${owner}','${otherProject}','Wrong project')`),/row-level security/);
 await assert.rejects(db.exec(`update public.brainstorm_boards set project_id='${otherProject}' where id='${board}'`),/row-level security/);
 await db.exec(`update public.brainstorm_boards set version=2,title='Saved' where id='${board}' and version=1;update public.brainstorm_boards set title='Stale' where id='${board}' and version=1;`);
 assert.equal((await db.query<{title:string}>('select title from public.brainstorm_boards')).rows[0].title,'Saved');
 await db.exec(`set request.jwt.claim.sub='${other}'`);assert.equal((await db.query('select * from public.brainstorm_boards')).rows.length,0);assert.equal((await db.query(`update public.brainstorm_boards set title='Other user' where id='${board}' returning id`)).rows.length,0);
 await db.exec(`reset role`);assert.equal((await db.query<{allowed:boolean}>("select has_table_privilege('anon','public.brainstorm_boards','INSERT') as allowed")).rows[0].allowed,false);
 }finally{await db.close()}
});

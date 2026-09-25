import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

// Isolated, in-memory PostgreSQL. No Supabase project or network connection.
const db = new PGlite();
await db.exec(`create schema auth; create schema storage;
create role authenticated; create role anon; create role service_role;
create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.role() returns text language sql stable as $$ select current_user::text $$;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid);
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name,'/') $$;
grant usage on schema public,auth,storage to authenticated;
grant select on auth.users to authenticated;
alter default privileges in schema public grant select,insert,update,delete on tables to authenticated;
alter default privileges in schema public grant execute on functions to anon,authenticated;`);

const migrationName = '20260924170000_tier3_learning_synthesis.sql';
const root = new URL('../supabase/migrations/', import.meta.url);
for (const file of readdirSync(root).sort()) {
  if (file === migrationName) continue;
  const sql = readFileSync(new URL(file, root), 'utf8').replace(/create extension if not exists pgcrypto;/i, '');
  await db.exec(sql);
}
const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
const rejects = async (sql, params = []) => assert.rejects(() => db.query(sql, params));
const asUser = async id => db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`);
const asAnon = async () => db.exec("reset role; set role anon; select set_config('request.jwt.claim.sub','',false);");
await db.query('insert into auth.users(id,email) values ($1,$2),($3,$4)', [alice, 'alice@example.test', bob, 'bob@example.test']);
await asUser(alice);
const oldContent = await one("insert into content_items(user_id,title,status) values ($1,'Existing valid item','idea') returning id", [alice]);
const oldCount = (await one('select count(*)::int n from content_items')).n;

await db.exec('reset role; begin');
const tier3 = readFileSync(new URL(migrationName, root), 'utf8');
await db.exec(tier3);
assert.equal((await one("select count(*)::int n from pg_class where relname in ('founder_forecasts','founder_daily_states')")).n, 2);
await db.exec('rollback');
assert.equal((await one("select count(*)::int n from pg_class where relname in ('founder_forecasts','founder_daily_states')")).n, 0);
await db.exec('reset role');
await db.exec('begin');
await db.exec(tier3);
await db.exec('commit');
assert.equal((await one('select count(*)::int n from content_items')).n, oldCount);
assert.equal((await one('select count(*)::int n from content_items where id=$1', [oldContent.id])).n, 1);
for (const table of ['founder_forecasts','founder_daily_states']) {
  assert.equal((await one('select relrowsecurity enabled from pg_class where oid=$1::regclass', [`public.${table}`])).enabled, true);
}
assert.equal((await one("select count(*)::int n from pg_trigger where tgrelid='public.content_items'::regclass and tgname='founder_owner_guard' and not tgisinternal")).n, 1);
console.log('PASS: Tier 3 applies transactionally from pre-Tier-3 schema; expected tables, RLS, content trigger, and existing content survive.');

for (const role of ['anon','authenticated']) {
  assert.equal((await one('select has_function_privilege($1, $2, $3) allowed', [role, 'public.founder_propose_lesson()', 'execute'])).allowed, false);
}
assert.equal((await one("select coalesce(bool_or(a.grantee=0 and a.privilege_type='EXECUTE'),false) allowed from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='public.founder_propose_lesson()'::regprocedure")).allowed, false);
const fn = await one("select prosecdef, proconfig from pg_proc where oid='public.founder_propose_lesson()'::regprocedure");
assert.equal(fn.prosecdef, true);
assert.ok(fn.proconfig.includes('search_path=public'));
console.log('PASS: SECURITY DEFINER trigger has pinned search_path and no anon, authenticated, or PUBLIC direct execution.');

await asUser(alice);
const aClient = await one("insert into clients(user_id,name) values($1,'Alice client') returning id", [alice]);
const aProject = await one("insert into projects(user_id,name) values($1,'Alice project') returning id", [alice]);
const aCampaign = await one("insert into campaigns(user_id,name,client_id) values($1,'Alice campaign',$2) returning id", [alice, aClient.id]);
const aCompany = await one("insert into companies(user_id,name) values($1,'Alice company') returning id", [alice]);
const aSop = await one("insert into operational_sops(user_id,title) values($1,'Alice SOP') returning id", [alice]);
const aKpi = await one("insert into kpi_definitions(user_id,name,unit,direction,source,frequency) values($1,'Alice KPI','count','higher','manual','monthly') returning id", [alice]);
await asUser(bob);
const bClient = await one("insert into clients(user_id,name) values($1,'Bob client') returning id", [bob]);
const bProject = await one("insert into projects(user_id,name) values($1,'Bob project') returning id", [bob]);
const bCampaign = await one("insert into campaigns(user_id,name,client_id) values($1,'Bob campaign',$2) returning id", [bob, bClient.id]);
const bCompany = await one("insert into companies(user_id,name) values($1,'Bob company') returning id", [bob]);
const bSop = await one("insert into operational_sops(user_id,title) values($1,'Bob SOP') returning id", [bob]);
const bKpi = await one("insert into kpi_definitions(user_id,name,unit,direction,source,frequency) values($1,'Bob KPI','count','higher','manual','monthly') returning id", [bob]);
const bContent = await one("insert into content_items(user_id,title,status,company_id,project_id,campaign_id) values($1,'Bob content','idea',$2,$3,$4) returning id", [bob,bCompany.id,bProject.id,bCampaign.id]);
await asUser(alice);
const aContent = await one("insert into content_items(user_id,title,status,company_id,project_id,campaign_id,repurpose_source_id) values($1,'Alice content','idea',$2,$3,$4,$5) returning id", [alice,aCompany.id,aProject.id,aCampaign.id,oldContent.id]);
for (const [column,foreign] of [['company_id',bCompany.id],['project_id',bProject.id],['campaign_id',bCampaign.id],['repurpose_source_id',bContent.id]]) {
  await rejects(`update content_items set ${column}=$1 where id=$2`, [foreign,aContent.id]);
}
await rejects('update content_items set user_id=$1 where id=$2',[bob,aContent.id]);
assert.equal((await one('select company_id,repurpose_source_id from content_items where id=$1',[aContent.id])).company_id,aCompany.id);
console.log('PASS: same-owner content links work; foreign company/project/campaign/repurpose links and owner reassignment fail.');

const aExperiment = await one("insert into growth_experiments(user_id,name,hypothesis,target_metric,company_id,project_id,kpi_id,lesson) values($1,'Alice experiment','A hypothesis','orders',$2,$3,$4,'A useful lesson') returning id",[alice,aCompany.id,aProject.id,aKpi.id]);
await rejects("insert into growth_experiments(user_id,name,hypothesis,target_metric,kpi_id) values($1,'Foreign KPI','A hypothesis','orders',$2)",[alice,bKpi.id]);
await db.query("update growth_experiments set status='completed' where id=$1",[aExperiment.id]);
assert.equal((await one("select count(*)::int n from operating_lessons where user_id=$1 and source_table='growth_experiments' and source_id=$2",[alice,aExperiment.id])).n,1);
await db.query("update growth_experiments set notes='second edit' where id=$1",[aExperiment.id]);
assert.equal((await one("select count(*)::int n from operating_lessons where user_id=$1 and source_table='growth_experiments' and source_id=$2",[alice,aExperiment.id])).n,1);
const aForecast = await one("insert into founder_forecasts(user_id,prediction,predicted_outcome,resolution_date,company_id,project_id,experiment_id,kpi_id) values($1,'Prediction','Expected outcome','2026-12-31',$2,$3,$4,$5) returning id",[alice,aCompany.id,aProject.id,aExperiment.id,aKpi.id]);
await rejects("insert into founder_forecasts(user_id,prediction,predicted_outcome,resolution_date,kpi_id) values($1,'Foreign forecast','Expected','2026-12-31',$2)",[alice,bKpi.id]);
const aDaily = await one('insert into founder_daily_states(user_id,date) values($1,$2) returning id',[alice,'2026-09-24']);
await rejects('insert into founder_daily_states(user_id,date) values($1,$2)',[alice,'2026-09-24']);
const aAsset = await one("insert into asset_metadata(user_id,name,sop_id,content_id) values($1,'Alice asset',$2,$3) returning id",[alice,aSop.id,aContent.id]);
await rejects("insert into asset_metadata(user_id,name,sop_id) values($1,'Foreign SOP',$2)",[alice,bSop.id]);
for (const [table,id] of [['founder_forecasts',aForecast.id],['founder_daily_states',aDaily.id],['growth_experiments',aExperiment.id],['asset_metadata',aAsset.id],['content_items',aContent.id]]) {
  const updateColumn = {founder_forecasts:'calibration_notes',founder_daily_states:'cognitive_notes',growth_experiments:'notes',asset_metadata:'notes',content_items:'brief'}[table];
  assert.equal((await rows(`update ${table} set ${updateColumn}='owner update' where id=$1 returning id`,[id])).length,1);
  await rejects(`update ${table} set user_id=$1 where id=$2`,[bob,id]);
  assert.equal((await rows(`select id from ${table} where id=$1`,[id])).length,1);
  await asUser(bob);
  assert.equal((await rows(`select id from ${table} where id=$1`,[id])).length,0);
  assert.equal((await rows(`update ${table} set ${updateColumn}='peer update' where id=$1 returning id`,[id])).length,0);
  assert.equal((await rows(`delete from ${table} where id=$1 returning id`,[id])).length,0);
  await asUser(alice);
}
await asUser(bob);
for (const sql of [
  "insert into founder_forecasts(user_id,prediction,predicted_outcome,resolution_date) values($1,'Peer forecast','Expected','2026-12-31')",
  "insert into founder_daily_states(user_id,date) values($1,'2026-09-25')",
  "insert into growth_experiments(user_id,name,hypothesis,target_metric) values($1,'Peer experiment','Hypothesis','orders')",
  "insert into asset_metadata(user_id,name) values($1,'Peer asset')",
  "insert into content_items(user_id,title,status) values($1,'Peer content','idea')",
]) await rejects(sql,[alice]);
assert.equal((await one("select count(*)::int n from operating_lessons where source_table='growth_experiments' and source_id=$1",[aExperiment.id])).n,0);
await rejects("select tier1_propose_lesson('experiment',$1,'Attempt to copy Alice lesson')",[aExperiment.id]);
await asAnon();
for (const table of ['founder_forecasts','founder_daily_states','growth_experiments','asset_metadata','content_items']) {
  try { assert.equal((await rows(`select id from ${table}`)).length,0); }
  catch (error) { assert.equal(error.code,'42501'); }
}
await asUser(alice);
for (const [table,id] of [['founder_forecasts',aForecast.id],['founder_daily_states',aDaily.id],['asset_metadata',aAsset.id],['content_items',aContent.id],['growth_experiments',aExperiment.id]]) {
  assert.equal((await rows(`delete from ${table} where id=$1 returning id`,[id])).length,1);
}
await db.exec('reset role');
console.log('PASS: trigger-created lesson is single-owner and deduplicated; five affected tables enforce owner CRUD, peer and anon isolation.');

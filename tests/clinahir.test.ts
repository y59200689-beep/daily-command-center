import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createClinahirLeadHandler, type ClinahirLeadInsert } from '../src/lib/integrations/clinahir';
import { leadSchema } from '../src/lib/business';
import { filterLeads, leadLabel, leadSources } from '../src/lib/leads-dashboard';

const userId = '123e4567-e89b-42d3-a456-426614174000';
const secret = 'a-private-test-secret-with-at-least-32-characters';
const request = (payload: unknown, token = secret) => new Request('http://localhost/api/integrations/clinahir/leads', { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
const payload = { externalId: 'cli_01ABC123', companyName: ' Centre Atlas ', contactName: ' Dr. Ahmed ', email: ' CONTACT@centre.ma ', phone: ' 06  12345678 ', city: ' Casablanca ', message: ' Demo please ', utmSource: 'google', formType: 'demo', landingPage: '/', submittedAt: '2026-10-03T09:00:00Z' };

test('Clinahir handler validates authorization, payloads, mapping, retries and source filtering', async () => {
 const rows: ClinahirLeadInsert[] = [];
 const events: string[] = [];
 const handler = createClinahirLeadHandler({ config: () => ({ secret, userId }), store: () => ({ find: async (_, externalId) => rows.some(row => row.external_id === externalId) ? 'lead-1' : null, insert: async row => { rows.push(row); return 'lead-1'; } }), log: event => events.push(event) });
 assert.equal((await handler(request(payload, 'wrong'))).status, 401);
 assert.equal((await handler(new Request('http://localhost', { method: 'POST', body: '{}' }))).status, 401);
 for (const invalid of [{}, {externalId:'a'}, {...payload,email:'invalid'}, {...payload, submittedAt:'bad'}, {...payload,message:'x'.repeat(33000)}]) assert.equal((await handler(request(invalid))).status, 400);
 assert.equal((await handler(new Request('http://localhost', {method:'POST',headers:{authorization:`Bearer ${secret}`},body:'{bad'}))).status,400);
 const created = await handler(request({...payload,user_id:'attacker',status:'converted',source:'other'}));
 assert.equal(created.status,201); assert.deepEqual(await created.json(),{success:true,created:true,leadId:'lead-1'});
 assert.equal(rows[0].source,'clinahir'); assert.equal(rows[0].source_detail,'website'); assert.equal(rows[0].status,'new'); assert.equal(rows[0].user_id,userId);
 assert.equal(rows[0].email,'contact@centre.ma'); assert.equal(rows[0].city,'Casablanca'); assert.equal(rows[0].phone,'06 12345678');
 assert.equal(rows[0].metadata.utm_source,'google'); assert.equal(rows[0].metadata.submitted_at,payload.submittedAt);
 const duplicate = await handler(request(payload)); assert.equal(duplicate.status,200); assert.equal((await duplicate.json()).duplicate,true); assert.equal(rows.length,1);
 assert.ok(events.includes('unauthorized')); assert.ok(events.includes('invalid_payload'));
 assert.ok(leadSources.includes('clinahir')); assert.equal(leadLabel('clinahir'),'Clinahir');
 const displayed = filterLeads([{...rows[0],id:'lead-1'},{id:'manual',name:'Manual',source:'other'}],[],{query:'',source:['clinahir'],status:'',stage:'',due:false,recent:false,sort:'name'});
 assert.deepEqual(displayed.map(row=>row.id),['lead-1']);
 assert.equal(leadSchema.parse({name:'Manual lead'}).status,'new'); assert.equal(leadSchema.parse({name:'Manual lead'}).source,'other');
 assert.equal((await handler(request({externalId:'email-only',email:'test@example.com'}))).status,201);
});

test('concurrent unique violation returns successful duplicate; database failures are sanitized',async()=>{
 let reads=0;
 const handler=createClinahirLeadHandler({config:()=>({secret,userId}),store:()=>({find:async()=>++reads===1?null:'existing',insert:async()=>{throw {code:'23505'};}}),log:()=>{}});
 const result=await handler(request(payload)); assert.equal(result.status,200); assert.equal((await result.json()).leadId,'existing');
 const failed=createClinahirLeadHandler({config:()=>({secret,userId}),store:()=>{throw new Error('sensitive details');},log:()=>{}});
 const failure=await failed(request(payload));assert.equal(failure.status,500);assert.ok(!(await failure.text()).includes('sensitive'));
 const unconfigured=createClinahirLeadHandler({config:()=>({}),store:()=>{throw new Error('must not reach database');},log:()=>{}});
 assert.equal((await unconfigured(request(payload))).status,500);
});

test('migration preserves manual leads, enforces retry uniqueness and immutable import identity',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon; create role authenticated; create table public.leads(id uuid primary key default gen_random_uuid(),user_id uuid not null,source text not null default 'other',name text not null,status text default 'new',archived_at timestamptz, constraint leads_source_check check(source in ('referral','instagram','website','email','whatsapp_manual','networking','existing_client','other'))); alter table public.leads enable row level security; insert into public.leads(user_id,name) values ('${userId}','Existing manual');`);
 await db.exec(readFileSync(new URL('../supabase/migrations/20261003085714_clinahir_leads_integration.sql',import.meta.url),'utf8'));
 await db.query('insert into public.leads(user_id,name,source,external_id,city,metadata) values ($1,$2,$3,$4,$5,$6)',[userId,'Atlas','clinahir','cli_1','Casablanca',{form_type:'demo'}]);
 await assert.rejects(db.query('insert into public.leads(user_id,name,source,external_id) values ($1,$2,$3,$4)',[userId,'Retry','clinahir','cli_1']),/duplicate key/);
 await db.exec("update public.leads set status='contacted',archived_at=now() where source='clinahir'");
 await assert.rejects(db.exec("update public.leads set source='other' where source='clinahir'"),/identity cannot be changed/);
 await assert.rejects(db.query('insert into public.leads(user_id,name,source,external_id) values ($1,$2,$3,$4)',[userId,'Archived retry','clinahir','cli_1']),/duplicate key/);
 await db.query('insert into public.leads(user_id,name,source) values ($1,$2,$3)',[userId,'New manual','referral']);
 const result=await db.query<{count:number}>('select count(*)::int as count from public.leads'); assert.equal(result.rows[0].count,3);
 const security=await db.query<{relrowsecurity:boolean}>("select relrowsecurity from pg_class where oid='public.leads'::regclass"); assert.equal(security.rows[0].relrowsecurity,true);
 } finally {await db.close();}
});

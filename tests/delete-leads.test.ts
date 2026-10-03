import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteLeads } from '../src/lib/delete-leads';
test('bulk deletion deduplicates IDs, bounds concurrency and reports partial failures', async () => {
 let active=0,peak=0;const requested:string[]=[];
 const request:typeof fetch=async(url,init)=>{
  assert.equal(init?.method,'DELETE');const id=new URL(String(url),'http://localhost').searchParams.get('id')!;
  requested.push(id);active++;peak=Math.max(peak,active);
  await new Promise(resolve=>setTimeout(resolve,5));active--;
  if(id==='network')throw new Error('offline');
  return new Response(null,{status:id==='denied'?403:200});
 };
 const result=await deleteLeads(['a','b','c','d','e','a','denied','network'],request);
 assert.deepEqual(result.deletedIds.sort(),['a','b','c','d','e']);
 assert.deepEqual(result.failedIds.sort(),['denied','network']);
 assert.equal(requested.length,7);assert.ok(peak<=4);
 const retried=await deleteLeads(result.failedIds,async()=>new Response(null,{status:200}));
 assert.deepEqual(retried.deletedIds.sort(),['denied','network']);assert.equal(retried.failedIds.length,0);
});
test('empty selection sends no deletion request',async()=>{
 assert.deepEqual(await deleteLeads([],async()=>{throw new Error('unexpected request');}),{deletedIds:[],failedIds:[]});
});

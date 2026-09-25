import { expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { provisionPeer, cleanupPeer } from "../../scripts/e2e/peer.mjs";
import { getE2ETarget } from "../../scripts/e2e/target.mjs";
import { snapshotRegistry } from "../../scripts/e2e/registry.mjs";
import { identity, normalClient, day, evidence } from "../tier1/workflows";
export async function kpiIsolation() {
 const owner=await normalClient();
 try {
  const {client:peer,metadata}=await provisionPeer();
  const kpi=await peer.from("kpi_definitions").insert({user_id:metadata.userId,name:`TIER1_E2E_${metadata.runId}_private_kpi`,unit:"count",source:"manual",direction:"higher",frequency:"daily",active:true}).select("id").single();
  expect(kpi.error).toBeNull();snapshotRegistry(metadata);
  const observation=await peer.from("kpi_observations").insert({user_id:metadata.userId,kpi_id:kpi.data!.id,observed_on:day(),value:7});expect(observation.error).toBeNull();snapshotRegistry(metadata);
  const foreign=await owner.from("kpi_definitions").select("id").eq("id",kpi.data!.id);expect(foreign.data).toEqual([]);
  const values=await owner.rpc("tier2_kpi_values",{as_of:day()});expect(values.error).toBeNull();expect(values.data.some((r:{id:string})=>r.id===kpi.data!.id)).toBe(false);
  const rejected=await owner.from("kpi_observations").insert({user_id:identity().userId,kpi_id:kpi.data!.id,observed_on:day(),value:1});expect(rejected.error).not.toBeNull();
  const update=await owner.from("kpi_definitions").update({name:"Rejected"}).eq("id",kpi.data!.id).select("id");expect(update.data).toEqual([]);
  const target=getE2ETarget(), anon=createClient(target.url,target.anonKey,{auth:{persistSession:false}});
  expect((await anon.rpc("tier2_kpi_values",{as_of:day()})).error?.code).toBe("42501");
  expect((await anon.from("kpi_observations").select("id")).data??[]).toEqual([]);
  evidence("Tier 2A live normal-user RLS, foreign links and anonymous denial","PASS");
 } finally {await cleanupPeer();}
}
export async function personalIsolation(){
 const owner=await normalClient();try{
  const {client:peer,metadata}=await provisionPeer();
  const doc=await peer.from('personal_documents').insert({user_id:metadata.userId,type:'passport',label:`TIER1_E2E_${metadata.runId}_passport`,verification_status:'verified'}).select('id').single();expect(doc.error).toBeNull();snapshotRegistry(metadata);
  expect((await owner.from('personal_documents').select('id').eq('id',doc.data!.id)).data).toEqual([]);
  const rejected=await owner.from('trips').insert({user_id:identity().userId,title:`TIER1_E2E_${identity().runId}_invalid_passport`,passport_document_id:doc.data!.id});expect(rejected.error).not.toBeNull();
  const system=await peer.from('operational_systems').insert({user_id:metadata.userId,name:`TIER1_E2E_${metadata.runId}_system`,purpose:'Synthetic isolation'}).select('id').single();expect(system.error).toBeNull();snapshotRegistry(metadata);
  const health=await peer.from('system_health_checks').insert({user_id:metadata.userId,system_id:system.data!.id,component:'database',name:'Synthetic probe',reason:'Synthetic evidence',checked_on:day()}).select('id').single();expect(health.error).toBeNull();snapshotRegistry(metadata);
  expect((await owner.from('system_health_checks').select('id').eq('id',health.data!.id)).data).toEqual([]);
  expect((await owner.from('system_health_checks').insert({user_id:identity().userId,system_id:system.data!.id,component:'database',name:'Denied',reason:'Foreign link',checked_on:day()})).error).not.toBeNull();
  const target=getE2ETarget(),anon=createClient(target.url,target.anonKey,{auth:{persistSession:false}});expect((await anon.from('system_health_checks').select('id')).error?.code).toBe('42501');expect((await anon.from('personal_documents').select('id')).data??[]).toEqual([]);
  evidence('Tier 2B/C live normal-user isolation, foreign links and anonymous denial','PASS');
 }finally{await cleanupPeer();}
}

import type {SupabaseClient} from '@supabase/supabase-js';
import {loadFinancialControl} from './financial-server';
import {financialTargets} from './financial-schema';
/** Pending migration absence must not make the existing workspace unusable. Other errors remain visible. */
export async function optionalFinancialOverview(client:SupabaseClient,userId:string){try{return await loadFinancialControl(client,userId);}catch(error){if(error&&typeof error==='object'&&'code' in error&&['42P01','PGRST205'].includes(String(error.code)))return null;throw error;}}
export async function financialSearch(client:SupabaseClient,userId:string,query:string){
 const rows=await Promise.all(['account','budget','obligation','scenario','investment'].map(async type=>{const def=financialTargets[type];const r=await client.from(def.table).select('*').eq('user_id',userId).ilike(def.label,`%${query.replace(/[%_]/g,'')}%`).limit(6);if(r.error){if(['42P01','PGRST205'].includes(r.error.code))return [];throw r.error;}return (r.data??[]).map(row=>({entity_type:'financial_'+type,entity_id:row.id,title:String(row[def.label]),snippet:String(row.status??'Financial planning'),route:def.route+'?record='+row.id}));}));return rows.flat();
}

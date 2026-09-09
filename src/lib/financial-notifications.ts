import type {SupabaseClient} from '@supabase/supabase-js';
import {loadFinancialControl} from './financial-server';
import {notifyOnce} from './v4-notifications';
import type {FinancialRisk} from './financial-control';

export function financialNotificationCandidates(risks:FinancialRisk[]) {
 return risks.filter(r=>r.severity!=='attention').map(r=>({type:'finance' as const,title:r.title,body:`${r.evidence} ${r.action}.`,severity:r.severity,entityType:'financial_'+(r.route.startsWith('/finance/invoices')?'collections':r.route.split('/')[2]?.split('?')[0]??'control'),dedupeKey:r.key,metadata:{route:r.route,currency:r.currency},cooldownHours:24*3650}));
}
export async function emitFinancialNotifications(client:SupabaseClient,userId:string) {
 const overview=await loadFinancialControl(client,userId);
 const candidates=financialNotificationCandidates(overview.risks),active=new Set(candidates.map(c=>c.dedupeKey));
 // Resolve only this producer's conditions, after a complete successful owner-scoped read.
 const previous=await client.from('notifications').select('id,dedupe_key').eq('user_id',userId).like('dedupe_key','financial:%').is('resolved_at',null).limit(1000);
 if(previous.error)throw previous.error;
 for(const row of previous.data??[])if(!active.has(row.dedupe_key)){
  const resolved=await client.from('notifications').update({resolved_at:new Date().toISOString()}).eq('user_id',userId).eq('id',row.id);if(resolved.error)throw resolved.error;
 }
 let affected=0;
 for(const candidate of candidates){
  // Respect dismissal for the entire unresolved condition, not merely a cron cooldown.
  const present=(previous.data??[]).some(n=>n.dedupe_key===candidate.dedupeKey);if(present)continue;
  try{if(await notifyOnce(client,userId,candidate))affected++;}catch(error){if(!(error&&typeof error==='object'&&'code' in error&&error.code==='23505'))throw error;}
 }
 return {affected,overview};
}

export const financialAutomationTypes=['daily_cash_review','weekly_cashflow_review','receivables_review','collections_review','obligations_review','subscription_review','budget_review','monthly_finance_review','quarterly_finance_review','cash_balance_freshness_review'] as const;
export function financialAutomationDue(type:string,schedule:Record<string,unknown>,timezone:string,lastRun:string|null,now=new Date()) {
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const get=(key:string)=>parts.find(p=>p.type===key)?.value??'';
 const date=`${get('year')}-${get('month')}-${get('day')}`,clock=`${get('hour')}:${get('minute')}`;
 const time=String(schedule.time??'08:00');if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||clock<time)return null;
 const weekday=new Date(date+'T00:00:00Z').getUTCDay();
 const days=Array.isArray(schedule.days)?schedule.days: type==='weekly_cashflow_review'?[Number(schedule.day??1)]:[0,1,2,3,4,5,6];
 if(!days.includes(weekday))return null;
 if(type==='monthly_finance_review'&&get('day')!=='01')return null;
 if(type==='quarterly_finance_review'&&(get('day')!=='01'||![1,4,7,10].includes(Number(get('month')))))return null;
 if(lastRun){const last=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(lastRun));if(last>=date)return null;}
 return date;
}
export async function runFinancialAutomation(client:SupabaseClient,userId:string,automationId:string,slot:string) {
 const automation=await client.from('automations').select('*').eq('user_id',userId).eq('id',automationId).eq('enabled',true).maybeSingle();
 if(automation.error)throw automation.error;if(!automation.data||!financialAutomationTypes.includes(automation.data.type as typeof financialAutomationTypes[number]))throw new Error('Financial automation is unavailable or disabled.');
 const run=await client.from('automation_runs').insert({user_id:userId,automation_id:automationId,metadata:{financial_slot:slot}}).select('*').single();
 if(run.error){if(run.error.code==='23505')return {duplicate:true,affected:0};throw run.error;}
 try{
  const {affected}=await emitFinancialNotifications(client,userId);
  const finished=await client.from('automation_runs').update({finished_at:new Date().toISOString(),result:'success',records_affected:affected}).eq('user_id',userId).eq('id',run.data.id);if(finished.error)throw finished.error;
  const updated=await client.from('automations').update({last_run_at:new Date().toISOString(),last_status:'healthy',last_error:null}).eq('user_id',userId).eq('id',automationId);if(updated.error)throw updated.error;
  return {affected,run:{...run.data,result:'success'}};
 }catch(error){await client.from('automation_runs').update({finished_at:new Date().toISOString(),result:'failed',error:'Financial review failed. No money was moved.'}).eq('user_id',userId).eq('id',run.data.id);await client.from('automations').update({last_status:'error',last_error:'Financial review failed.'}).eq('user_id',userId).eq('id',automationId);throw error;}
}

import type { SupabaseClient } from '@supabase/supabase-js';
import {expandedFinancialConditions} from './financial-conditions';
import { financialTables,financialTargets,type FinancialResource,validateFinancialRecord } from './financial-schema';
import { buildForecastEntries,buildCashflowForecast,cashPosition,calculateReceivablesAging,buildFinancialRisks,calculateBudgetVariance,buildGrossToCashBridge,calculateConcentration,buildMonthlyFinanceReview,calculateRunway,evaluateCashBuffer,type FinancialData,type FinancialRow } from './financial-control';

export async function financialOwned(client:SupabaseClient,userId:string,type:string,id:unknown) {
 const def=financialTargets[type];if(!def||typeof id!=='string')throw new Error('Choose a supported record from your workspace.');
 const result=await client.from(def.table).select('*').eq('user_id',userId).eq('id',id).maybeSingle();if(result.error)throw result.error;if(!result.data)throw new Error('Related record unavailable.');return result.data as FinancialRow;
}
export async function saveFinancialRecord(client:SupabaseClient,userId:string,resource:FinancialResource,input:unknown,id?:string) {
 const value=validateFinancialRecord(resource,input);
 if(id) {if(resource==='snapshots'||resource==='links')throw new Error('This record is append-only.');const old=await client.from(financialTables[resource]).select('*').eq('id',id).eq('user_id',userId).maybeSingle();if(old.error)throw old.error;if(!old.data)throw new Error('Record unavailable.');if(old.data.currency&&old.data.currency!==value.currency)throw new Error('Currency cannot change. Create a separate record.');}
 for(const [field,type] of Object.entries({cash_account_id:'account',budget_id:'budget',invoice_id:'invoice',expense_id:'expense',subscription_id:'subscription',commitment_id:'commitment',owner_person_id:'person'})) if(value[field]) {
  const target=await financialOwned(client,userId,type,value[field]);
  if(value.currency&&target.currency&&String(target.currency).trim()!==value.currency)throw new Error('Linked records must use the same currency.');
  if(type==='invoice'&&resource==='promises'&&value.status==='open'&&Number(value.amount)>Number(target.amount_remaining))throw new Error('Promise exceeds the outstanding invoice balance.');
 }
 for(const [typeField,idField] of [['source_type','source_id'],['scope_type','scope_id'],['origin_type','origin_id'],['target_type','target_id']])if(value[idField])await financialOwned(client,userId,String(value[typeField]),value[idField]);
 const result=id?await client.from(financialTables[resource]).update(value).eq('id',id).eq('user_id',userId).select('*').single():await client.from(financialTables[resource]).insert({...value,user_id:userId}).select('*').single();
 if(result.error){if(resource==='snapshots'&&result.error.code==='23505'){const existing=await client.from(financialTables.snapshots).select('*').eq('user_id',userId).eq('request_id',value.request_id).single();if(existing.error)throw existing.error;if(existing.data.cash_account_id!==value.cash_account_id||Number(existing.data.balance)!==Number(value.balance)||Date.parse(existing.data.as_of)!==Date.parse(String(value.as_of))||existing.data.currency!==value.currency)throw new Error('This request already recorded a different balance. Start a new balance entry.');return existing.data;}throw result.error;}return result.data;
}
const sourceTables={invoices:'invoices',payments:'payments',expenses:'expenses',subscriptions:'subscriptions',supplierOrders:'supplier_orders',opportunities:'opportunities',products:'product_catalog_refs',inventory:'inventory_snapshots',clients:'clients'};
export async function loadFinancialControl(client:SupabaseClient,userId:string,today=new Date().toISOString().slice(0,10)) {
 const data:FinancialData={};const truncated:string[]=[];
 await Promise.all(Object.entries({...financialTables,...sourceTables}).map(async([key,table])=>{
  let query=client.from(table).select('*').eq('user_id',userId).order('created_at',{ascending:false}).limit(1001);
  if(['invoices','payments','expenses','subscriptions','clients'].includes(key))query=query.is('deleted_at',null);
  const result=await query;if(result.error)throw result.error;data[key]=(result.data??[]) as FinancialRow[];if(data[key].length>1000)truncated.push(key);
 }));
 if(truncated.length)throw new Error('Financial history exceeds the current calculation limit. Narrow the reporting dataset before using this forecast.');
 const related:Record<string,FinancialRow>={};
 const types=[...new Set(data.links.flatMap(l=>[String(l.origin_type),String(l.target_type)]))];
 await Promise.all(types.map(async type=>{const def=financialTargets[type];if(!def)return;const ids=data.links.flatMap(l=>[...(l.origin_type===type?[String(l.origin_id)]:[]),...(l.target_type===type?[String(l.target_id)]:[])]);const r=await client.from(def.table).select('*').eq('user_id',userId).in('id',[...new Set(ids)]).limit(1001);if(r.error)throw r.error;for(const row of r.data??[])related[type+':'+row.id]={id:row.id,title:row[def.label],route:def.route+'?record='+row.id};}));
 data.links=data.links.map(l=>({...l,origin:related[l.origin_type+':'+l.origin_id]??null,target:related[l.target_type+':'+l.target_id]??null}));
 const cash=data.accounts.flatMap(account=>cashPosition([account],data.snapshots,today,Number(data.settings.find(s=>s.currency===account.currency)?.stale_days??7)));
 const opening:Record<string,number|null>={};for(const a of cash)opening[a.currency]=a.balance===null||opening[a.currency]===null?null:(opening[a.currency]??0)+a.balance;
 const entries=buildForecastEntries(data,today),forecasts=buildCashflowForecast(opening,entries,today),receivables=calculateReceivablesAging(data.invoices,today);
 const risks=expandedFinancialConditions(data,opening,entries,buildFinancialRisks({cash,forecasts,receivables,settings:data.settings,obligations:data.obligations,promises:data.promises,today}),today);
 const budgets=data.budgets.map(b=>({id:b.id,name:b.name,currency:b.currency,variance:calculateBudgetVariance(b,data.expenses,data.obligations)}));
 const buffer=Object.keys(opening).map(c=>{const s=data.settings.find(r=>r.currency===c);const target=s?.buffer_amount!=null?Number(s.buffer_amount):s?.buffer_months!=null&&s?.baseline_monthly_cost!=null?Number(s.buffer_months)*Number(s.baseline_monthly_cost):null;return {currency:c,target,state:evaluateCashBuffer(opening[c],target)};});
 const start=today.slice(0,7)+'-01',d=new Date(today+'T00:00:00Z');const quarterStart=new Date(Date.UTC(d.getUTCFullYear(),Math.floor(d.getUTCMonth()/3)*3,1)).toISOString().slice(0,10);
 const runway=Object.keys(opening).map(c=>{const s=data.settings.find(r=>r.currency===c);const months=Array.from({length:3},(_,n)=>{const from=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-3+n,1)).toISOString().slice(0,10),to=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-2+n,1)).toISOString().slice(0,10);return {inflow:data.payments.filter(p=>p.currency===c&&String(p.payment_date)>=from&&String(p.payment_date)<to).reduce((n,p)=>n+Number(p.amount),0),outflow:data.obligations.filter(o=>o.currency===c&&o.status==='paid'&&String(o.paid_at)>=from&&String(o.paid_at)<to).reduce((n,o)=>n+Number(o.amount),0)};});const from=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-3,1)).toISOString().slice(0,10);return {currency:c,...calculateRunway(opening[c],months,!!s?.cash_history_complete_from&&String(s.cash_history_complete_from)<=from)};});
 const latest=new Map<string,FinancialRow>();for(const row of [...data.inventory].sort((a,b)=>String(b.captured_at).localeCompare(String(a.captured_at))))if(!latest.has(String(row.product_id)))latest.set(String(row.product_id),row);
 const inventory=data.products.map(p=>({id:p.id,name:p.name,currency:p.currency,value:p.unit_cost!=null&&latest.get(p.id)?.available_stock!=null?Number(p.unit_cost)*Number(latest.get(p.id)!.available_stock):null,asOf:latest.get(p.id)?.captured_at??null}));
 return {today,data,cash,opening,entries,forecasts,receivables,risks,nextMove:risks[0]??null,budgets,buffer,runway,inventory,bridge:buildGrossToCashBridge(data.invoices,data.payments,data.expenses),concentration:calculateConcentration(data.payments.map(p=>({entity:p.client_id?String(p.client_id):null,currency:String(p.currency),amount:Number(p.amount)}))),inflowConcentration:calculateConcentration(entries.filter(e=>e.direction==='in'&&e.confidence!=='possible'&&e.date&&e.date>=today&&e.date<=new Date(Date.parse(today)+30*86400000).toISOString().slice(0,10)).map(e=>({entity:e.clientId??null,currency:e.currency,amount:e.amount}))),monthly:buildMonthlyFinanceReview(data,start,today),quarterly:buildMonthlyFinanceReview(data,quarterStart,today),limitations:['Balances are manually recorded, not live bank balances.','Undated and possible entries are excluded from core closing cash.','Recorded expenses do not by themselves establish cash settlement.','Inventory values use known unit costs only. Formal current assets/liabilities are incomplete.']};
}

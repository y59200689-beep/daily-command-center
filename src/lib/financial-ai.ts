import {z} from 'zod';
import type {SupabaseClient} from '@supabase/supabase-js';
import {financialSchemas,type FinancialResource} from './financial-schema';
import {loadFinancialControl,saveFinancialRecord} from './financial-server';
export const financialReadNames=['get_financial_control_overview','get_next_financial_move','get_cash_position','get_cashflow_forecast','get_receivables','get_collections_queue','get_obligations','get_budget_status','get_runway','get_cash_buffer','get_financial_risks','get_scenario','get_monthly_finance_review','get_quarterly_finance_review'];
export const financialWrites:Record<string,FinancialResource>={create_cash_account:'accounts',record_cash_balance:'snapshots',create_financial_obligation:'obligations',create_budget:'budgets',create_financial_scenario:'scenarios',create_planned_investment:'investments',create_payment_promise:'promises'};
export const financialAssistantTools=[
 ...financialReadNames.filter(n=>n!=='get_financial_risks').map(name=>({type:'function',name,description:'Read authenticated financial planning data. Preserve unknown balances, separate currencies, and never imply bank connectivity.',parameters:{type:'object',properties:name==='get_scenario'?{id:{type:'string'}}:{},required:name==='get_scenario'?['id']:[],additionalProperties:false}})),
 ...Object.entries(financialWrites).map(([name,resource])=>({type:'function',name,description:'Save a financial planning record only after explicit confirmation of its exact fields. This never moves money.',parameters:{type:'object',properties:{record:z.toJSONSchema(financialSchemas[resource]),confirmed:{type:'boolean'}},required:['record','confirmed'],additionalProperties:false}})),
];
export async function executeFinancialTool(client:SupabaseClient,userId:string,name:string,raw:unknown){
 if(financialWrites[name]){const input=z.object({record:z.unknown(),confirmed:z.boolean()}).strict().parse(raw);if(!input.confirmed)return {confirmation_required:true,message:'Confirm the exact financial record before saving.'};return saveFinancialRecord(client,userId,financialWrites[name],input.record);}
 const input=(name==='get_scenario'?z.object({id:z.uuid()}):z.object({})).strict().parse(raw);
 const overview=await loadFinancialControl(client,userId);
 const values:Record<string,unknown>={get_financial_control_overview:overview,get_next_financial_move:overview.nextMove,get_cash_position:overview.cash,get_cashflow_forecast:overview.forecasts,get_receivables:overview.receivables,get_collections_queue:overview.receivables,get_obligations:overview.data.obligations,get_budget_status:overview.budgets,get_runway:overview.runway,get_cash_buffer:overview.buffer,get_financial_risks:overview.risks,get_scenario:overview.data.scenarios.find(s=>'id' in input&&s.id===input.id)??null,get_monthly_finance_review:overview.monthly,get_quarterly_finance_review:overview.quarterly};
 return values[name];
}

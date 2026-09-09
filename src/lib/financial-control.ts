/** Deterministic financial planning. Amounts stay in their source currency. */
export type FinancialRow = { id: string; [key: string]: unknown };
export type ForecastEntry = { key: string; sourceType: string; sourceId: string; title: string; currency: string; amount: number; date: string | null; direction: 'in'|'out'; confidence: 'committed'|'expected'|'possible'; clientId?: string; route: string; assumption: string };
export type FinancialRisk = { key: string; title: string; evidence: string; currency: string; amount: number | null; date: string | null; severity: 'attention'|'important'|'critical'; score: number; route: string; action: string };
export type FinancialData = Record<string, FinancialRow[]>;
const number = (v: unknown): number | null => v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);
const day = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0,10) : null;
const currency = (r: FinancialRow) => String(r.currency ?? '').trim();
const cents = (n: number) => Math.round((n + Number.EPSILON)*100)/100;
export const addFinancialDays = (date: string, n: number) => new Date(Date.parse(date+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
export const financialDays = (a: string,b: string) => Math.floor((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000);
const sum = (rows: FinancialRow[], field: string) => cents(rows.reduce((n,r)=>n+(number(r[field])??0),0));
export function cashPosition(accounts: FinancialRow[], snapshots: FinancialRow[], today: string, staleDays=7) {
 return accounts.filter(a=>a.status==='active').map(account=>{
  const snapshot=snapshots.filter(s=>s.cash_account_id===account.id&&currency(s)===currency(account)&&String(s.as_of).slice(0,10)<=today).sort((a,b)=>String(b.as_of).localeCompare(String(a.as_of))||String(b.created_at).localeCompare(String(a.created_at)))[0];
  return {id:account.id,name:String(account.name),currency:currency(account),balance:snapshot?number(snapshot.balance):null,asOf:snapshot?String(snapshot.as_of):null,stale:!!snapshot&&financialDays(String(snapshot.as_of).slice(0,10),today)>staleDays};
 });
}
export function classifyForecastConfidence(source: string, confirmed=false): ForecastEntry['confidence'] { return source==='opportunity'?'possible':confirmed?'committed':'expected'; }
export function calculateReceivablesAging(invoices: FinancialRow[],today: string): Array<FinancialRow & {outstanding:number;overdueDays:number|null;aging:string}> {
 return invoices.filter(i=>!['draft','paid','cancelled'].includes(String(i.status))&&(number(i.amount_remaining)??0)>0).map(i=>{
  const due=day(i.due_date),overdue=due?Math.max(0,financialDays(due,today)):null;
  return {...i,outstanding:number(i.amount_remaining)!,overdueDays:overdue,aging:overdue===null?'Undated':overdue===0?'Current':overdue<=30?'1–30':overdue<=60?'31–60':overdue<=90?'61–90':'90+'};
 });
}
export function evaluateCollectionPriority(input:{overdueDays:number|null;amount:number;cashNeed?:boolean;promiseMissed?:boolean}) {
 if(input.amount<=0)return 'Routine';
 if(input.promiseMissed&&input.cashNeed||input.overdueDays!==null&&input.overdueDays>90)return 'Critical';
 if(input.promiseMissed||input.cashNeed&&(input.overdueDays??0)>0||(input.overdueDays??0)>30)return 'High priority';
 return (input.overdueDays??0)>0?'Follow up':'Routine';
}
function nextMonth(date:string,months:number) {
 const d=new Date(date+'T00:00:00Z'),original=d.getUTCDate();
 d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+months);
 const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(original,last));return d.toISOString().slice(0,10);
}
export function buildForecastEntries(data:FinancialData,today:string):ForecastEntry[] {
 const entries:ForecastEntry[]=[];const end=addFinancialDays(today,90);
 const push=(r:FinancialRow,type:string,direction:'in'|'out',amount:number,date:string|null,confidence:ForecastEntry['confidence'],assumption:string,route:string)=>{if(amount>0&&currency(r))entries.push({key:`${type}:${r.id}:${date??'undated'}`,sourceType:type,sourceId:r.id,title:String(r.title??r.name??r.invoice_number??r.reference??type),currency:currency(r),amount:cents(amount),date,direction,confidence,clientId:r.client_id?String(r.client_id):undefined,assumption,route});};
 for(const i of calculateReceivablesAging(data.invoices??[],today)) {
  const promise=(data.promises??[]).filter(p=>p.invoice_id===i.id&&p.status==='open'&&currency(p)===currency(i)).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)))[0];
  const promised=promise?Math.min(i.outstanding,number(promise.amount)??0):0;
  if(promise&&promised>0)push({...i,id:promise.id},'promise','in',promised,day(promise.promised_date),'committed','Manually recorded payment promise; not a received payment.',`/finance/invoices?record=${i.id}`);
  const due=day(i.due_date);
  if(i.outstanding>promised)push(i,'invoice','in',i.outstanding-promised,due&&due>=today?due:null,'expected',due&&due<today?'Overdue; collection date unknown and excluded from dated forecast.':'Invoice due date used as expected collection date.',`/finance/invoices?record=${i.id}`);
 }
 for(const s of data.subscriptions??[]) if(s.status==='active'&&!s.deleted_at){
  let date=day(s.next_billing_date); const months=({monthly:1,quarterly:3,yearly:12} as Record<string,number>)[String(s.billing_cycle)];
  for(let count=0;date&&date<=end&&count<120;count++) {
   if(date>=today&&!(data.obligations??[]).some(o=>o.source_type==='subscription'&&o.source_id===s.id&&day(o.due_at)===date&&currency(o)===currency(s)&&o.status!=='cancelled'))push(s,'subscription','out',number(s.amount)??0,date,'committed','Scheduled renewal; actual settlement not assumed.','/finance/subscriptions?record='+s.id);
   if(!months)break;date=nextMonth(date,months);
  }
 }
 for(const o of data.obligations??[]) if(!['paid','cancelled','deferred'].includes(String(o.status)))push(o,'obligation','out',number(o.amount)??0,day(o.due_at)&&String(o.due_at)<today?today:day(o.due_at),o.status==='planned'?'possible':'committed',String(o.due_at)<today?'Overdue unpaid obligation included immediately; payment date is not known.':'Explicit future obligation.','/financial-control/obligations?record='+o.id);
 for(const i of data.investments??[])if(!['spent','cancelled'].includes(String(i.status))&&!i.expense_id)push(i,'investment','out',number(i.amount)??0,day(i.target_date),['approved','scheduled'].includes(String(i.status))?'committed':'possible','Planned investment; no money has moved.','/financial-control/investments?record='+i.id);
 // A supplier delivery date is not a payment due date. Keep undated unless an explicit obligation provides timing.
 for(const o of data.supplierOrders??[])if(['ordered','partially_received'].includes(String(o.status))&&!(data.obligations??[]).some(x=>x.source_type==='supplier_order'&&x.source_id===o.id))push(o,'supplier_order','out',number(o.total_value)??0,null,'expected','Supplier payment terms/date unavailable; record a linked obligation.','/founder/supplier-orders');
 for(const o of data.opportunities??[])if(!['won','lost'].includes(String(o.stage)))push(o,'opportunity','in',number(o.estimated_value)??0,day(o.expected_close_date),'possible','Sales pipeline is hypothetical and excluded from core cash.','/pipeline?opportunity='+o.id);
 return entries;
}
export function reconcileForecastToActual(entries:ForecastEntry[],actuals:Array<{sourceType:string;sourceId:string;currency:string;amount:number}>) {
 const remaining=new Map<string,number>();for(const a of actuals){const key=[a.sourceType,a.sourceId,a.currency].join(':');remaining.set(key,(remaining.get(key)??0)+a.amount);}
 return [...entries].sort((a,b)=>(a.date??'9999').localeCompare(b.date??'9999')).map(e=>{const key=[e.sourceType,e.sourceId,e.currency].join(':'),settled=Math.min(e.amount,remaining.get(key)??0);remaining.set(key,(remaining.get(key)??0)-settled);return {...e,amount:cents(e.amount-settled)};}).filter(e=>e.amount>0);
}
export function buildCashflowForecast(opening:Record<string,number|null>,entries:ForecastEntry[],today:string,includePossible=false) {
 const currencies=[...new Set([...Object.keys(opening),...entries.map(e=>e.currency)])].sort();
 return currencies.map(c=>{
  let balance=opening[c]??null;const buckets=[];
  for(const [from,to] of [[0,30],[30,60],[60,90]]) {
   const start=addFinancialDays(today,from),end=addFinancialDays(today,to);
   const items=entries.filter(e=>e.currency===c&&e.date&&e.date>=start&&(to===90?e.date<=end:e.date<end)&&(includePossible||e.confidence!=='possible'));
   const inflows=cents(items.filter(e=>e.direction==='in').reduce((n,e)=>n+e.amount,0)),outflows=cents(items.filter(e=>e.direction==='out').reduce((n,e)=>n+e.amount,0));
   const initial=balance;balance=balance===null?null:cents(balance+inflows-outflows);
   buckets.push({start,end,opening:initial,inflows,outflows,closing:balance,items});
  }
  const dated=entries.filter(e=>e.currency===c&&e.date&&e.date>=today&&e.date<=addFinancialDays(today,90)&&(includePossible||e.confidence!=='possible')).sort((a,b)=>a.date!.localeCompare(b.date!)||(a.direction==='out'?-1:1));
  let running=opening[c]??null;let lowest=running;const daily: {date:string;balance:number|null}[]=[];
  for(const e of dated){running=running===null?null:cents(running+(e.direction==='in'?e.amount:-e.amount));if(running!==null)lowest=Math.min(lowest??running,running);daily.push({date:e.date!,balance:running});}
  return {currency:c,buckets,lowest,daily,undated:entries.filter(e=>e.currency===c&&!e.date),basis:'Manual cash snapshots; dated committed/expected entries. Same-day outflows precede inflows conservatively.'};
 });
}
export function calculateRunway(cash:number|null,months:Array<{inflow:number;outflow:number}>,complete:boolean) {
 if(cash===null||!complete||months.length<3)return {state:'unavailable',months:null,grossOutflow:null,netBurn:null};
 const gross=months.reduce((n,m)=>n+m.outflow,0)/months.length,burn=months.reduce((n,m)=>n+m.outflow-m.inflow,0)/months.length;
 return {state:burn<=0?'cashflow_positive':'estimated',months:burn>0?Math.max(0,cash)/burn:null,grossOutflow:cents(gross),netBurn:cents(burn)};
}
export function evaluateCashBuffer(cash:number|null,target:number|null){return cash===null||target===null?'Unknown':cash<target?'Below target':cash<target*1.2?'Near target':'Above target';}
export function calculateBudgetVariance(budget:FinancialRow,expenses:FinancialRow[],obligations:FinancialRow[]) {
 const matches=(r:FinancialRow,date:unknown)=>currency(r)===currency(budget)&&!!day(date)&&day(date)!>=String(budget.period_start)&&day(date)!<=String(budget.period_end)&&(!budget.category||r.category===budget.category)&&(!budget.scope_id||r[`${budget.scope_type}_id`]===budget.scope_id||r.source_type===budget.scope_type&&r.source_id===budget.scope_id);
 const incurred=expenses.filter(e=>matches(e,e.expense_date));
 const committed=obligations.filter(o=>matches(o,o.due_at)&&['committed','due'].includes(String(o.status))&&!o.expense_id);
 const paid=obligations.filter(o=>matches(o,o.paid_at)&&o.status==='paid');
 return {budget:number(budget.amount)??0,recordedExpenses:sum(incurred,'amount'),committed:sum(committed,'amount'),paid:sum(paid,'amount'),remaining:cents((number(budget.amount)??0)-sum(incurred,'amount')-sum(committed,'amount')-sum(paid.filter(o=>!o.expense_id),'amount')),paidBasis:'Explicit paid obligations only. Expense records do not establish settlement.'};
}
export function calculateConcentration(rows:Array<{entity:string|null;currency:string;amount:number}>,threshold=.5) {
 const totals=new Map<string,number>(),groups=new Map<string,{entity:string;currency:string;amount:number}>();
 for(const r of rows) {if(r.amount<=0)continue;totals.set(r.currency,(totals.get(r.currency)??0)+r.amount);if(!r.entity)continue;const k=r.currency+':'+r.entity;const g=groups.get(k)??{entity:r.entity,currency:r.currency,amount:0};g.amount+=r.amount;groups.set(k,g);}
 return [...groups.values()].map(g=>({...g,share:g.amount/totals.get(g.currency)!,state:g.amount/totals.get(g.currency)!>=Math.max(.75,threshold)?'Highly concentrated':g.amount/totals.get(g.currency)!>=threshold?'Concentrated':'Distributed'})).sort((a,b)=>b.share-a.share||a.entity.localeCompare(b.entity));
}
export function buildGrossToCashBridge(invoices:FinancialRow[],payments:FinancialRow[],expenses:FinancialRow[]) {
 return [...new Set([...invoices,...payments,...expenses].map(currency))].filter(Boolean).sort().map(c=>({currency:c,invoiced:sum(invoices.filter(i=>currency(i)===c&&!['draft','cancelled'].includes(String(i.status))),'total_amount'),collected:sum(payments.filter(p=>currency(p)===c),'amount'),outstanding:sum(invoices.filter(i=>currency(i)===c&&!['draft','cancelled'].includes(String(i.status))),'amount_remaining'),recordedExpenses:sum(expenses.filter(e=>currency(e)===c),'amount'),netIncome:null,basis:'Invoiced and collected are separate measures; payments are not added to invoiced revenue.'}));
}
export function evaluateInvestmentAffordability(amount:number,cash:number|null,lowest:number|null,buffer:number|null) {
 if(cash===null||lowest===null||buffer===null)return 'Insufficient data';
 if(Math.min(cash,lowest)-amount<buffer)return 'Would breach buffer';
 return Math.min(cash,lowest)-amount<buffer*1.2?'Affordable with caution':'Affordable now';
}
export function applyFinancialScenario(entries:ForecastEntry[],scenario:FinancialRow,today:string) {
 const adjusted=entries.filter(e=>e.currency!==currency(scenario)||e.sourceType!=='opportunity'||scenario.include_pipeline===true).map(e=>e.currency!==currency(scenario)?{...e}:{...e,confidence:e.sourceType==='opportunity'&&scenario.include_pipeline===true?'expected' as const:e.confidence,amount:cents(e.amount*(1+(number(e.direction==='in'?scenario.inflow_change_percent:scenario.outflow_change_percent)??0)/100)),date:e.direction==='in'&&e.date?addFinancialDays(e.date,number(scenario.collection_delay_days)??0):e.date});
 const start=day(scenario.starts_at);if(start){for(let n=0;n<4;n++){const date=nextMonth(start,n);if(date>addFinancialDays(today,90))break;if(date<today)continue;const amount=(number(scenario.monthly_cost)??0)+(n===0?(number(scenario.setup_cost)??0):0);if(amount>0)adjusted.push({key:`scenario:${scenario.id}:${date}`,sourceId:scenario.id,sourceType:'scenario',title:'Hypothetical contractor/investment cost',currency:currency(scenario),amount,date,direction:'out',confidence:'committed',route:'/financial-control/scenarios',assumption:'Scenario only; no live records changed.'});}}
 return adjusted;
}
export function buildFinancialRisks(input:{cash:ReturnType<typeof cashPosition>;forecasts:ReturnType<typeof buildCashflowForecast>;receivables:ReturnType<typeof calculateReceivablesAging>;settings:FinancialRow[];obligations:FinancialRow[];promises:FinancialRow[];today:string}) {
 const risks:FinancialRisk[]=[]; const add=(key:string,title:string,evidence:string,c:string,amount:number|null,date:string|null,score:number,route:string,action:string)=>risks.push({key:`financial:${key}`,title,evidence,currency:c,amount,date,score,severity:score>=90?'critical':score>=70?'important':'attention',route,action});
 for(const a of input.cash)if(a.stale||a.balance===null)add('cash-stale:'+a.id,'Refresh cash balance',a.asOf?`Manual balance as of ${a.asOf}.`:'No balance snapshot exists.',a.currency,a.balance,null,75,'/financial-control/accounts','Record current balance');
 for(const f of input.forecasts){const s=input.settings.find(s=>currency(s)===f.currency),buffer=number(s?.buffer_amount)??(number(s?.buffer_months)!==null&&number(s?.baseline_monthly_cost)!==null?Number(s!.buffer_months)*Number(s!.baseline_monthly_cost):null);if(buffer!==null&&f.lowest!==null&&f.lowest<buffer)add('buffer:'+f.currency,'Projected cash buffer breach',`Lowest projected cash ${f.lowest}; configured reserve ${buffer}.`,f.currency,buffer-f.lowest,f.daily.find(d=>d.balance!==null&&d.balance<buffer)?.date??input.today,95,'/financial-control/cashflow','Review timing and coverage');}
 for(const i of input.receivables)if((i.overdueDays??0)>30)add('receivable:'+i.id,'Overdue receivable needs collection',`${i.overdueDays} days overdue; ${i.outstanding} remains outstanding.`,currency(i),i.outstanding,day(i.due_date),i.overdueDays!>90?90:75,`/finance/invoices?record=${i.id}`,'Prepare follow-up');
 for(const p of input.promises)if(p.status==='missed'||p.status==='open'&&String(p.promised_date)<input.today)add('promise:'+p.id,'Payment promise date passed','Review actual receipts before marking this promise met.',currency(p),number(p.amount),day(p.promised_date),80,'/financial-control/promises','Review promise');
 for(const o of input.obligations)if(['committed','due'].includes(String(o.status))&&String(o.due_at)<=addFinancialDays(input.today,7))add('obligation:'+o.id,'Obligation due',String(o.title),currency(o),number(o.amount),day(o.due_at),o.criticality==='critical'?90:70,'/financial-control/obligations?record='+o.id,'Review funding');
 return rankNextFinancialMove(risks,risks.length);
}
export function rankNextFinancialMove(risks:FinancialRisk[],limit=12) {return [...new Map(risks.map(r=>[r.key,r])).values()].sort((a,b)=>b.score-a.score||(a.date??'9999').localeCompare(b.date??'9999')||a.key.localeCompare(b.key)).slice(0,limit);}
export function buildMonthlyFinanceReview(data:FinancialData,start:string,end:string) {
 const between=(date:unknown)=>!!day(date)&&day(date)!>=start&&day(date)!<=end;
 return {start,end,bridge:buildGrossToCashBridge((data.invoices??[]).filter(r=>between(r.issue_date)),(data.payments??[]).filter(r=>between(r.payment_date)),(data.expenses??[]).filter(r=>between(r.expense_date))),obligations:(data.obligations??[]).filter(r=>between(r.due_at)),investments:(data.investments??[]).filter(r=>between(r.target_date)),basis:'Recorded activity in this period. Current balances are not historical period-end balances.'};
}
export const buildQuarterlyFinanceReview=buildMonthlyFinanceReview;

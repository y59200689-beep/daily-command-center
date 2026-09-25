import { continuitySignals } from "./continuity";
import { daysUntil, isOpen, type Sources, type Coverage } from "./intelligence";
import type { Row } from "./repository";
type Metric = { companyId: string; status: string; reason: string; name: string };
export function currencyTotals(rows: Row[], field: string) {
 const totals: Record<string,number>={};
 for(const r of rows) if(r.currency && r[field]!=null && Number.isFinite(Number(r[field]))) totals[String(r.currency)]=(totals[String(r.currency)]??0)+Number(r[field]);
 return totals;
}
export function businessStates(data: Sources, metrics: Metric[], today: string, coverage: Coverage[] = []) {
 return (data.companies??[]).map(company=>{
  const rows=(key:string)=>data[key]??[];
  const projects=rows("projects").filter(r=>r.company_id===company.id);
  const projectIds=new Set(projects.map(r=>r.id));
  const relationships=rows("relationships").filter(r=>r.company_id===company.id);
  const clientIds=new Set([...projects.map(r=>r.client_id),...relationships.map(r=>r.client_id)].filter(Boolean));
  const financialIds=new Set(rows("financialLinks").filter(r=>r.target_type==="company"&&r.target_id===company.id).map(r=>r.origin_id));
  const owned=(key:string)=>rows(key).filter(r=>r.company_id===company.id||projectIds.has(String(r.project_id))||financialIds.has(r.id));
  const orders=owned("orders").filter(r=>!["canceled","cancelled","refunded","failed_payment"].includes(String(r.status)));
  const currentOrders=orders.filter(r=>String(r.created_at).slice(0,7)===today.slice(0,7));
  const issues=owned("issues").filter(isOpen), incidents=owned("incidents").filter(isOpen), systems=owned("systems").filter(r=>r.status!=="deprecated");
  const invoices=owned("invoices").filter(r=>Number(r.amount_remaining)>0 && !["draft","cancelled"].includes(String(r.status)));
  const overdue=invoices.filter(r=>(daysUntil(r.due_date,today)??1)<0);
  const commitments=owned("commitments").filter(r=>isOpen(r)&&(daysUntil(r.due_date,today)??1)<0);
  const decisions=owned("decisions").filter(r=>isOpen(r)&&["proposed","under_review"].includes(String(r.status)));
  const risks=owned("risks").filter(r=>!["closed","mitigated","accepted"].includes(String(r.status)));
  const renewals=systems.filter(r=>(daysUntil(r.renewal_date,today)??999)<=30);
  const unowned=systems.filter(r=>["high","critical"].includes(String(r.criticality))&&!r.owner_label);
  const endpointIds=new Set([company.id,...projects.map(r=>r.id),...systems.map(r=>r.id),...issues.map(r=>r.id),...risks.map(r=>r.id)]);
  const blockers=rows("dependencies").filter(r=>endpointIds.has(String(r.source_id))&&["blocked","unavailable"].includes(String(r.state)));
  const customerIssues=owned("support").filter(isOpen), customers=rows("clients").filter(r=>clientIds.has(r.id));
  const opportunities=rows("opportunities").filter(r=>clientIds.has(r.client_id));
  const stock=new Map<string,Row>();for(const r of [...owned("inventory")].sort((a,b)=>String(b.captured_at).localeCompare(String(a.captured_at))))if(!stock.has(String(r.product_id)))stock.set(String(r.product_id),r);
  const stockProblems=[...stock.values()].filter(r=>r.available_stock!=null&&r.reorder_level!=null&&Number(r.available_stock)<=Number(r.reorder_level));
  const continuity=continuitySignals({...data,systems},today);
  const companyMetrics=metrics.filter(m=>m.companyId===company.id);
  const critical=companyMetrics.some(m=>m.status==="critical")||incidents.some(r=>r.severity==="critical")||systems.some(r=>r.status==="unavailable"&&r.criticality==="critical");
  const reasons=[...systems.filter(r=>["degraded","unavailable"].includes(String(r.status))).map(r=>`${r.name}: recorded ${r.status} (${r.criticality} criticality)`),...companyMetrics.filter(m=>["critical","attention"].includes(m.status)).map(m=>`${m.name}: ${m.reason}`),...(overdue.length?[`${overdue.length} overdue receivables`]:[]),...(incidents.length?[`${incidents.length} production incidents`]:[]),...(issues.length?[`${issues.length} open operational issues`]:[]),...(commitments.length?[`${commitments.length} overdue commitments`]:[]),...(decisions.length?[`${decisions.length} pending decisions`]:[]),...(blockers.length?[`${blockers.length} blocked dependencies`]:[]),...(unowned.length?[`${unowned.length} critical systems without an owner`]:[]),...(renewals.length?[`${renewals.length} infrastructure renewals within 30 days or expired`]:[]),...(stockProblems.length?[`${stockProblems.length} products at/below recorded reorder level`]:[])];
  const cash=owned("accounts").filter(r=>r.status==="active").map(a=>{const latest=rows("cashSnapshots").filter(r=>r.cash_account_id===a.id).sort((x,y)=>String(y.as_of).localeCompare(String(x.as_of)))[0];return {...a,balance:latest?.balance??null,as_of:latest?.as_of??null};});
  const concentration: string[]=[];for(const currency of new Set(currentOrders.map(o=>String(o.currency)))) {const amounts=new Map<string,number>();let total=0;for(const o of currentOrders.filter(o=>o.currency===currency)){total+=Number(o.total_amount);if(o.customer_reference)amounts.set(String(o.customer_reference),(amounts.get(String(o.customer_reference))??0)+Number(o.total_amount));}const largest=Math.max(0,...amounts.values());if(total>0&&largest/total>=.5)concentration.push(`Largest identified customer represents ${(largest/total*100).toFixed(1)}% of recorded ${currency} order value this month.`);}
  reasons.push(...concentration,...continuity.map(signal=>`${signal.title}: ${signal.reasons.join(" ")}`));
  const incomplete=coverage.some(c=>c.status!=="available");
  return {id:company.id,name:String(company.name),active:company.active,lifecycle:String(company.lifecycle_status??"operating"),status:critical?"CRITICAL":reasons.length?"ATTENTION":incomplete?"INCOMPLETE":"STABLE",reasons:reasons.length?reasons:[incomplete?"Some sources are unavailable or truncated; health cannot be established.":"No configured material exception in the recorded sources."],sections:{
   Financial:{orderValue:currencyTotals(currentOrders,"total_amount"),receivables:currencyTotals(invoices,"amount_remaining"),obligations:currencyTotals(owned("obligations").filter(r=>["planned","committed","due"].includes(String(r.status))),"amount"),cash,concentration},
   Customers:{active:customers.filter(r=>r.status==="active").length,new:customers.filter(r=>String(r.created_at).slice(0,7)===today.slice(0,7)).length,inactive:customers.filter(r=>r.status!=="active").length,issues:customerIssues.length,linked:customers.map(r=>({id:r.id,name:String(r.name),route:`/clients/${r.id}`})),limitation:"Only explicitly linked client identities are counted. Inactive does not imply churn; renewals require a recorded contract."},
   Operations:{issues:issues.length,overdueCommitments:commitments.length,blockedDependencies:blockers.length,stockProblems:stockProblems.length,risks:risks.length},
   Growth:{openPipeline:opportunities.filter(r=>!["won","lost"].includes(String(r.stage))).length,recordedPipeline:currencyTotals(opportunities.filter(r=>!["won","lost"].includes(String(r.stage))),"estimated_value"),limitation:"Pipeline uses linked clients; acquisition metrics come from configured KPIs."},
   Technology:{systems:systems.length,incidents:incidents.length,renewals:renewals.length,unownedCritical:unowned.length,limitation:"Recorded metadata only; no live provider health is inferred."},
   "Founder Attention":{decisions:decisions.length,founderRequired:decisions.filter(r=>r.founder_required).length,unownedCritical:unowned.length,blockedDependencies:blockers.length},
  },links:[...projects.map(r=>({id:r.id,title:String(r.name),route:`/projects/${r.id}`})),...systems.map(r=>({id:r.id,title:String(r.name),route:`/infrastructure?record=${r.id}`})),...risks.map(r=>({id:r.id,title:String(r.title),route:`/risks/register?record=${r.id}`}))]};
 });
}

import { businessStates } from "./business";
import type { Sources, Coverage } from "./intelligence";
import type { SupabaseClient } from "@supabase/supabase-js";
import { kpiEvaluation, numberOrNull } from "./intelligence";
import type { Row } from "./repository";
export function metricPeriods(frequency: string, today: string) {
  const end = new Date(`${today}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 1);
  const current = new Date(`${today}T00:00:00Z`);
  if (frequency === "monthly") current.setUTCDate(1);
  else if (frequency === "weekly") current.setUTCDate(current.getUTCDate() - ((current.getUTCDay() + 6) % 7));
  const previous = new Date(current);
  if (frequency === "monthly") previous.setUTCMonth(previous.getUTCMonth() - 1);
  else previous.setUTCDate(previous.getUTCDate() - (frequency === "weekly" ? 7 : 1));
  return { start: current.toISOString(), previous: previous.toISOString(), end: end.toISOString() };
}
export async function loadKpiValues(client: SupabaseClient, userId: string, today: string) {
  void userId; // The invoker RPC scopes every source to auth.uid().
  const result = await client.rpc("tier2_kpi_values", { as_of: today }).limit(501);
  if(result.error) throw result.error;
  if((result.data?.length??0)>500) throw new Error("KPI view exceeds its 500-definition limit.");
  return (result.data??[]) as Row[];
}
export async function loadBusinessPulse(client: SupabaseClient, userId: string, today: string) {
  const tables = { companies: "companies", projects: "projects", relationships: "operating_relationships", clients: "clients", orders: "commerce_orders", issues: "quality_incidents", incidents: "incidents", systems: "operational_systems", access: "system_access_records", healthChecks: "system_health_checks", commitments: "operating_commitments", decisions: "decisions", risks: "operating_risks", dependencies: "operational_dependencies", invoices: "invoices", obligations: "financial_obligations", accounts: "financial_cash_accounts", cashSnapshots: "financial_cash_snapshots", financialLinks: "financial_context_links", opportunities: "opportunities", inventory: "inventory_snapshots", support: "support_cases" };
  const data: Sources = {}, coverage: Coverage[] = [];
  const [values] = await Promise.all([loadKpiValues(client,userId,today), Promise.all(Object.entries(tables).map(async ([key,table])=>{
    let query=client.from(table).select("*").eq("user_id",userId);
    if(["projects","clients","decisions","invoices"].includes(table)) query=query.is("deleted_at",null);
    if(table==="opportunities") query=query.is("archived_at",null);
    const result=await query.order(key==="inventory"?"captured_at":"created_at",{ascending:false}).limit(1001);
    data[key]=(result.data??[]).slice(0,1000) as Row[];
    coverage.push({source:key,status:result.error?"unavailable":(result.data?.length??0)>1000?"limited":"available",count:data[key].length});
  }))]);
  const metrics=values.map(definition=>({id:definition.id,direction:definition.direction,target_max:definition.target_max,warning_threshold:definition.warning_threshold,critical_threshold:definition.critical_threshold,companyId:String(definition.company_id??""),name:String(definition.name),unit:String(definition.unit),source:String(definition.source),frequency:String(definition.frequency),owner:String(definition.owner_label??"Unassigned"),aggregation:String(definition.aggregation??"latest"),sourceReference:String(definition.source_reference??""),sourceType:definition.source==="manual"?"manual":"automatic",observedOn:definition.observed_on?String(definition.observed_on):null,history:(Array.isArray(definition.history)?definition.history:[]) as {date:string;value:number|null}[],limitation:definition.source==="manual"?"Configured aggregation of dated observations; missing periods are unknown.":"Current period to date versus previous full period (UTC). Recorded orders exclude cancelled/refunded/failed-payment records; revenue stays in the selected currency and is not collected cash.",...kpiEvaluation(definition,numberOrNull(definition.current_value),numberOrNull(definition.previous_value))}));
  return {today,companies:data.companies,metrics,businesses:businessStates(data,metrics,today,coverage),coverage};
}
export type BusinessPulse = Awaited<ReturnType<typeof loadBusinessPulse>>;

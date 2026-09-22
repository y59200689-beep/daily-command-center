import type { SupabaseClient } from "@supabase/supabase-js";
import { domainConfig, type DomainRecord, type PersistedDomain } from "@/lib/domains";

type UntypedClient = SupabaseClient<Record<string, unknown>>;
type StrategyDomain = "strategic_commitments" | "strategic_milestones" | "planning_periods" | "strategic_scenarios" | "decision_gates";
const strategyTables: Record<StrategyDomain, string> = { strategic_commitments: "strategic_commitments", strategic_milestones: "strategic_milestones", planning_periods: "planning_periods", strategic_scenarios: "strategic_scenarios", decision_gates: "decision_gates" };

type ListOptions = { status?: string; priority?: string; sort?: string };

export async function listRecords(client: UntypedClient, userId: string, domain: PersistedDomain, search?: string, page=1, pageSize=50, options?: ListOptions) {
  const config = domainConfig[domain];
  const safePage=Math.max(1,Math.floor(page));const safePageSize=Math.min(100,Math.max(10,Math.floor(pageSize)));const start=(safePage-1)*safePageSize;
  const taskSorts: Record<string, { field: string; ascending: boolean }> = { updated: { field: "updated_at", ascending: false }, due: { field: "due_date", ascending: true }, title: { field: "title", ascending: true }, priority: { field: "priority", ascending: false } };
  const selectedSort = domain === "tasks" && options?.sort && taskSorts[options.sort] ? taskSorts[options.sort] : { field: config.sort, ascending: config.sortAscending ?? false };
  let query = client.from(config.table).select("*",{count:"exact"}).eq("user_id", userId).is("deleted_at", null);
  if (search?.trim()) query = query.ilike(config.titleField, `%${search.trim().replaceAll("%", "\\%")}%`);
  if (domain === "tasks") {
    const statuses = ["inbox", "planned", "in_progress", "waiting", "blocked", "completed", "cancelled"];
    const priorities = ["none", "low", "medium", "high", "urgent"];
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    if (options?.status === "open") {
      query = query.neq("status", "cancelled").or(`status.neq.completed,completed_at.gte.${cutoff}`);
    } else if (options?.status === "still_waiting") {
      const today = new Date().toISOString().slice(0, 10);
      query = query.not("status", "in", "(completed,cancelled)").lt("due_date", today);
    } else if (options?.status && statuses.includes(options.status)) {
      query = query.eq("status", options.status);
      if (options.status === "completed") {
        query = query.gte("completed_at", cutoff);
      }
    } else {
      query = query.or(`status.neq.completed,completed_at.gte.${cutoff}`);
    }
    if (options?.priority && priorities.includes(options.priority)) query = query.eq("priority", options.priority);
  }
  query = query.order(selectedSort.field, { ascending: selectedSort.ascending, nullsFirst: false }).range(start,start+safePageSize-1);
  const { data, error, count } = await query;
  if (error) throw error;
  return {records:(data ?? []) as DomainRecord[],total:count??0,page:safePage,pageSize:safePageSize};
}

export async function getRecord(client: UntypedClient, userId: string, domain: PersistedDomain, id: string) {
  const { data, error } = await client.from(domainConfig[domain].table).select("*").eq("id", id).eq("user_id", userId).is("deleted_at", null).maybeSingle();
  if (error) throw error;
  return data as DomainRecord | null;
}

export async function createRecord(client: UntypedClient, userId: string, domain: PersistedDomain | StrategyDomain, input: Record<string, unknown>) {
  if (domain in strategyTables) {
    const { data, error } = await client.from(strategyTables[domain as StrategyDomain]).insert({ ...input, user_id: userId } as never).select("*").single();
    if (error) throw error;
    return data as DomainRecord;
  }
  const persistedDomain = domain as PersistedDomain;
  await validateRelationships(client, userId, input);
  const prepared = prepareRecord(persistedDomain, input);
  const { data, error } = await client.from(domainConfig[persistedDomain].table).insert({ ...prepared, user_id: userId } as never).select("*").single();
  if (error) throw error;
  return data as DomainRecord;
}

export async function updateRecord(client: UntypedClient, userId: string, domain: PersistedDomain, id: string, input: Record<string, unknown>) {
  await validateRelationships(client, userId, input);
  let source=input;
  if(domain==="invoices"){
    const current=await getRecord(client,userId,domain,id);if(!current)return null;
    source={subtotal:current.subtotal,tax_amount:current.tax_amount,discount_amount:current.discount_amount,amount_paid:current.amount_paid,status:current.status,issue_date:current.issue_date,...input};
  }
  const prepared = prepareRecord(domain, source);
  const { data, error } = await client.from(domainConfig[domain].table).update(prepared as never).eq("id", id).eq("user_id", userId).is("deleted_at", null).select("*").maybeSingle();
  if (error) throw error;
  return data as DomainRecord | null;
}

async function validateRelationships(client: UntypedClient, userId: string, input: Record<string, unknown>) {
  const relationships = [["project_id", "projects"], ["client_id", "clients"], ["goal_id", "goals"], ["task_id", "tasks"], ["invoice_id", "invoices"], ["campaign_id", "campaigns"], ["prompt_id", "prompts"], ["content_item_id", "content_items"], ["subscription_id", "subscriptions"], ["superseded_by_decision_id", "decisions"]] as const;
  for (const [field, table] of relationships) {
    const value = input[field];
    if (!value) continue;
    const { data, error } = await client.from(table).select("id").eq("id", String(value)).eq("user_id", userId).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error(`The selected ${field.replace("_id", "")} is not available in your workspace.`);
  }
}

function prepareRecord(domain: PersistedDomain,input:Record<string,unknown>){
  const prepared={...input};
  if(domain==="invoices"){
    const subtotal=Number(prepared.subtotal??0);const tax=Number(prepared.tax_amount??0);const discount=Number(prepared.discount_amount??0);const total=subtotal+tax-discount;if(total<0)throw new Error("Discount cannot exceed subtotal and tax.");const paid=Number(prepared.amount_paid??0);if(paid>total)throw new Error("Invoice total cannot be lower than payments already recorded.");
    prepared.total_amount=total;prepared.amount=total;prepared.amount_paid=paid;prepared.amount_remaining=total-paid;prepared.invoice_date=prepared.issue_date??null;prepared.status=prepared.status==="cancelled"?"cancelled":paid===total&&total>0?"paid":paid>0?"partial":prepared.status==="draft"?"draft":"sent";prepared.paid_at=prepared.status==="paid"?prepared.paid_at??new Date().toISOString():null;
  }
  if(domain==="prompts"&&prepared.prompt_text!==undefined)prepared.prompt=prepared.prompt_text;
  if(domain==="content"&&prepared.creative_brief!==undefined)prepared.brief=prepared.creative_brief;
  if(domain==="content"&&prepared.approval_status!==undefined)prepared.approved_at=prepared.approval_status==="approved"?prepared.approved_at??new Date().toISOString():null;
  if(domain==="fitness"){
    if(Object.hasOwn(prepared,"date"))prepared.activity_date=prepared.date;
    if(Object.hasOwn(prepared,"duration_minutes"))prepared.duration_seconds=prepared.duration_minutes == null?null:Number(prepared.duration_minutes)*60;
    if(Object.hasOwn(prepared,"distance_km"))prepared.distance_meters=prepared.distance_km == null?null:Number(prepared.distance_km)*1000;
    if(Object.hasOwn(prepared,"external_id"))prepared.external_activity_id=prepared.external_id??null;
  }
  if(domain==="tasks"){
    if(prepared.recurrence_frequency==null)delete prepared.recurrence_frequency;
    if(prepared.target_count==null)delete prepared.target_count;
    if(prepared.daily_target==null)delete prepared.daily_target;
    if(prepared.current_count==null)delete prepared.current_count;
  }
  return prepared;
}

export async function archiveRecord(client: UntypedClient, userId: string, domain: PersistedDomain, id: string) {
  const { data, error } = await client.from(domainConfig[domain].table).update({ deleted_at: new Date().toISOString() } as never).eq("id", id).eq("user_id", userId).is("deleted_at", null).select("id").maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function deleteRecord(client: UntypedClient, userId: string, domain: PersistedDomain, id: string) {
  const { data, error } = await client.from(domainConfig[domain].table).delete().eq("id", id).eq("user_id", userId).select("id").maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

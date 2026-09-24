import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { resources, resourceDefinition, resourceSchema, endpointTables, type ResourceKey, type Field, type Resource } from "./resources";

export type Row = Record<string, unknown> & { id: string };
export const pageSchema = z.coerce.number().int().min(1).max(10000).default(1);
export async function listOperatingRecords(client: SupabaseClient, userId: string, key: ResourceKey, page = 1, search = "", filters: Record<string, string> = {}) {
  const config: Resource = resources[key];
  let query = client.from(config.table).select(key === "decisions" ? "*,companies(name),projects(name)" : "*", { count: "exact" }).eq("user_id", userId);
  for (const field of resourceDefinition(key).filterFields) if (filters[field]) query = query.eq(field, filters[field]);
  if (key === "commitments" && filters.relationship_id) query = query.eq("relationship_id", z.uuid().parse(filters.relationship_id));
  if (config.archive) query = query.is(config.archive, null);
  if (key === "decisions" && filters.review) {
    const today = new Date().toISOString().slice(0, 10);
    if (filters.review === "needs_decision") query = query.in("status", ["proposed", "under_review"]);
    else if (filters.review === "review_due") query = query.lte("review_date", today).not("status", "in", "(archived,reversed,superseded,validated)");
    else if (filters.review === "decided") query = query.in("status", ["active", "decided", "implemented"]);
    else if (["validated", "reversed", "archived"].includes(filters.review)) query = query.eq("status", filters.review);
  }
  if (search && config.label !== "observed_on") query = query.ilike(config.label, `%${search.replace(/[\\%_]/g, "\\$&")}%`);
  const { data, error, count } = await query.order("updated_at", { ascending: false }).order("id").range((page - 1) * 30, page * 30 - 1);
  if (error) throw error;
  return { records: (data ?? []) as unknown as Row[], total: count ?? 0, page, pageSize: 30 };
}
function invalid(message: string): never { throw new z.ZodError([{ code: "custom", path: [], message }]); }
export async function saveOperatingRecord(client: SupabaseClient, userId: string, key: ResourceKey, input: unknown, id?: string) {
  const config = resources[key];
  const parsed = resourceSchema(key, Boolean(id)).parse(input);
  let current: Row | null = null;
  if (id) {
    z.uuid().parse(id);
    const { data, error } = await client.from(config.table).select("*").eq("user_id", userId).eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    current = data as Row;
  }
  const merged = { ...current, ...parsed };
  for (const field of config.fields as Field[]) {
    if (field.kind !== "relation" || !merged[field.key]) continue;
    const { data, error } = await client.from(field.table!).select("id").eq("user_id", userId).eq("id", merged[field.key]).maybeSingle();
    if (error) throw error;
    if (!data) invalid(`The selected ${field.label.toLowerCase()} is unavailable in your workspace.`);
  }
  if (key === "dependencies") {
    if (merged.source_type === merged.dependency_type && merged.source_id === merged.dependency_id) invalid("A record cannot depend on itself.");
    let duplicateQuery = client.from(config.table).select("id").eq("user_id", userId).eq("source_type", merged.source_type).eq("source_id", merged.source_id).eq("dependency_type", merged.dependency_type).eq("dependency_id", merged.dependency_id);
    if (id) duplicateQuery = duplicateQuery.neq("id", id);
    const duplicate = await duplicateQuery.limit(1);
    if (duplicate.error) throw duplicate.error;
    if (duplicate.data?.length) invalid("This dependency already exists.");
    for (const side of ["source", "dependency"]) {
      const table = endpointTables[merged[`${side}_type`] as keyof typeof endpointTables];
      const { data, error } = await client.from(table).select("id").eq("user_id", userId).eq("id", merged[`${side}_id`]).maybeSingle();
      if (error) throw error;
      if (!data) invalid("Dependency endpoints must exist in your workspace.");
    }
  }
  if (key === "kpi-observations") {
    const { data, error } = await client.from("kpi_definitions").select("source").eq("user_id", userId).eq("id", merged.kpi_id).maybeSingle();
    if (error) throw error;
    if (data?.source !== "manual") invalid("Transactional KPIs are calculated; they cannot have manual observations.");
  }
  if (key === "system-health" && String(merged.checked_on) > new Date().toISOString().slice(0,10)) invalid("Health evidence cannot be dated in the future.");
  if (key === "kpis") {
    if (merged.direction === "target_range" && (merged.target == null || merged.target_max == null || Number(merged.target) > Number(merged.target_max))) invalid("A target range needs an ordered minimum and maximum.");
    if (merged.direction === "target_range" && (Number(merged.warning_threshold ?? 0) < 0 || Number(merged.critical_threshold ?? merged.warning_threshold ?? 0) < Number(merged.warning_threshold ?? 0))) invalid("Range thresholds are nonnegative distance outside the range; critical must be at least warning.");
    if (merged.source === "commerce_revenue" && !/^[A-Z]{3}$/.test(String(merged.unit))) invalid("Revenue metrics require a three-letter currency unit.");
  }
  if (key === "kpis" && merged.source !== "manual" && !merged.company_id) invalid("A transactional KPI needs a business.");
  if (key === "mobility" || key === "experiments" || key === "training-plans") {
    if (merged.start_date && merged.end_date && String(merged.end_date) < String(merged.start_date)) invalid("End date must be on or after the start date.");
  }
  if (key === "documents" && merged.issued_at && merged.expires_at && String(merged.expires_at) < String(merged.issued_at)) invalid("Expiry must be on or after the issue date.");
  if (key === "assets" && id && merged.parent_asset_id === id) invalid("An asset cannot be its own parent.");
  if (parsed.source_inbox_id) {
    const { data, error } = await client.from("inbox_items").select("id").eq("user_id", userId).eq("id", parsed.source_inbox_id).is("deleted_at", null).maybeSingle();
    if (error) throw error;
    if (!data) invalid("Capture not available in your workspace.");
  }
  // An empty form date must preserve the existing/default decision date, not write NULL.
  if (key === "decisions" && parsed.decision_date == null) delete parsed.decision_date;
  const values = { ...parsed, user_id: userId };
  const result = id ? await client.from(config.table).update(values).eq("user_id", userId).eq("id", id).select("*").maybeSingle()
    : await client.from(config.table).insert(values).select("*").single();
  if (result.error) throw result.error;
  return result.data as Row | null;
}
export async function operatingOptions(client: SupabaseClient, userId: string, key: ResourceKey, endpoints: { source?: string; dependency?: string; q?: string } = {}) {
  if (key === "dependencies") {
    return Object.fromEntries(await Promise.all(["source", "dependency"].map(async side => {
      const type = endpoints[side as keyof typeof endpoints] ?? "task";
      if (!Object.hasOwn(endpointTables, type)) invalid("Unknown dependency endpoint type.");
      const table = endpointTables[type as keyof typeof endpointTables];
      const label = table === "integrations" ? "provider" : ["projects", "companies", "team_people", "operational_systems", "supplier_records", "clients", "product_catalog_refs", "process_templates"].includes(table) ? "name" : "title";
      let query = client.from(table).select(`id,${label}`).eq("user_id", userId).order(label).limit(200);
      if (endpoints.q) query = query.ilike(label, `%${endpoints.q.replace(/[\\%_]/g, "\\$&")}%`);
      if (["tasks", "projects", "clients", "decisions", "calendar_events"].includes(table)) query = query.is("deleted_at", null);
      const { data, error } = await query;
      if (error) throw error;
      return [`${side}_id`, (data ?? []).map(row => { const record = row as unknown as Row; return { id: record.id, label: String(record[label] ?? record.id) }; })];
    })));
  }
  const fields = (resources[key].fields as Field[]).filter(f => f.kind === "relation");
  return Object.fromEntries(await Promise.all(fields.map(async field => {
    let query = client.from(field.table!).select(`id,${field.title}`).eq("user_id", userId).order(field.title!).limit(200);
    if (["tasks", "projects", "clients", "decisions", "subscriptions", "waiting_items"].includes(field.table!)) query = query.is("deleted_at", null);
    const { data, error } = await query;
    if (error) throw error;
    return [field.key, (data ?? []).map(row => { const r = row as unknown as Row; return { id: r.id, label: String(r[field.title!] ?? r.id) }; })];
  })));
}

export async function removeOperatingRecord(client: SupabaseClient, userId: string, key: ResourceKey, id: string) {
  z.uuid().parse(id);
  const config = resourceDefinition(key);
  if (!config.removeMode) invalid("This resource retains its history and cannot be removed.");
  const query = config.removeMode === "delete" ? client.from(config.table).delete() : client.from(config.table).update(config.archiveValues!);
  const { data, error } = await query.eq("user_id", userId).eq("id", id).select("id").maybeSingle();
  if (error) throw error;
  return data;
}

import type { SupabaseClient } from "@supabase/supabase-js";

export const notificationCategories = ["tasks","calendar","clients","finance","content","decisions","fitness","integrations","automations"] as const;
export type NotificationCategory = typeof notificationCategories[number];
export type NotificationSeverity = "info" | "attention" | "important" | "critical";
const level: Record<NotificationSeverity, number> = { info: 0, attention: 1, important: 2, critical: 3 };

export function notificationRoute(type: string, entityType?: string | null, entityId?: string | null) {
  if(entityType?.startsWith('financial_')){const views:Record<string,string>={financial_accounts:'accounts',financial_cashflow:'cashflow',financial_collections:'collections',financial_promises:'promises',financial_obligations:'obligations',financial_budgets:'budgets',financial_investments:'investments',financial_subscriptions:'subscriptions'};return views[entityType]?'/financial-control/'+views[entityType]:'/financial-control';}
  if (["commitment", "milestone", "decision_gate"].includes(entityType ?? "")) return "/control-tower";
  if (entityType === "strategy_week_plan") return "/plan/week";
  if (entityType === "strategy_month_plan") return "/plan/month";
  if (entityType === "strategy_quarter_plan") return "/plan/quarter";
  if (entityType === "planning_period") return "/plan/week";
  if (["action_plan", "action_proposal", "action_approval", "action_execution", "action_escalation", "action_template"].includes(entityType ?? "")) {
    if (entityType === "action_plan" && entityId) return `/chief-of-staff/plans/${entityId}`;
    if (entityType === "action_approval" || entityType === "action_proposal") return `/chief-of-staff/approvals`;
    if (entityType === "action_execution") return `/chief-of-staff/executions`;
    if (entityType === "action_escalation") return `/chief-of-staff/escalations`;
    return `/chief-of-staff`;
  }
  if (type === "integrations") return "/settings/integrations";
  if (type === "automations") return "/automations";
  if (entityType === "invoice") return entityId ? `/finance/invoices/${entityId}` : "/finance";
  if (entityType === "calendar_event") return "/calendar";
  if (entityType === "research_topic") return entityId ? `/knowledge/topics/${entityId}` : "/knowledge";
  if (entityType === "knowledge_source") return entityId ? `/knowledge/sources/${entityId}` : "/knowledge";
  if (entityType === "research_finding") return entityId ? `/knowledge/findings/${entityId}` : "/knowledge";
  if (entityType === "watch_entity") return "/knowledge/watch";
  const routes: Record<string, string> = { task: "/tasks", client: "/clients", content: "/content", decision: "/decisions", subscription: "/finance", followup: "/followups", executive_cluster: "/executive", executive_change: "/executive" };
  return routes[entityType ?? ""] ?? "/today";
}
export function preferenceAllows(enabled: boolean | null | undefined, minimum: string | null | undefined, severity: NotificationSeverity) {
  if (enabled === false) return false; return level[severity] >= level[(minimum === "low" ? "info" : minimum === "medium" ? "attention" : minimum === "high" ? "important" : "critical") as NotificationSeverity];
}
export async function notifyOnce(client: SupabaseClient, userId: string, input: { type: NotificationCategory; title: string; body?: string; entityType?: string; entityId?: string; severity?: NotificationSeverity; dedupeKey?: string; metadata?: Record<string, unknown>; cooldownHours?: number }) {
  const severity = input.severity ?? "attention"; const { data: preference, error: preferenceError } = await client.from("notification_preferences").select("enabled,minimum_severity").eq("user_id", userId).eq("category", input.type).maybeSingle(); if (preferenceError) throw preferenceError;
  if (!preferenceAllows(preference?.enabled, preference?.minimum_severity, severity)) return false;
  const key = input.dedupeKey ?? [input.type, input.entityType ?? "", input.entityId ?? "", input.title].join(":"); const since = new Date(Date.now() - (input.cooldownHours ?? 24) * 3_600_000).toISOString();
  const { data, error } = await client.from("notifications").select("id").eq("user_id", userId).eq("dedupe_key", key).is("dismissed_at", null).is("resolved_at", null).gte("created_at", since).limit(1); if (error) throw error; if (data?.length) return false;
  const saved = await client.from("notifications").insert({ user_id: userId, type: input.type, title: input.title, body: input.body ?? null, entity_type: input.entityType ?? null, entity_id: input.entityId ?? null, severity, dedupe_key: key, metadata: input.metadata ?? {} } as never); if (saved.error) throw saved.error; return true;
}
export async function resolveNotifications(client: SupabaseClient, userId: string, dedupePrefix: string) {
  const result = await client.from("notifications").update({ resolved_at: new Date().toISOString() } as never).eq("user_id", userId).like("dedupe_key", `${dedupePrefix}%`).is("resolved_at", null).is("dismissed_at", null); if (result.error) throw result.error;
}

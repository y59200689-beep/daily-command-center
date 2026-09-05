import type { SupabaseClient } from "@supabase/supabase-js";
import type { InsightFeedback, IntelligenceOverview, WorkspaceRow, WorkspaceSnapshot } from "@/lib/intelligence/types";

type Client = SupabaseClient<Record<string, unknown>>;

function dateInTimezone(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function rows(result: { data: unknown; error: unknown }, name: string) {
  if (result.error) throw new Error(`INTELLIGENCE_QUERY_FAILED:${name}`, { cause: result.error });
  return (result.data ?? []) as WorkspaceRow[];
}

export async function loadIntelligenceWorkspace(client: Client, userId: string, now = new Date()): Promise<WorkspaceSnapshot> {
  const profileResult = await client.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (profileResult.error) throw profileResult.error;
  const profile = profileResult.data as WorkspaceRow | null;
  const timezone = typeof profile?.timezone === "string" ? profile.timezone : "Africa/Casablanca";
  const today = dateInTimezone(now, timezone);
  const historyStart = new Date(now.getTime() - 180 * 86_400_000).toISOString();
  const calendarEnd = new Date(now.getTime() + 14 * 86_400_000).toISOString();
  const dateHistoryStart = historyStart.slice(0, 10);
  const [tasks, projects, clients, followups, waiting, notes, milestones, calendar, focusSessions, invoices, payments, expenses, subscriptions, content, campaigns, decisions, goals, fitnessActivities, fitnessTargets, activity, feedback, notificationPreferences] = await Promise.all([
    client.from("tasks").select("*").eq("user_id", userId).is("deleted_at", null).order("updated_at", { ascending: false }).limit(500),
    client.from("projects").select("*").eq("user_id", userId).is("deleted_at", null).order("updated_at", { ascending: false }).limit(200),
    client.from("clients").select("*").eq("user_id", userId).is("deleted_at", null).order("updated_at", { ascending: false }).limit(200),
    client.from("followups").select("*").eq("user_id", userId).is("deleted_at", null).order("due_at").limit(300),
    client.from("waiting_items").select("*").eq("user_id", userId).is("deleted_at", null).order("requested_at").limit(300),
    client.from("notes").select("*").eq("user_id", userId).is("deleted_at", null).order("updated_at", { ascending: false }).limit(300),
    client.from("milestones").select("*").eq("user_id", userId).order("target_date").limit(300),
    client.from("calendar_events").select("*").eq("user_id", userId).is("deleted_at", null).gte("ends_at", `${today}T00:00:00Z`).lte("starts_at", calendarEnd).order("starts_at").limit(300),
    client.from("focus_sessions").select("*").eq("user_id", userId).gte("started_at", historyStart).order("started_at", { ascending: false }).limit(1000),
    client.from("invoices").select("*").eq("user_id", userId).is("deleted_at", null).order("due_date").limit(500),
    client.from("payments").select("*").eq("user_id", userId).is("deleted_at", null).gte("payment_date", dateHistoryStart).order("payment_date", { ascending: false }).limit(1000),
    client.from("expenses").select("*").eq("user_id", userId).is("deleted_at", null).gte("expense_date", dateHistoryStart).order("expense_date", { ascending: false }).limit(1000),
    client.from("subscriptions").select("*").eq("user_id", userId).is("deleted_at", null).order("next_billing_date").limit(300),
    client.from("content_items").select("*").eq("user_id", userId).is("deleted_at", null).order("updated_at", { ascending: false }).limit(500),
    client.from("campaigns").select("*").eq("user_id", userId).is("deleted_at", null).order("end_date").limit(200),
    client.from("decisions").select("*").eq("user_id", userId).is("deleted_at", null).order("updated_at", { ascending: false }).limit(300),
    client.from("goals").select("*").eq("user_id", userId).is("deleted_at", null).order("updated_at", { ascending: false }).limit(200),
    client.from("fitness_activities").select("*").eq("user_id", userId).is("deleted_at", null).gte("date", dateHistoryStart).order("date", { ascending: false }).limit(1000),
    client.from("fitness_targets").select("*").eq("user_id", userId).is("deleted_at", null).eq("active", true).limit(100),
    client.from("activity_log").select("*").eq("user_id", userId).gte("created_at", historyStart).order("created_at", { ascending: false }).limit(1500),
    client.from("insight_feedback").select("insight_key,insight_type,action,snoozed_until,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(500),
    client.from("notification_preferences").select("*").eq("user_id", userId).limit(50),
  ]);
  return {
    now: now.toISOString(), today, timezone, profile,
    tasks: rows(tasks, "tasks"), projects: rows(projects, "projects"), clients: rows(clients, "clients"), followups: rows(followups, "followups"), waiting: rows(waiting, "waiting"), notes: rows(notes, "notes"), milestones: rows(milestones, "milestones"), calendar: rows(calendar, "calendar"), focusSessions: rows(focusSessions, "focus_sessions"), invoices: rows(invoices, "invoices"), payments: rows(payments, "payments"), expenses: rows(expenses, "expenses"), subscriptions: rows(subscriptions, "subscriptions"), content: rows(content, "content"), campaigns: rows(campaigns, "campaigns"), decisions: rows(decisions, "decisions"), goals: rows(goals, "goals"), fitnessActivities: rows(fitnessActivities, "fitness_activities"), fitnessTargets: rows(fitnessTargets, "fitness_targets"), activity: rows(activity, "activity_log"), feedback: rows(feedback, "insight_feedback") as unknown as InsightFeedback[], notificationPreferences: rows(notificationPreferences, "notification_preferences"),
  };
}

export async function persistIntelligenceSnapshot(client: Client, userId: string, overview: IntelligenceOverview, snapshotDate: string) {
  const recommendations = overview.recommendations.slice(0, 50).map((item) => ({ user_id: userId, recommendation_key: item.key, action_type: item.actionType, entity_type: item.entityType, entity_id: item.entityId, label: item.label, reason: item.reason, priority: item.priority, evidence: item.evidence, recommended_at: item.recommendedAt, expires_at: item.expiresAt, resolved_at: null }));
  const risks = overview.risks.slice(0, 50).map((item) => ({ user_id: userId, snapshot_date: snapshotDate, risk_key: item.key, entity_type: item.entityType, entity_id: item.entityId, severity: item.severity, title: item.title, reason: item.reason, evidence: item.evidence, recommended_action: item.recommendedAction }));
  const patterns = overview.patterns.map((item) => ({ user_id: userId, snapshot_date: snapshotDate, pattern_key: item.key, title: item.title, statement: item.statement, evidence: item.evidence, sample_size: item.sampleSize, confidence: item.confidence }));
  const operations = [];
  if (recommendations.length) operations.push(client.from("daily_recommendations").upsert(recommendations as never, { onConflict: "user_id,recommendation_key" }));
  if (risks.length) operations.push(client.from("risk_snapshots").upsert(risks as never, { onConflict: "user_id,snapshot_date,risk_key" }));
  if (patterns.length) operations.push(client.from("pattern_snapshots").upsert(patterns as never, { onConflict: "user_id,snapshot_date,pattern_key" }));
  const results = await Promise.all(operations);
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
}

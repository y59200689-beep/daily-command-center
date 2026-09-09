import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyOnce, resolveNotifications } from "@/lib/v4-notifications";
import { loadExecutiveContext } from "./executive-server";

export const executiveAutomationTypes = [
  "daily_executive_brief",
  "weekly_executive_brief",
  "monthly_executive_review",
  "quarterly_executive_review",
  "decision_queue_review",
  "executive_risk_review",
  "assumption_review",
] as const;

export async function emitExecutiveNotifications(
  client: SupabaseClient,
  userId: string
): Promise<{ affected: number }> {
  let affected = 0;

  // Load executive context safely
  let ctx;
  try {
    ctx = await loadExecutiveContext(client, userId, "business");
  } catch {
    // If migration is unapplied or tables are missing, do not crash workspace notifications
    return { affected: 0 };
  }

  // 1. Critical Risk Clusters
  for (const cluster of ctx.riskClusters) {
    if (cluster.severity === "critical") {
      const dedupeKey = `executive:risk-cluster:${cluster.id}`;
      const sent = await notifyOnce(client, userId, {
        type: "decisions",
        title: `Critical Cross-Domain Risk: ${cluster.name}`,
        body: `${cluster.summary}. ${cluster.recommendedAction}.`,
        severity: "critical",
        entityType: "executive_cluster",
        entityId: cluster.entityId ?? cluster.id,
        dedupeKey,
        cooldownHours: 48,
      });
      if (sent) affected++;
    }
  }

  // 2. Critical Overdue Decisions
  for (const dec of ctx.decisions) {
    if (dec.urgency === "overdue" && dec.impact === "Critical") {
      const dedupeKey = `executive:decision-overdue:${dec.decisionId}`;
      const sent = await notifyOnce(client, userId, {
        type: "decisions",
        title: `Critical Decision Overdue: ${dec.title}`,
        body: `Cost of delay is ${dec.costOfDelay}. Executive alignment required.`,
        severity: "critical",
        entityType: "decision",
        entityId: dec.decisionId,
        dedupeKey,
        cooldownHours: 48,
      });
      if (sent) affected++;
    }
  }

  // 3. Material Deterioration
  for (const chg of ctx.changes) {
    if (chg.type === "worsened" && chg.materiality === "critical") {
      const dedupeKey = `executive:material-change:${chg.domain}:${chg.id}:${chg.currentState}`;
      const sent = await notifyOnce(client, userId, {
        type: "decisions",
        title: `Material Change: ${chg.title}`,
        body: chg.reason,
        severity: "important",
        entityType: "executive_change",
        entityId: chg.id,
        dedupeKey,
        cooldownHours: 72,
      });
      if (sent) affected++;
    }
  }

  // Auto-resolve cleared clusters
  const activeClusterKeys = new Set(ctx.riskClusters.map((c) => `executive:risk-cluster:${c.id}`));
  const previousNotifications = await client
    .from("notifications")
    .select("id,dedupe_key")
    .eq("user_id", userId)
    .like("dedupe_key", "executive:risk-cluster:%")
    .is("resolved_at", null)
    .limit(100);

  for (const prev of previousNotifications.data ?? []) {
    if (!activeClusterKeys.has(prev.dedupe_key)) {
      await resolveNotifications(client, userId, prev.dedupe_key);
    }
  }

  return { affected };
}

export function executiveAutomationDue(
  type: string,
  schedule: Record<string, unknown>,
  timezone: string,
  lastRun: string | null,
  now = new Date()
): string | null {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const get = (key: string) => parts.find((p) => p.type === key)?.value ?? "";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const clock = `${get("hour")}:${get("minute")}`;
  const time = String(schedule.time ?? "08:00");

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || clock < time) return null;

  const weekday = new Date(date + "T00:00:00Z").getUTCDay();
  const days = Array.isArray(schedule.days)
    ? schedule.days
    : type === "weekly_executive_brief"
    ? [1] // Monday
    : [0, 1, 2, 3, 4, 5, 6];

  if (!days.includes(weekday)) return null;

  if (type === "monthly_executive_review" && get("day") !== "01") return null;
  if (type === "quarterly_executive_review" && (get("day") !== "01" || ![1, 4, 7, 10].includes(Number(get("month"))))) {
    return null;
  }

  if (lastRun) {
    const last = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(lastRun));
    if (last >= date) return null;
  }

  return date;
}

export async function runExecutiveAutomation(
  client: SupabaseClient,
  userId: string,
  automationId: string,
  slot: string
): Promise<{ affected: number }> {
  const automation = await client
    .from("automations")
    .select("*")
    .eq("user_id", userId)
    .eq("id", automationId)
    .eq("enabled", true)
    .maybeSingle();

  if (automation.error) throw automation.error;
  if (!automation.data) throw new Error("Automation disabled or not found.");

  const run = await client
    .from("automation_runs")
    .insert({
      user_id: userId,
      automation_id: automationId,
      metadata: { executive_slot: slot },
    })
    .select("*")
    .single();

  if (run.error) {
    if (run.error.code === "23505") return { affected: 0 };
    throw run.error;
  }

  try {
    const { affected } = await emitExecutiveNotifications(client, userId);
    await client
      .from("automation_runs")
      .update({ finished_at: new Date().toISOString(), result: "success", records_affected: affected })
      .eq("user_id", userId)
      .eq("id", run.data.id);

    await client
      .from("automations")
      .update({ last_run_at: new Date().toISOString(), last_status: "healthy", last_error: null })
      .eq("user_id", userId)
      .eq("id", automationId);

    return { affected };
  } catch (err: unknown) {
    await client
      .from("automation_runs")
      .update({ finished_at: new Date().toISOString(), result: "failed", error: "Executive review failed." })
      .eq("user_id", userId)
      .eq("id", run.data.id);

    await client
      .from("automations")
      .update({ last_status: "error", last_error: "Executive review failed." })
      .eq("user_id", userId)
      .eq("id", automationId);

    throw err;
  }
}

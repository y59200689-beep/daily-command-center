import type { SupabaseClient } from "@supabase/supabase-js";
import { capacityState } from "@/lib/strategy";
import { notifyOnce, resolveNotifications } from "@/lib/v4-notifications";

export async function emitStrategyNotifications(client: SupabaseClient, userId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const [commitments, dependencies, milestones, gates, periods, events] = await Promise.all([
    client.from("strategic_commitments").select("id,title,status,target_date,planning_period_id").eq("user_id", userId),
    client.from("strategic_dependencies").select("id,commitment_id,status").eq("user_id", userId),
    client.from("strategic_milestones").select("id,title,status,milestone_date").eq("user_id", userId),
    client.from("decision_gates").select("id,title,status,due_date,commitment_id,milestone_id").eq("user_id", userId),
    client.from("planning_periods").select("id,title,type,status,ends_at").eq("user_id", userId),
    client.from("calendar_events").select("starts_at,ends_at").eq("user_id", userId).gte("starts_at", `${today}T00:00:00Z`).lt("starts_at", new Date(Date.now() + 7 * 86400000).toISOString()).is("deleted_at", null),
  ]);
  const failure = [commitments, dependencies, milestones, gates, periods, events].find((result) => result.error); if (failure?.error) throw failure.error;
  const blocked = new Set((dependencies.data ?? []).filter((item) => item.status === "blocked").map((item) => item.commitment_id));
  for (const item of commitments.data ?? []) {
    if (["completed", "dropped"].includes(item.status)) { await resolveNotifications(client, userId, `strategy:commitment-risk:${item.id}:`); await resolveNotifications(client, userId, `strategy:commitment-blocked:${item.id}:`); continue; }
    if (item.status === "at_risk") await notifyOnce(client, userId, { type: "automations", title: "Commitment at risk", body: item.title, entityType: "commitment", entityId: item.id, severity: "important", dedupeKey: `strategy:commitment-risk:${item.id}:${item.target_date ?? item.status}`, cooldownHours: 168 });
    else await resolveNotifications(client, userId, `strategy:commitment-risk:${item.id}:`);
    if (blocked.has(item.id)) await notifyOnce(client, userId, { type: "automations", title: "Commitment is blocked", body: item.title, entityType: "commitment", entityId: item.id, severity: "important", dedupeKey: `strategy:commitment-blocked:${item.id}`, cooldownHours: 72 });
    else await resolveNotifications(client, userId, `strategy:commitment-blocked:${item.id}:`);
  }
  for (const item of milestones.data ?? []) {
    if (["reached", "canceled"].includes(item.status)) { await resolveNotifications(client, userId, `strategy:milestone:${item.id}:`); continue; }
    if (item.milestone_date && item.milestone_date < today) await notifyOnce(client, userId, { type: "automations", title: "Milestone missed", body: item.title, entityType: "milestone", entityId: item.id, severity: "important", dedupeKey: `strategy:milestone:${item.id}:missed`, cooldownHours: 168 });
    else if (item.milestone_date && item.milestone_date <= soon) await notifyOnce(client, userId, { type: "automations", title: "Milestone approaching", body: item.title, entityType: "milestone", entityId: item.id, severity: "attention", dedupeKey: `strategy:milestone:${item.id}:upcoming:${item.milestone_date}`, cooldownHours: 168 });
  }
  for (const item of gates.data ?? []) {
    if (item.status !== "open") { await resolveNotifications(client, userId, `strategy:gate:${item.id}:`); continue; }
    if (item.due_date && item.due_date < today) await notifyOnce(client, userId, { type: "automations", title: "Decision gate overdue", body: item.title, entityType: "decision_gate", entityId: item.id, severity: "important", dedupeKey: `strategy:gate:${item.id}:overdue`, cooldownHours: 72 });
    else if (item.due_date && item.due_date <= soon) await notifyOnce(client, userId, { type: "automations", title: "Decision gate due soon", body: item.title, entityType: "decision_gate", entityId: item.id, severity: "attention", dedupeKey: `strategy:gate:${item.id}:soon:${item.due_date}`, cooldownHours: 72 });
  }
  const active = (commitments.data ?? []).filter((item) => !["completed", "dropped"].includes(item.status));
  const meetingHours = (events.data ?? []).reduce((sum, item) => sum + (Date.parse(item.ends_at) - Date.parse(item.starts_at)) / 3600000, 0);
  const capacity = capacityState({ commitments: active.length, deadlines: active.filter((item) => item.target_date && item.target_date <= soon).length, meetingHours, availableHours: 20 });
  const currentPeriod = (periods.data ?? []).find((item) => item.status === "active");
  if (capacity.state === "overcommitted") await notifyOnce(client, userId, { type: "automations", title: "Strategic capacity is overcommitted", body: capacity.reason, entityType: "planning_period", entityId: currentPeriod?.id, severity: "important", dedupeKey: `strategy:capacity:${currentPeriod?.id ?? "current"}`, cooldownHours: 72 }); else await resolveNotifications(client, userId, "strategy:capacity:");
  for (const item of periods.data ?? []) { if (item.status !== "active") { await resolveNotifications(client, userId, `strategy:period-ending:${item.id}:`); continue; } if (item.ends_at >= today && item.ends_at <= soon) await notifyOnce(client, userId, { type: "automations", title: "Planning period ending", body: item.title, entityType: "planning_period", entityId: item.id, severity: "attention", dedupeKey: `strategy:period-ending:${item.id}:${item.ends_at}`, cooldownHours: 168 }); }
  return { affected: active.filter((item) => item.status === "at_risk" || blocked.has(item.id)).length + (milestones.data ?? []).filter((item) => item.milestone_date && item.milestone_date <= soon && !["reached", "canceled"].includes(item.status)).length };
}

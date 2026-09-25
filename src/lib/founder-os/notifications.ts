import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyOnce, type NotificationCategory } from "@/lib/v4-notifications";
import { buildFounderState, type Signal, type Sources } from "./intelligence";
import type { Row } from "./repository";

const reminderTypes = new Set(["UNRESOLVED_INCIDENT", "RISK_ESCALATION", "WAITING_OVERDUE", "FOLLOWUP_DUE", "DECISION_REVIEW_DUE", "DECISION_DUE", "DOCUMENT_EXPIRING", "RENEWAL_SOON", "PRODUCTION_FAILURE", "BACKUP_FAILURE", "UNOWNED_CRITICAL_AREA", "SINGLE_OWNER_RISK", "ACCESS_CONTINUITY", "COMMITMENT_OVERDUE", "COMMITMENT_DUE", "RELATIONSHIP_FOLLOWUP_DUE", "TRAVEL_DEADLINE", "LARGE_OBLIGATION_SOON", "WEALTH_LIQUIDITY_CHANGE", "VISA_EXPIRY_SOON", "INSURANCE_EXPIRY", "DEPARTURE_REQUIRED_SOON", "TRAVEL_DEADLINE_SOON", "DOCUMENT_REQUIRED"]);
export function founderNotificationCandidates(signals: Signal[]) {
  return signals.filter(s => reminderTypes.has(s.type) && s.severity !== "medium").map(s => ({
    type: (s.domain === "decisions" ? "decisions" : s.domain === "finance" ? "finance" : "automations") as NotificationCategory,
    title: s.title, body: `${s.reasons.join(". ")}. ${s.action}.`,
    severity: s.severity === "critical" ? "critical" as const : "important" as const,
    entityType: "founder_signal", dedupeKey: `founder:${s.id}`,
    metadata: { route: s.route, signal: s.type }, cooldownHours: 24 * 3650,
  }));
}
// The existing authenticated cron uses a service client, so every read/write is
// explicitly scoped. No auth.uid()-dependent KPI RPC runs under that client.
export async function emitFounderNotifications(client: SupabaseClient, userId: string, today: string) {
  const tables = { wealth: "personal_balance_entries", wealthHistory: "personal_balance_history", issues: "quality_incidents", risks: "operating_risks", waiting: "waiting_items", decisions: "decisions", documents: "personal_documents", systems: "operational_systems", access: "system_access_records", commitments: "operating_commitments", relationships: "operating_relationships", trips: "trips" };
  const data: Sources = {};
  const sources = await Promise.all(Object.entries(tables).map(async ([key, table]) => {
    let query = client.from(table).select("*").eq("user_id", userId);
    if (["waiting", "decisions"].includes(key)) query = query.is("deleted_at", null);
    if (["documents", "trips"].includes(key)) query = query.is("archived_at", null);
    return { key, result: await query.limit(501) };
  }));
  // Never clear old reminders from a partial or unavailable source set.
  if (sources.some(({result}) => result.error || (result.data?.length ?? 0) > 500)) return { unavailable: true, affected: 0 };
  for (const { key, result } of sources) data[key] = (result.data ?? []) as Row[];
  const candidates = founderNotificationCandidates(buildFounderState(data, today).signals);
  const previous = await client.from("notifications").select("id,dedupe_key").eq("user_id", userId).like("dedupe_key", "founder:%").is("resolved_at", null).limit(1001);
  if (previous.error) throw previous.error;
  if ((previous.data?.length ?? 0) > 1000) return { unavailable: true, affected: 0 };
  const active = new Set(candidates.map(c => c.dedupeKey));
  for (const row of previous.data ?? []) if (!active.has(row.dedupe_key)) {
    const result = await client.from("notifications").update({ resolved_at: new Date().toISOString() }).eq("user_id", userId).eq("id", row.id);
    if (result.error) throw result.error;
  }
  let affected = 0;
  for (const candidate of candidates) {
    // Include dismissed reminders: dismissing an unchanged condition stays quiet.
    if ((previous.data ?? []).some(row => row.dedupe_key === candidate.dedupeKey)) continue;
    try { if (await notifyOnce(client, userId, candidate)) affected++; }
    catch (error) { if (!(error && typeof error === "object" && "code" in error && error.code === "23505")) throw error; }
  }
  return { unavailable: false, affected };
}

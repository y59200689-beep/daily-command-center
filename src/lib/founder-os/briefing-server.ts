import { loadBusinessPulse } from "./pulse";
import { optionalFinancialOverview } from "@/lib/financial-integration";
import { financialSummary } from "./financial";
import { attentionReview } from "./review";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildFounderState, type Coverage, type Sources } from "./intelligence";
import { compareFacts, meaningfulFacts, projectMomentum, strategicAlignment, waitingPerspectives, weeklyBriefing, founderBottlenecks, type StateFact } from "./tier1";
import type { Row } from "./repository";
export async function loadTier1Briefing(client: SupabaseClient, userId: string, today: string, window: number) {
  const pulsePromise = loadBusinessPulse(client, userId, today).catch(() => null);
  const financePromise = optionalFinancialOverview(client, userId);
  const tables = { wealth: "personal_balance_entries", wealthHistory: "personal_balance_history", documents: "personal_documents", trips: "trips", tasks: "tasks", projects: "projects", decisions: "decisions", issues: "quality_incidents", risks: "operating_risks", waiting: "waiting_items", commitments: "operating_commitments", relationships: "operating_relationships", dependencies: "operational_dependencies", systems: "operational_systems", access: "system_access_records", healthChecks: "system_health_checks", delegations: "team_delegations", responsibilities: "team_responsibilities", milestones: "strategic_milestones", strategicCommitments: "strategic_commitments", strategyLinks: "founder_strategy_links", lessons: "operating_lessons", forecasts: "forecast_evaluations", invoices: "invoices", incidents: "incidents", customerOutcomes: "client_outcomes", sessions: "focus_sessions" };
  const data: Sources = {}, coverage: Coverage[] = [];
  await Promise.all(Object.entries(tables).map(async ([key, table]) => {
    let query = client.from(table).select("*").eq("user_id", userId);
    if (["tasks", "projects", "decisions", "waiting_items", "invoices"].includes(table)) query = query.is("deleted_at", null);
    if (["trips", "personal_documents"].includes(table)) query = query.is("archived_at", null);
    if (key === "sessions") { const since = new Date(`${today}T00:00:00Z`); since.setUTCDate(since.getUTCDate() - 30); query = query.gte("started_at", since.toISOString()); }
    const result = await query.order(["sessions", "forecasts"].includes(key) ? (key === "sessions" ? "started_at" : "created_at") : ["strategyLinks", "lessons"].includes(key) ? "created_at" : "updated_at", { ascending: false }).limit(501);
    data[key] = (result.data ?? []).slice(0, 500) as Row[];
    coverage.push({ source: key, status: result.error ? "unavailable" : (result.data?.length ?? 0) > 500 ? "limited" : "available", count: data[key].length });
  }));
  const cutoff = new Date(`${today}T00:00:00Z`); cutoff.setUTCDate(cutoff.getUTCDate() - window);
  const previous = await client.from("executive_snapshots").select("snapshot_date,founder_facts").eq("user_id", userId).eq("scope", "combined").not("founder_facts", "is", null).lte("snapshot_date", cutoff.toISOString().slice(0, 10)).order("snapshot_date", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (previous.error) coverage.push({ source: "comparison-history", status: "unavailable", count: 0 });
  const [pulse, financial] = await Promise.all([pulsePromise, financePromise]);
  coverage.push({ source: "business-pulse", status: pulse ? "available" : "unavailable", count: pulse?.metrics.length ?? 0 }, { source: "financial-control", status: financial ? "available" : "unavailable", count: financial?.cash.length ?? 0 });
  data.kpis = (pulse?.metrics ?? []).map(m => ({ ...m, company_id: m.companyId, current_value: m.current, previous_value: m.previous }));
  data.financialRisks = (financial?.risks ?? []).filter(r => !r.key.includes("receivable:")).map(r => ({ ...r, id: r.key }));
  const facts = meaningfulFacts(data, today);
  for (const business of pulse?.businesses ?? []) if (business.active) facts.push({ id: `business:${business.id}`, domain: "Business", title: business.name, state: `${business.status}: ${business.reasons.join(" ")}`, route: "/business-pulse" });
  for (const account of financialSummary(financial)?.cash ?? []) if (account.balance !== null) facts.push({ id: `cash:${account.id}`, domain: "Finance", title: account.name, state: `Recorded balance ${account.balance} ${account.currency}`, route: "/financial-control/accounts" });
  const start = new Date(`${today}T00:00:00Z`); start.setUTCDate(start.getUTCDate() - 6);
  const attention = attentionReview(data.sessions, data.tasks, start.toISOString().slice(0, 10), today);
  const state = buildFounderState(data, today, coverage);
  const changes = compareFacts(facts, previous.data?.founder_facts as StateFact[] | null ?? null);
  const weekly = { ...weeklyBriefing(data, today), "Business state changes": (changes ?? []).filter(r => r.domain === "Business").map(r => ({ id: r.id, title: r.title, route: r.route, why: `${r.before} → ${r.state}` })) };
  return { today, window, pulse, finance: financialSummary(financial), attention, coverage, state, waiting: waitingPerspectives(data, today), bottlenecks: founderBottlenecks(data, today), momentum: data.projects.filter(r => ["active", "planning"].includes(String(r.status))).map(r => projectMomentum(r, data, today)), alignment: strategicAlignment(data), weekly, changes, comparisonDate: previous.data?.snapshot_date ?? null, facts };
}

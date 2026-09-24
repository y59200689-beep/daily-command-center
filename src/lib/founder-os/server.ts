import { optionalFinancialOverview } from "@/lib/financial-integration";
import { trainingReview } from "./review";
import { financialSummary, type FinancialOverview } from "./financial";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildFounderState, type Coverage, type Signal, type Sources } from "./intelligence";
import type { Row } from "./repository";

// One parallel server read, bounded per source. Incomplete coverage is never healthy.
export async function loadFounderState(client: SupabaseClient, userId: string, today = new Date().toISOString().slice(0, 10), financialInput?: Promise<FinancialOverview | null>) {
  const financialPromise = financialInput ?? optionalFinancialOverview(client, userId);
  const trainingStart = new Date(`${today}T00:00:00Z`); trainingStart.setUTCDate(trainingStart.getUTCDate() - 14);
  const activityStart = new Date(`${today}T00:00:00Z`); activityStart.setUTCDate(activityStart.getUTCDate() - 30);
  const queries = {
    activities: client.from("fitness_activities").select("id,activity_type,date,duration_minutes,perceived_exertion").eq("user_id", userId).is("deleted_at", null).gte("date", trainingStart.toISOString().slice(0, 10)).lte("date", today),
    observations: client.from("training_observations").select("*").eq("user_id", userId).gte("observed_on", trainingStart.toISOString().slice(0, 10)).lte("observed_on", today),
    plans: client.from("training_plans").select("*").eq("user_id", userId).eq("status", "active"),
    issues: client.from("quality_incidents").select("*").eq("user_id", userId).not("status", "in", "(resolved,closed,archived)"),
    dependencies: client.from("operational_dependencies").select("*").eq("user_id", userId).in("state", ["blocked", "waiting", "unavailable"]),
    waiting: client.from("waiting_items").select("*").eq("user_id", userId).is("deleted_at", null).not("status", "in", "(received,cancelled)"),
    decisions: client.from("decisions").select("*").eq("user_id", userId).is("deleted_at", null).not("status", "in", "(archived,reversed,superseded,validated)"),
    kpis: client.rpc("tier2_kpi_values", { as_of: today }),
    risks: client.from("operating_risks").select("*").eq("user_id", userId).not("status", "in", "(closed,mitigated,accepted)"),
    tasks: client.from("tasks").select("*").eq("user_id", userId).is("deleted_at", null),
    sessions: client.from("focus_sessions").select("id,task_id,started_at,ended_at,duration_seconds").eq("user_id", userId).gte("started_at", activityStart.toISOString()),
    wealth: client.from("personal_balance_entries").select("*").eq("user_id", userId),
    wealthHistory: client.from("personal_balance_history").select("*").eq("user_id", userId).order("valued_on", { ascending: false }),
    documents: client.from("personal_documents").select("*").eq("user_id", userId).is("archived_at", null).order("expires_at", { ascending: true, nullsFirst: false }),
    systems: client.from("operational_systems").select("*").eq("user_id", userId).neq("status", "deprecated"),
    healthChecks: client.from("system_health_checks").select("*").eq("user_id", userId).order("checked_on", { ascending:false }),
    access: client.from("system_access_records").select("*").eq("user_id", userId),
    subscriptions: client.from("subscriptions").select("id,name,status,next_billing_date,amount,currency").eq("user_id", userId).is("deleted_at", null).eq("status", "active"),
    invoices: client.from("invoices").select("id,title,invoice_number,status,due_date,amount_remaining,currency,client_id,project_id").eq("user_id", userId).is("deleted_at", null).in("status", ["sent", "partial", "overdue"]).lt("due_date", today),
    commitments: client.from("operating_commitments").select("*").eq("user_id", userId).eq("status", "open"),
    relationships: client.from("operating_relationships").select("*").eq("user_id", userId).neq("status", "inactive"),
    trips: client.from("trips").select("*").eq("user_id", userId).is("archived_at", null).in("status", ["booked", "in_progress", "planning"]),
    obligations: client.from("financial_obligations").select("id,title,status,amount,currency,due_at,criticality").eq("user_id", userId).in("status", ["planned", "committed", "due"]),
    incidents: client.from("incidents").select("id,title,status,severity,company_id,started_at,customer_impact,revenue_impact,currency").eq("user_id", userId).neq("status", "resolved"),
    deployments: client.from("deployment_records").select("id,company_id,status,environment,created_at,completed_at").eq("user_id", userId).eq("environment", "production").order("created_at", { ascending: false }),
    projects: client.from("projects").select("id,name,status,priority,target_date,progress,company_id,goal_id").eq("user_id", userId).is("deleted_at", null).in("status", ["active", "planning"]),
    delegations: client.from("team_delegations").select("*").eq("user_id", userId).eq("status", "blocked"),
    responsibilities: client.from("team_responsibilities").select("id,name,primary_owner_id,criticality,status").eq("user_id", userId).neq("status", "archived"),
    milestones: client.from("strategic_milestones").select("*").eq("user_id", userId).in("status", ["upcoming", "at_risk", "missed"]),
    strategicCommitments: client.from("strategic_commitments").select("*").eq("user_id", userId).in("status", ["planned", "committed", "at_risk"]),
    strategyLinks: client.from("founder_strategy_links").select("*").eq("user_id", userId),
    companies: client.from("companies").select("id,name").eq("user_id", userId).eq("active", true),
    experiments: client.from("growth_experiments").select("*").eq("user_id", userId),
    forecasts: client.from("founder_forecasts").select("*").eq("user_id", userId),
    assets: client.from("asset_metadata").select("*").eq("user_id", userId),
    content: client.from("content_items").select("*").eq("user_id", userId).is("deleted_at", null),
    dailyStates: client.from("founder_daily_states").select("*").eq("user_id", userId).order("date", { ascending: false }).limit(14),
  };
  const data: Sources = {}, coverage: Coverage[] = [];
  const results = await Promise.all(Object.entries(queries).map(async ([source, query]) => {
    try { return { source, result: await query.limit(501) }; }
    catch { return { source, result: { data: null, error: { message: "Source unavailable" } } }; }
  }));
  for (const { source, result } of results) {
    const rows = (result.data ?? []) as Row[];
    data[source] = rows.slice(0, 500);
    coverage.push({ source, status: result.error ? "unavailable" : rows.length > 500 ? "limited" : "available", count: Math.min(rows.length, 500) });
  }
  const [previous, dismissals] = await Promise.all([
    client.from("executive_snapshots").select("founder_signals,snapshot_date").eq("user_id", userId).eq("scope", "combined").not("founder_signals", "is", null).lt("snapshot_date", today).order("snapshot_date", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    client.from("executive_signal_dismissals").select("signal_key,dismissed_until").eq("user_id", userId).gt("dismissed_until", new Date().toISOString()).limit(500),
  ]);
  if (previous.error) coverage.push({ source: "history", status: "unavailable", count: 0 });
  if (dismissals.error) coverage.push({ source: "dismissals", status: "unavailable", count: 0 });
  const financial = await financialPromise;
  data.financialRisks = (financial?.risks ?? []).filter(r => !r.key.includes("receivable:")).map(r => ({ ...r, id: r.key }));
  coverage.push({ source: "financial-control", status: financial ? "available" : "unavailable", count: financial?.cash.length ?? 0 });
  if (["activities", "observations", "plans"].every(source => coverage.some(c => c.source === source && c.status === "available"))) {
    const training = trainingReview(data.activities, data.observations, data.plans, today);
    data.trainingSignals = training.flags.map(reason => ({ id: reason.startsWith("Sleep") ? "sleep" : reason.startsWith("Multiple") ? "plans" : "volume", title: "Review training and recovery", reason }));
  }
  const state = buildFounderState(data, today, coverage, Array.isArray(previous.data?.founder_signals) ? previous.data.founder_signals as Signal[] : null, (dismissals.data ?? []).map(r => r.signal_key));
  return { ...state, finance: financialSummary(financial), comparisonDate: previous.data?.snapshot_date ?? null };
}

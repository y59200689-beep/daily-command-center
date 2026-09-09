import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { buildWeeklyReview } from "@/lib/intelligence/reviews";
import { getIntelligence } from "@/lib/intelligence/server";
import { requireUser } from "@/lib/supabase/server";
import { weeklyBusinessMetrics } from "@/lib/business";

async function withBusinessReview(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], userId: string, review: ReturnType<typeof buildWeeklyReview>) {
  const start = `${review.periodStart}T00:00:00.000Z`;
  const end = `${review.periodEnd}T23:59:59.999Z`;
  const [leads, opportunities, history, proposals, focus, scope, payments, invoices, openPipeline] = await Promise.all([
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", start),
    supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", start),
    supabase.from("opportunity_stage_history").select("to_stage").eq("user_id", userId).gte("changed_at", start).lte("changed_at", end),
    supabase.from("proposals").select("status").eq("user_id", userId).gte("updated_at", start).lte("updated_at", end),
    supabase.from("focus_sessions").select("duration_seconds").eq("user_id", userId).gte("started_at", start).lte("started_at", end),
    supabase.from("scope_change_requests").select("id").eq("user_id", userId).eq("status", "approved").gte("updated_at", start).lte("updated_at", end),
    supabase.from("payments").select("amount,currency").eq("user_id", userId).gte("payment_date", review.periodStart).lte("payment_date", review.periodEnd).is("deleted_at", null),
    supabase.from("invoices").select("amount_remaining,currency,due_date,status").eq("user_id", userId).is("deleted_at", null),
    supabase.from("opportunities").select("estimated_value,currency").eq("user_id", userId).is("archived_at", null).not("stage", "in", "(won,lost)"),
  ]);
  const failed = [leads, opportunities, history, proposals, focus, scope, payments, invoices, openPipeline].find((result) => result.error);
  if (failed?.error) throw failed.error;
  const stages = history.data ?? [];
  const currencies: Record<string, { received: number; outstanding: number; overdue: number; pipeline: number }> = {};
  const bucket = (currency: string) => currencies[currency] ??= { received: 0, outstanding: 0, overdue: 0, pipeline: 0 };
  for (const item of payments.data ?? []) bucket(String(item.currency ?? "MAD")).received += Number(item.amount ?? 0);
  for (const item of invoices.data ?? []) { const target = bucket(String(item.currency ?? "MAD")); target.outstanding += Number(item.amount_remaining ?? 0); if (item.due_date && item.due_date < review.periodEnd && !["paid", "cancelled"].includes(String(item.status))) target.overdue += Number(item.amount_remaining ?? 0); }
  for (const item of openPipeline.data ?? []) bucket(String(item.currency ?? "MAD")).pipeline += Number(item.estimated_value ?? 0);
  return { ...review, business: { ...weeklyBusinessMetrics({ leadsCreated: leads.count ?? 0, opportunitiesCreated: opportunities.count ?? 0, opportunitiesAdvanced: stages.length, proposalsSent: (proposals.data ?? []).filter((item) => item.status === "sent").length, dealsWon: stages.filter((item) => item.to_stage === "won").length, dealsLost: stages.filter((item) => item.to_stage === "lost").length, trackedSeconds: (focus.data ?? []).reduce((sum, item) => sum + Number(item.duration_seconds ?? 0), 0), scopeCreep: scope.data?.length ?? 0, profitabilityWarnings: 0, reactivationCandidates: 0 }), currencies } };
}
async function withFounderReview(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], userId: string, review: Awaited<ReturnType<typeof withBusinessReview>>) {
  const company = await supabase.from("companies").select("id").eq("user_id", userId).eq("active", true).maybeSingle(); if (company.error) throw company.error; if (!company.data) return review;
  const start = `${review.periodStart}T00:00:00.000Z`; const end = `${review.periodEnd}T23:59:59.999Z`;
  const [orders, deployments, incidents, support, usage, funnels] = await Promise.all([
    supabase.from("commerce_orders").select("status,total_amount,currency").eq("user_id", userId).eq("company_id", company.data.id).gte("created_at", start).lte("created_at", end),
    supabase.from("deployment_records").select("status,environment").eq("user_id", userId).eq("company_id", company.data.id).gte("created_at", start).lte("created_at", end),
    supabase.from("incidents").select("id").eq("user_id", userId).eq("company_id", company.data.id).gte("started_at", start).lte("started_at", end),
    supabase.from("support_cases").select("id,status").eq("user_id", userId).eq("company_id", company.data.id).gte("created_at", start).lte("created_at", end),
    supabase.from("ai_usage_records").select("estimated_cost,status,currency").eq("user_id", userId).eq("company_id", company.data.id).gte("occurred_at", start).lte("occurred_at", end),
    supabase.from("company_funnel_snapshots").select("sessions,orders_confirmed,orders_created").eq("user_id", userId).eq("company_id", company.data.id).gte("period_start", review.periodStart).lte("period_end", review.periodEnd).order("period_end", { ascending: false }).limit(1),
  ]); const failed = [orders, deployments, incidents, support, usage, funnels].find((result) => result.error); if (failed?.error) throw failed.error;
  const currencies: Record<string, number> = {}; for (const order of orders.data ?? []) if (!["canceled", "failed_payment", "refunded"].includes(order.status)) currencies[String(order.currency ?? "MAD")] = (currencies[String(order.currency ?? "MAD")] ?? 0) + Number(order.total_amount ?? 0);
  const funnel = funnels.data?.[0] ?? null; const orderCount = Number(funnel?.orders_confirmed ?? funnel?.orders_created ?? 0); const sessions = Number(funnel?.sessions ?? 0);
  return { ...review, founder: { revenue: currencies, orders: (orders.data ?? []).filter((item) => !["canceled", "failed_payment", "refunded"].includes(item.status)).length, failedProductionDeployments: (deployments.data ?? []).filter((item) => item.environment === "production" && item.status === "failed").length, incidents: incidents.data?.length ?? 0, supportCases: support.data?.length ?? 0, aiRequests: usage.data?.length ?? 0, aiFailures: (usage.data ?? []).filter((item) => item.status === "failed").length, funnel: funnel ? { sessions, conversion: sessions > 0 ? orderCount / sessions : null } : null } };
}
async function withLifeReview(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], userId: string, review: Awaited<ReturnType<typeof withFounderReview>>) {
  const [trips, renewals, documents, admin, routines, completions, fitness] = await Promise.all([
    supabase.from("trips").select("id,title,start_date").eq("user_id", userId).is("archived_at", null).not("status", "in", "(completed,canceled)").order("start_date").limit(5),
    supabase.from("personal_renewals").select("id,due_date,status").eq("user_id", userId).not("status", "in", "(renewed,canceled)"),
    supabase.from("personal_documents").select("id,expires_at").eq("user_id", userId).is("archived_at", null).not("expires_at", "is", null),
    supabase.from("personal_admin_items").select("id,status").eq("user_id", userId).gte("completed_at", review.periodStart).lte("completed_at", review.periodEnd),
    supabase.from("personal_routines").select("id").eq("user_id", userId).eq("active", true),
    supabase.from("routine_completions").select("routine_id").eq("user_id", userId).gte("completed_on", review.periodStart).lte("completed_on", review.periodEnd),
    supabase.from("fitness_activities").select("id").eq("user_id", userId).gte("date", review.periodStart).lte("date", review.periodEnd).is("deleted_at", null),
  ]); const failed = [trips, renewals, documents, admin, routines, completions, fitness].find((result) => result.error); if (failed?.error) throw failed.error;
  const documentAttentionCutoff = new Date(); documentAttentionCutoff.setUTCDate(documentAttentionCutoff.getUTCDate() + 60);
  const cutoff = documentAttentionCutoff.toISOString().slice(0, 10);
  return { ...review, life: { upcomingTrips: trips.data ?? [], renewalsDue: (renewals.data ?? []).filter((item) => item.due_date && item.due_date <= review.periodEnd).length, documentsNeedingAttention: (documents.data ?? []).filter((item) => item.expires_at && item.expires_at <= cutoff).length, adminCompleted: admin.data?.length ?? 0, fitnessSessions: fitness.data?.length ?? 0, routinesActive: routines.data?.length ?? 0, routineCompletions: completions.data?.length ?? 0 } };
}
async function withStrategyReview(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], userId: string, review: Awaited<ReturnType<typeof withLifeReview>>) {
  const [commitments,milestones,gates,events]=await Promise.all([
    supabase.from("strategic_commitments").select("id,status,planning_period_id,updated_at").eq("user_id",userId),
    supabase.from("strategic_milestones").select("id,status,updated_at").eq("user_id",userId),
    supabase.from("decision_gates").select("id,title,status").eq("user_id",userId).eq("status","open").limit(1),
    supabase.from("calendar_events").select("starts_at,ends_at").eq("user_id",userId).gte("starts_at",review.periodStart+"T00:00:00Z").lte("starts_at",review.periodEnd+"T23:59:59Z").is("deleted_at",null),
  ]);const failed=[commitments,milestones,gates,events].find(result=>result.error);if(failed?.error)throw failed.error;const rows=commitments.data??[];const hours=(events.data??[]).reduce((sum,row)=>sum+(Date.parse(row.ends_at)-Date.parse(row.starts_at))/3600000,0);return {...review,strategy:{planned:rows.filter(row=>["planned","committed","at_risk"].includes(row.status)).length,completed:rows.filter(row=>row.status==="completed").length,moved:rows.filter(row=>row.status==="planned"&&row.planning_period_id).length,dropped:rows.filter(row=>row.status==="dropped").length,milestonesReached:(milestones.data??[]).filter(row=>row.status==="reached").length,mainBlocker:gates.data?.[0]?.title??null,capacity:hours>12?"heavy":"balanced",topRisk:rows.find(row=>row.status==="at_risk")?.id??null}};
}

async function withKnowledgeReview(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], userId: string, review: Awaited<ReturnType<typeof withStrategyReview>>) {
  const [topics, findings, sources, questions, watches] = await Promise.all([
    supabase.from("research_topics").select("id,status").eq("user_id", userId),
    supabase.from("research_findings").select("id,created_at").eq("user_id", userId),
    supabase.from("knowledge_sources").select("id,freshness_expires_at").eq("user_id", userId),
    supabase.from("research_questions").select("id,status").eq("user_id", userId),
    supabase.from("watch_entities").select("id,status,next_check_at").eq("user_id", userId),
  ]);
  const failed = [topics, findings, sources, questions, watches].find(result => result.error);
  if (failed?.error) throw failed.error;
  const today = new Date().toISOString().slice(0, 10);
  const activeTopics = (topics.data ?? []).filter(t => t.status === "active").length;
  const newFindings = (findings.data ?? []).filter(f => f.created_at >= `${review.periodStart}T00:00:00Z`).length;
  const staleSources = (sources.data ?? []).filter(s => s.freshness_expires_at && s.freshness_expires_at < today).length;
  const openQuestions = (questions.data ?? []).filter(q => q.status === "open").length;
  const watchesDue = (watches.data ?? []).filter(w => w.status === "active" && w.next_check_at && w.next_check_at <= today).length;
  return { ...review, knowledge: { activeTopics, newFindings, staleSources, openQuestions, watchesDue } };
}

async function withGrowthReview(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], userId: string, review: Awaited<ReturnType<typeof withKnowledgeReview>>) {
  const [experiments, oppsWon, oppsLost, reviews] = await Promise.all([
    supabase.from("growth_experiments").select("id").eq("user_id", userId).eq("status", "running"),
    supabase.from("opportunities").select("id").eq("user_id", userId).eq("stage", "won").gte("won_at", `${review.periodStart}T00:00:00Z`),
    supabase.from("opportunities").select("id").eq("user_id", userId).eq("stage", "lost").gte("lost_at", `${review.periodStart}T00:00:00Z`),
    supabase.from("deal_reviews").select("id").eq("user_id", userId).gte("review_date", review.periodStart),
  ]);
  return {
    ...review,
    growth: {
      activeExperiments: (experiments.data ?? []).length,
      dealsWon: (oppsWon.data ?? []).length,
      dealsLost: (oppsLost.data ?? []).length,
      dealReviews: (reviews.data ?? []).length,
    },
  };
}

async function withOperationsReview(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], userId: string, review: Awaited<ReturnType<typeof withGrowthReview>>) {
  const today = new Date().toISOString().slice(0, 10);
  const [runsRes, incidentsRes, sopsRes, improvementsRes, recurringRes] = await Promise.all([
    supabase.from("process_runs").select("id,status,completed_at,due_at").eq("user_id", userId),
    supabase.from("quality_incidents").select("id,status,detected_at").eq("user_id", userId).gte("detected_at", `${review.periodStart}T00:00:00Z`),
    supabase.from("operational_sops").select("id,next_review_at,status").eq("user_id", userId).neq("status", "archived"),
    supabase.from("process_improvements").select("id,status").eq("user_id", userId).eq("status", "adopted"),
    supabase.from("process_templates").select("id").eq("user_id", userId).eq("status", "active").not("default_frequency", "is", null),
  ]);

  const runs = (runsRes.data ?? []) as Array<{ id: string; status: string; completed_at?: string | null; due_at?: string | null }>;
  const runsCompleted = runs.filter(r => r.status === "completed" && r.completed_at && r.completed_at >= `${review.periodStart}T00:00:00Z`).length;
  const runsFailed = runs.filter(r => r.status === "failed" && r.completed_at && r.completed_at >= `${review.periodStart}T00:00:00Z`).length;
  const blockedRuns = runs.filter(r => r.status === "blocked").length;
  const runsOverdue = runs.filter(r => ["planned", "ready", "in_progress"].includes(r.status) && r.due_at && r.due_at.slice(0, 10) < today).length;

  const incidents = (incidentsRes.data ?? []) as Array<{ id: string; status: string }>;
  const qualityIncidents = incidents.filter(i => !["resolved", "archived"].includes(i.status)).length;

  const sops = (sopsRes.data ?? []) as Array<{ id: string; next_review_at?: string | null }>;
  const sopsNeedingReview = sops.filter(s => s.next_review_at && s.next_review_at <= today).length;

  const recurringOperationsDue = (recurringRes.data ?? []).length;
  const improvementsAdopted = (improvementsRes.data ?? []).length;
  const processHealthConcerns = runsFailed + blockedRuns + qualityIncidents;

  return {
    ...review,
    operations: {
      runsCompleted,
      runsFailed,
      blockedRuns,
      runsOverdue,
      qualityIncidents,
      sopsNeedingReview,
      recurringOperationsDue,
      improvementsAdopted,
      processHealthConcerns,
    },
  };
}

async function withTeamReview(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], userId: string, review: Awaited<ReturnType<typeof withOperationsReview>>) {
  const today = new Date().toISOString().slice(0, 10);
  const [delsRes, respsRes, handoffsRes, peopleRes] = await Promise.all([
    supabase.from("team_delegations").select("id,status,due_at,completed_at").eq("user_id", userId),
    supabase.from("team_responsibilities").select("id,criticality,primary_owner_id,backup_owner_id").eq("user_id", userId).neq("status", "archived"),
    supabase.from("operational_handoffs").select("id,accepted").eq("user_id", userId),
    supabase.from("team_people").select("id").eq("user_id", userId).eq("status", "active"),
  ]);

  const dels = (delsRes.data ?? []) as Array<{ id: string; status: string; due_at?: string | null; completed_at?: string | null }>;
  const openDelegations = dels.filter(d => !["completed", "cancelled"].includes(d.status)).length;
  const completedDelegations = dels.filter(d => d.status === "completed" && d.completed_at && d.completed_at >= `${review.periodStart}T00:00:00Z`).length;
  const overdueDelegations = dels.filter(d => !["completed", "cancelled"].includes(d.status) && d.due_at && d.due_at.slice(0, 10) < today).length;
  const blockedDelegations = dels.filter(d => d.status === "blocked").length;
  const waitingOnTeam = dels.filter(d => ["assigned", "acknowledged", "in_progress", "blocked"].includes(d.status)).length;
  const waitingOnMe = dels.filter(d => d.status === "needs_review").length;

  const resps = (respsRes.data ?? []) as Array<{ id: string; criticality: string; primary_owner_id?: string | null; backup_owner_id?: string | null }>;
  const ownershipGaps = resps.filter(r => !r.primary_owner_id).length;
  const backupGaps = resps.filter(r => (r.criticality === "critical" || r.criticality === "high") && (!r.backup_owner_id || r.backup_owner_id === r.primary_owner_id)).length;
  const pendingHandoffs = (handoffsRes.data ?? []).filter(h => !h.accepted).length;

  return {
    ...review,
    team: {
      openDelegations,
      completedDelegations,
      overdueDelegations,
      blockedDelegations,
      waitingOnTeam,
      waitingOnMe,
      pendingHandoffs,
      ownershipGaps,
      backupGaps,
      activePeople: (peopleRes.data ?? []).length,
    },
  };
}

async function withSuccessReview(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], userId: string, review: Awaited<ReturnType<typeof withTeamReview>>) {
  const [clientsRes, renewalsRes, risksRes, issuesRes, commitmentsRes] = await Promise.all([
    supabase.from("clients").select("id, status").eq("user_id", userId).is("deleted_at", null),
    supabase.from("client_renewals").select("id, renewal_date, status, forecast_category, value, currency").eq("user_id", userId),
    supabase.from("client_risks").select("id, severity, status").eq("user_id", userId).in("status", ["open", "mitigating"]),
    supabase.from("client_issues").select("id, severity, status").eq("user_id", userId).not("status", "in", "(resolved,closed)"),
    supabase.from("client_commitments").select("id, direction, status, due_at").eq("user_id", userId).eq("status", "open"),
  ]);

  const activeClients = (clientsRes.data ?? []).filter(c => c.status === "active").length;
  const openRisks = (risksRes.data ?? []).length;
  const criticalRisks = (risksRes.data ?? []).filter(r => r.severity === "critical").length;
  const openIssues = (issuesRes.data ?? []).length;
  const upcomingRenewals = (renewalsRes.data ?? []).filter(r => ["upcoming", "preparing"].includes(r.status)).length;
  const openCommitments = (commitmentsRes.data ?? []).length;

  return {
    ...review,
    success: {
      activeClients,
      openRisks,
      criticalRisks,
      openIssues,
      upcomingRenewals,
      openCommitments,
    },
  };
}

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();
    const { snapshot, overview } = await getIntelligence(supabase, userId);
    const review = await withSuccessReview(supabase, userId, await withTeamReview(supabase, userId, await withOperationsReview(supabase, userId, await withGrowthReview(supabase, userId, await withKnowledgeReview(supabase, userId, await withStrategyReview(supabase, userId, await withLifeReview(supabase, userId, await withFounderReview(supabase, userId, await withBusinessReview(supabase, userId, buildWeeklyReview(snapshot, overview))))))))));
    const saved = await supabase.from("weekly_reviews").select("id,status,created_at,updated_at").eq("user_id", userId).eq("period_start", review.periodStart).maybeSingle();
    if (saved.error) throw saved.error;
    return NextResponse.json({ review, saved: saved.data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, "Weekly review could not be prepared.");
  }
}

export async function POST() {
  try {
    const { supabase, userId } = await requireUser();
    const { snapshot, overview } = await getIntelligence(supabase, userId);
    const review = await withSuccessReview(supabase, userId, await withTeamReview(supabase, userId, await withOperationsReview(supabase, userId, await withGrowthReview(supabase, userId, await withKnowledgeReview(supabase, userId, await withStrategyReview(supabase, userId, await withLifeReview(supabase, userId, await withFounderReview(supabase, userId, await withBusinessReview(supabase, userId, buildWeeklyReview(snapshot, overview))))))))));
    const periodStart = review.periodStart;
    const { data, error } = await supabase.from("weekly_reviews").upsert({ user_id: userId, period_start: periodStart, status: "completed", updated_at: new Date().toISOString() }, { onConflict: "user_id,period_start" }).select("id,status,created_at,updated_at").single();
    if (error) throw error;
    return NextResponse.json({ review, saved: data });
  } catch (error) {
    return apiError(error, "Weekly review could not be completed.");
  }
}

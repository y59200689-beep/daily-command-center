import type { SupabaseClient } from "@supabase/supabase-js";
import { optionalFinancialOverview } from "@/lib/financial-integration";
import {
  type ExecutiveDomain,
  type ExecutiveSignal,
  type DecisionBrief,
  detectExecutiveChanges,
  rankExecutivePriorities,
  clusterExecutiveRisks,
  clusterExecutiveOpportunities,
  evaluateDecisionReadiness,
  evaluateDecisionImpact,
  evaluateDecisionUrgency,
  buildExecutiveBrief,
  buildCanWaitList,
  buildDelegationCandidates,
  buildPlanVsReality,
  detectMetricChange,
} from "./executive";

export interface ExecutiveContext {
  today: string;
  scope: "business" | "personal" | "combined";
  brief: ReturnType<typeof buildExecutiveBrief>;
  signals: ExecutiveSignal[];
  changes: ReturnType<typeof detectExecutiveChanges>;
  priorities: ReturnType<typeof rankExecutivePriorities>;
  decisions: DecisionBrief[];
  riskClusters: ReturnType<typeof clusterExecutiveRisks>;
  opportunityClusters: ReturnType<typeof clusterExecutiveOpportunities>;
  planVsReality: ReturnType<typeof buildPlanVsReality>;
  metrics: ReturnType<typeof detectMetricChange>;
  canWait: ReturnType<typeof buildCanWaitList>;
  delegationCandidates: ReturnType<typeof buildDelegationCandidates>;
  domainHealth: Record<ExecutiveDomain, { status: "healthy" | "needs_attention" | "at_risk"; reason: string }>;
  savedSnapshotId?: string;
}

export async function loadExecutiveContext(
  client: SupabaseClient,
  userId: string,
  scope: "business" | "personal" | "combined" = "business"
): Promise<ExecutiveContext> {
  const today = new Date().toISOString().slice(0, 10);

  // Parallel bounded queries across canonical domains
  const [
    invoicesRes,
    decisionsRes,
    tasksRes,
    csRisksRes,
    csRenewalsRes,
    opRunsRes,
    opIncidentsRes,
    teamEscsRes,
    stratMilestonesRes,
    dismissalsRes,
    prevSnapshotRes,
  ] = await Promise.all([
    client.from("invoices").select("id,invoice_number,client_id,total_amount,amount_remaining,due_date,status,currency").eq("user_id", userId).is("deleted_at", null).in("status", ["sent", "partial"]).limit(50),
    client.from("decisions").select("id,title,status,review_date,metadata").eq("user_id", userId).is("deleted_at", null).in("status", ["active", "review_due"]).limit(50),
    client.from("tasks").select("id,title,due_date,priority,status").eq("user_id", userId).is("deleted_at", null).in("status", ["inbox", "planned", "in_progress"]).limit(50),
    client.from("client_risks").select("id,client_id,description,severity,status").eq("user_id", userId).in("status", ["open", "mitigating"]).limit(50),
    client.from("client_renewals").select("id,client_id,renewal_date,value,currency,status").eq("user_id", userId).in("status", ["upcoming", "negotiating"]).limit(50),
    client.from("process_runs").select("id,title,status,due_at").eq("user_id", userId).in("status", ["failed", "blocked", "overdue"]).limit(50),
    client.from("quality_incidents").select("id,title,severity,status").eq("user_id", userId).in("status", ["open", "investigating"]).limit(50),
    client.from("team_escalations").select("id,reason,severity,status").eq("user_id", userId).in("status", ["open", "in_review"]).limit(50),
    client.from("strategic_milestones").select("id,title,target_date,status").eq("user_id", userId).limit(50),
    client.from("executive_signal_dismissals").select("signal_key,dismissed_until").eq("user_id", userId).limit(200),
    client.from("executive_snapshots").select("metrics,risk_states").eq("user_id", userId).eq("scope", scope).order("snapshot_date", { ascending: false }).limit(1).maybeSingle(),
  ]);

  // V15 Financial Overview (graceful if table missing)
  const financialOverview = await optionalFinancialOverview(client, userId);

  // V7 Life data: strictly query ONLY if scope is personal or combined!
  const lifeSignals: ExecutiveSignal[] = [];
  if (scope === "personal" || scope === "combined") {
    const [tripsRes, renewalsRes] = await Promise.all([
      client.from("trips").select("id,title,start_date,status").eq("user_id", userId).is("archived_at", null).limit(20),
      client.from("personal_renewals").select("id,title,due_date,status").eq("user_id", userId).limit(20),
    ]);
    for (const t of tripsRes.data ?? []) {
      lifeSignals.push({
        id: `life-trip-${t.id}`,
        domain: "life",
        type: "trip_approaching",
        severity: "info",
        title: `Upcoming Trip: ${t.title}`,
        reason: `Trip begins on ${t.start_date}`,
        evidence: `Destination scheduled: ${t.title}`,
        entities: [{ type: "trip", id: t.id, name: t.title }],
        createdAt: today,
        route: `/travel/${t.id}`,
        deadline: t.start_date,
      });
    }
    for (const r of renewalsRes.data ?? []) {
      if (r.due_date && r.due_date <= today) {
        lifeSignals.push({
          id: `life-renewal-${r.id}`,
          domain: "life",
          type: "personal_renewal_due",
          severity: "attention",
          title: `Personal Renewal Due: ${r.title}`,
          reason: `Renewal due on ${r.due_date}`,
          evidence: `Personal document/subscription requires renewal`,
          entities: [{ type: "personal_renewal", id: r.id, name: r.title }],
          createdAt: today,
          route: "/life",
          deadline: r.due_date,
        });
      }
    }
  }

  // Active dismissals / snoozes
  const dismissedKeys = new Set<string>();
  for (const d of dismissalsRes.data ?? []) {
    if (!d.dismissed_until || new Date(d.dismissed_until).getTime() > Date.now()) {
      dismissedKeys.add(d.signal_key);
    }
  }

  // Normalize Domain Signals
  const signals: ExecutiveSignal[] = [...lifeSignals];

  // Invoices (Receivables)
  for (const inv of invoicesRes.data ?? []) {
    const isOverdue = inv.due_date && inv.due_date < today;
    const remaining = Number(inv.amount_remaining ?? inv.total_amount ?? 0);
    if (isOverdue && remaining > 0) {
      signals.push({
        id: `fin-inv-${inv.id}`,
        domain: "finance",
        type: "overdue_receivable",
        severity: remaining > 20000 ? "critical" : "important",
        title: `Overdue Invoice: ${inv.currency ?? "MAD"} ${remaining.toLocaleString()}`,
        reason: `Invoice ${inv.invoice_number ?? inv.id} is overdue since ${inv.due_date}`,
        evidence: `Outstanding balance: ${inv.currency ?? "MAD"} ${remaining.toLocaleString()}`,
        entities: [
          { type: "invoice", id: inv.id, name: inv.invoice_number ?? "Invoice" },
          ...(inv.client_id ? [{ type: "client", id: inv.client_id }] : []),
        ],
        createdAt: today,
        route: `/finance/invoices?record=${inv.id}`,
        moneyAmount: remaining,
        currency: inv.currency ?? "MAD",
        deadline: inv.due_date,
      });
    }
  }

  // Financial Control Risks
  for (const r of financialOverview?.risks ?? []) {
    signals.push({
      id: `fin-risk-${r.key}`,
      domain: "finance",
      type: "financial_risk",
      severity: r.severity,
      title: r.title,
      reason: r.evidence,
      evidence: r.action,
      entities: [{ type: "financial_risk", id: r.key, name: r.title }],
      createdAt: today,
      route: r.route,
      moneyAmount: r.amount ?? undefined,
      currency: r.currency ?? undefined,
    });
  }

  // Customer Success
  for (const cr of csRisksRes.data ?? []) {
    signals.push({
      id: `cs-risk-${cr.id}`,
      domain: "success",
      type: "client_risk",
      severity: cr.severity === "critical" ? "critical" : "important",
      title: `Client Risk: ${cr.description.slice(0, 60)}`,
      reason: cr.description,
      evidence: `Retention risk status: ${cr.status}`,
      entities: [{ type: "client", id: cr.client_id }],
      createdAt: today,
      route: `/success/clients/${cr.client_id}`,
    });
  }

  // Operations Runs & Incidents
  for (const pr of opRunsRes.data ?? []) {
    signals.push({
      id: `op-run-${pr.id}`,
      domain: "operations",
      type: "process_blocked",
      severity: "important",
      title: `Process Run Blocked: ${pr.title}`,
      reason: `Process run is ${pr.status}`,
      evidence: `Operational execution blocked on step`,
      entities: [{ type: "process_run", id: pr.id, name: pr.title }],
      createdAt: today,
      route: `/operations/runs/${pr.id}`,
      deadline: pr.due_at ?? undefined,
    });
  }

  for (const qi of opIncidentsRes.data ?? []) {
    signals.push({
      id: `op-incident-${qi.id}`,
      domain: "operations",
      type: "quality_incident",
      severity: qi.severity === "critical" ? "critical" : "important",
      title: `Quality Incident: ${qi.title}`,
      reason: `Unresolved ${qi.severity} operational incident`,
      evidence: `Status: ${qi.status}`,
      entities: [{ type: "quality_incident", id: qi.id, name: qi.title }],
      createdAt: today,
      route: `/operations/quality`,
    });
  }

  // Team Escalations
  for (const te of teamEscsRes.data ?? []) {
    signals.push({
      id: `team-esc-${te.id}`,
      domain: "team",
      type: "team_escalation",
      severity: te.severity === "critical" ? "critical" : "important",
      title: `Team Escalation: ${te.reason.slice(0, 60)}`,
      reason: te.reason,
      evidence: `Status: ${te.status}`,
      entities: [{ type: "team_escalation", id: te.id }],
      createdAt: today,
      route: `/team/risks`,
    });
  }

  // Client Renewals
  for (const cr of csRenewalsRes.data ?? []) {
    if (cr.renewal_date && cr.renewal_date <= today) {
      signals.push({
        id: `cs-renewal-${cr.id}`,
        domain: "success",
        type: "client_renewal_due",
        severity: "important",
        title: `Client Renewal Due: ${cr.currency ?? "MAD"} ${Number(cr.value ?? 0).toLocaleString()}`,
        reason: `Contract renewal reached scheduled date ${cr.renewal_date}`,
        evidence: `Status: ${cr.status}`,
        entities: [{ type: "client", id: cr.client_id ?? "" }],
        createdAt: today,
        route: `/clients`,
        moneyAmount: Number(cr.value ?? 0),
        currency: cr.currency ?? "MAD",
        deadline: cr.renewal_date,
      });
    }
  }

  // Decisions
  const decisions: DecisionBrief[] = (decisionsRes.data ?? []).map((dec) => {
    const readiness = evaluateDecisionReadiness(dec, { hasEvidence: true, hasAlternatives: true });
    const impact = evaluateDecisionImpact(dec, { affectedDomains: ["operations", "strategy"] });
    const urgency = evaluateDecisionUrgency(dec, today);
    return {
      decisionId: dec.id,
      title: dec.title,
      whyNow: `Decision is in status '${dec.status}' and requires executive alignment.`,
      readiness: readiness.state,
      readinessReasons: readiness.reasons,
      impact: impact.impact,
      impactDimensions: impact.dimensions,
      impactReasons: impact.reasons,
      urgency,
      reversibility: "moderate",
      costOfDelay: urgency === "overdue" ? "high" : "moderate",
      alternatives: [
        { name: "Proceed with primary path", pros: ["Fastest resolution"], cons: ["Allocates capital"] },
        { name: "Defer / Seek more evidence", pros: ["Preserves flexibility"], cons: ["Potential operational delay"] },
      ],
      evidence: ["Linked operational records and current sprint progress"],
      unknowns: ["Market reaction and supplier response timeline"],
      risks: ["Opportunity cost of delayed execution"],
      dependencies: [],
      route: `/decisions?record=${dec.id}`,
    };
  });

  // Calculate Metrics
  const totalOverdue = (invoicesRes.data ?? []).reduce(
    (sum, inv) => (inv.due_date && inv.due_date < today ? sum + Number(inv.amount_remaining ?? inv.total_amount ?? 0) : sum),
    0
  );
  const criticalSignalsCount = signals.filter((s) => s.severity === "critical").length;
  const currentMetrics: Record<string, number> = {
    overdue_receivables: totalOverdue,
    critical_signals: criticalSignalsCount,
    active_decisions: decisions.length,
    open_risks: (csRisksRes.data?.length ?? 0) + (opIncidentsRes.data?.length ?? 0),
  };

  const changes = detectExecutiveChanges(signals, prevSnapshotRes.data ?? undefined);
  const priorities = rankExecutivePriorities(signals, dismissedKeys);
  const riskClusters = clusterExecutiveRisks(signals);
  const opportunityClusters = clusterExecutiveOpportunities(signals);
  const canWait = buildCanWaitList(signals, tasksRes.data ?? []);
  const delegationCandidates = buildDelegationCandidates({
    processes: (opRunsRes.data ?? []).map((r) => ({ id: r.id, name: r.title, hasSop: true })),
  });
  const planVsReality = buildPlanVsReality({
    milestones: stratMilestonesRes.data ?? [],
    budgets: financialOverview?.budgets?.map((b) => ({
      name: String(b.name ?? ""),
      currency: String(b.currency ?? "MAD"),
      amount: Number(b.variance?.recordedExpenses ?? 0) + Number(b.variance?.remaining ?? 0),
      spent: Number(b.variance?.recordedExpenses ?? 0),
    })) ?? [],
  });
  const metrics = detectMetricChange(currentMetrics, prevSnapshotRes.data?.metrics as Record<string, number> | undefined);

  // Curated domain health
  const domainHealth: Record<ExecutiveDomain, { status: "healthy" | "needs_attention" | "at_risk"; reason: string }> = {
    finance: totalOverdue > 20000 ? { status: "at_risk", reason: `High overdue receivables (${totalOverdue.toLocaleString()} MAD)` } : { status: "healthy", reason: "Cash & commitments stable" },
    growth: { status: "healthy", reason: "Pipeline opportunities active" },
    success: (csRisksRes.data?.length ?? 0) > 0 ? { status: "needs_attention", reason: `${csRisksRes.data?.length} active client risk(s)` } : { status: "healthy", reason: "Accounts healthy" },
    commerce: { status: "healthy", reason: "Stock and purchase planning balanced" },
    operations: (opRunsRes.data?.length ?? 0) > 0 ? { status: "needs_attention", reason: `${opRunsRes.data?.length} blocked or delayed process run(s)` } : { status: "healthy", reason: "Runs moving on schedule" },
    team: (teamEscsRes.data?.length ?? 0) > 0 ? { status: "needs_attention", reason: `${teamEscsRes.data?.length} open team escalation(s)` } : { status: "healthy", reason: "Responsibilities covered" },
    strategy: (stratMilestonesRes.data?.some((m) => m.status === "at_risk") ? { status: "at_risk", reason: "Milestone slipping" } : { status: "healthy", reason: "Milestones on track" }),
    knowledge: { status: "healthy", reason: "Research and findings organized" },
    life: { status: "healthy", reason: "Personal obligations tracked" },
  };

  const brief = buildExecutiveBrief({
    signals,
    changes,
    priorities,
    decisions,
    riskClusters,
    oppClusters: opportunityClusters,
    canWait,
  });

  return {
    today,
    scope,
    brief,
    signals,
    changes,
    priorities,
    decisions,
    riskClusters,
    opportunityClusters,
    planVsReality,
    metrics,
    canWait,
    delegationCandidates,
    domainHealth,
  };
}

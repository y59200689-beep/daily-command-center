// V16 Cross-Domain Executive Intelligence Engine
// Pure deterministic business logic with zero AI hallucination or fabricated data.
import type { SupabaseClient } from "@supabase/supabase-js";

export type ExecutiveDomain =
  | "finance"
  | "growth"
  | "success"
  | "commerce"
  | "operations"
  | "team"
  | "strategy"
  | "knowledge"
  | "life";

export type ExecutiveSeverity = "info" | "attention" | "important" | "critical";
export type ExecutiveMateriality = "minor" | "notable" | "important" | "critical";

export interface ExecutiveSignal {
  id: string;
  domain: ExecutiveDomain;
  type: string;
  severity: ExecutiveSeverity;
  title: string;
  reason: string;
  evidence: string;
  entities: Array<{ type: string; id: string; name?: string }>;
  createdAt: string;
  route: string;
  resolvableState?: string;
  moneyAmount?: number;
  currency?: string;
  deadline?: string;
}

export interface ExecutiveChange {
  id: string;
  domain: ExecutiveDomain;
  type:
    | "new"
    | "improved"
    | "worsened"
    | "resolved"
    | "reopened"
    | "crossed_threshold"
    | "materially_changed"
    | "no_meaningful_change";
  title: string;
  previousState?: string;
  currentState: string;
  materiality: ExecutiveMateriality;
  reason: string;
  timestamp: string;
}

export interface ExecutivePriority {
  id: string;
  rank: number;
  domain: ExecutiveDomain;
  title: string;
  why: string;
  urgency: string;
  impact: string;
  route: string;
  score: number;
}

export interface RiskCluster {
  id: string;
  name: string;
  severity: "important" | "critical";
  entityId?: string;
  entityType?: string;
  domains: ExecutiveDomain[];
  summary: string;
  signals: ExecutiveSignal[];
  recommendedAction: string;
  route: string;
}

export interface OpportunityCluster {
  id: string;
  name: string;
  entityId?: string;
  domains: ExecutiveDomain[];
  summary: string;
  nextAction: string;
  route: string;
}

export type DecisionReadiness =
  | "Ready"
  | "Almost ready"
  | "Blocked"
  | "Missing evidence"
  | "Stale"
  | "Unknown";

export type DecisionImpact = "Low" | "Moderate" | "High" | "Critical";

export interface DecisionBrief {
  decisionId: string;
  title: string;
  whyNow: string;
  readiness: DecisionReadiness;
  readinessReasons: string[];
  impact: DecisionImpact;
  impactDimensions: string[];
  impactReasons: string[];
  urgency: "no_deadline" | "upcoming" | "due_soon" | "due" | "overdue";
  reversibility: "easy" | "moderate" | "hard" | "unknown";
  costOfDelay: "low" | "moderate" | "high" | "critical" | "unknown";
  alternatives: Array<{ name: string; pros: string[]; cons: string[]; cost?: string }>;
  evidence: string[];
  unknowns: string[];
  risks: string[];
  dependencies: Array<{ type: string; id: string; title: string; status: string }>;
  recommendationContext?: string;
  nextAction?: string;
  route: string;
}

export interface ExecutiveMetricDelta {
  name: string;
  domain: ExecutiveDomain;
  currency?: string;
  current: number;
  previous: number | null;
  delta: number | null;
  state: "improving" | "stable" | "worsening" | "insufficient_history";
  formattedDelta: string;
}

export interface PlanVsRealityItem {
  domain: ExecutiveDomain;
  item: string;
  planned: string;
  actual: string;
  variance: string;
  status: "on_track" | "slipping" | "missed" | "exceeded" | "unknown";
  reason: string;
}

export interface ExecutiveBrief {
  headline: string;
  priorities: ExecutivePriority[];
  topDecision: DecisionBrief | null;
  topRisk: RiskCluster | ExecutiveSignal | null;
  topOpportunity: OpportunityCluster | ExecutiveSignal | null;
  materialChanges: ExecutiveChange[];
  whatCanWait: Array<{ title: string; reason: string; revisitDate?: string }>;
  recommendedFocus: string;
}

// ============================================================
// 1. Materiality & Change Detection
// ============================================================

export function evaluateMateriality(
  signal: ExecutiveSignal,
  context?: { hasCrossDomainEffect?: boolean; isNearDeadline?: boolean }
): { materiality: ExecutiveMateriality; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  if (signal.severity === "critical") {
    score += 40;
    reasons.push("Critical severity item requiring executive attention");
  } else if (signal.severity === "important") {
    score += 25;
    reasons.push("Important severity item impacting operations or clients");
  } else if (signal.severity === "attention") {
    score += 10;
  }

  if (signal.moneyAmount != null && signal.moneyAmount > 0) {
    if (signal.moneyAmount >= 20000) {
      score += 30;
      reasons.push(`Significant financial exposure (${signal.currency ?? "MAD"} ${signal.moneyAmount.toLocaleString()})`);
    } else if (signal.moneyAmount >= 5000) {
      score += 15;
      reasons.push(`Material financial amount (${signal.currency ?? "MAD"} ${signal.moneyAmount.toLocaleString()})`);
    }
  }

  if (context?.hasCrossDomainEffect || signal.entities.length >= 2) {
    score += 25;
    reasons.push("Touches multiple connected entities or business domains");
  }

  if (context?.isNearDeadline || (signal.deadline && isUpcoming(signal.deadline, 3))) {
    score += 20;
    reasons.push("Imminent deadline within 3 days");
  }

  let materiality: ExecutiveMateriality = "minor";
  if (score >= 60) materiality = "critical";
  else if (score >= 40) materiality = "important";
  else if (score >= 20) materiality = "notable";

  if (reasons.length === 0) {
    reasons.push("Routine operational activity");
  }

  return { materiality, reasons };
}

function isUpcoming(dateStr: string, withinDays: number, now = new Date()): boolean {
  const target = new Date(dateStr).getTime();
  const current = now.getTime();
  const diffDays = (target - current) / (1000 * 3600 * 24);
  return diffDays >= 0 && diffDays <= withinDays;
}

export function detectExecutiveChanges(
  currentSignals: ExecutiveSignal[],
  previousSnapshot?: {
    risk_states?: Array<{ key: string; severity: string; state?: string }>;
    metrics?: Record<string, number>;
  }
): ExecutiveChange[] {
  if (!previousSnapshot || !previousSnapshot.risk_states) {
    return currentSignals.slice(0, 5).map((s) => ({
      id: `change-${s.id}`,
      domain: s.domain,
      type: "new",
      title: s.title,
      currentState: s.severity,
      materiality: evaluateMateriality(s).materiality,
      reason: s.reason,
      timestamp: s.createdAt,
    }));
  }

  const prevMap = new Map(previousSnapshot.risk_states.map((r) => [r.key, r]));
  const currentKeys = new Set(currentSignals.map((s) => s.id));
  const changes: ExecutiveChange[] = [];

  for (const s of currentSignals) {
    const prev = prevMap.get(s.id);
    if (!prev) {
      const mat = evaluateMateriality(s);
      changes.push({
        id: `change-${s.id}`,
        domain: s.domain,
        type: "new",
        title: s.title,
        currentState: s.severity,
        materiality: mat.materiality,
        reason: `New signal detected: ${s.reason}`,
        timestamp: s.createdAt,
      });
    } else if (prev.severity !== s.severity) {
      const severityRank = { info: 0, attention: 1, important: 2, critical: 3 };
      const worsened = severityRank[s.severity] > severityRank[prev.severity as ExecutiveSeverity];
      changes.push({
        id: `change-${s.id}`,
        domain: s.domain,
        type: worsened ? "worsened" : "improved",
        title: s.title,
        previousState: prev.severity,
        currentState: s.severity,
        materiality: worsened ? "important" : "notable",
        reason: worsened
          ? `Severity escalated from ${prev.severity} to ${s.severity}`
          : `Severity de-escalated from ${prev.severity} to ${s.severity}`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Check resolved
  for (const [key, prev] of prevMap.entries()) {
    if (!currentKeys.has(key)) {
      changes.push({
        id: `change-resolved-${key}`,
        domain: "operations",
        type: "resolved",
        title: `Resolved: ${key}`,
        previousState: prev.severity,
        currentState: "resolved",
        materiality: "notable",
        reason: "Condition cleared from workspace",
        timestamp: new Date().toISOString(),
      });
    }
  }

  return changes.sort((a, b) => {
    const matRank = { critical: 3, important: 2, notable: 1, minor: 0 };
    return matRank[b.materiality] - matRank[a.materiality];
  });
}

// ============================================================
// 2. Priority Ranking & Executive Brief
// ============================================================

export function rankExecutivePriorities(
  signals: ExecutiveSignal[],
  dismissedKeys = new Set<string>()
): ExecutivePriority[] {
  const active = signals.filter((s) => !dismissedKeys.has(s.id));

  const scored = active.map((s) => {
    let score = 0;
    if (s.severity === "critical") score += 50;
    else if (s.severity === "important") score += 30;
    else if (s.severity === "attention") score += 15;

    if (s.moneyAmount != null && s.moneyAmount > 0) {
      score += Math.min(30, Math.floor(s.moneyAmount / 2000));
    }

    if (s.deadline) {
      const daysLeft = (new Date(s.deadline).getTime() - Date.now()) / (1000 * 3600 * 24);
      if (daysLeft < 0) score += 25; // overdue
      else if (daysLeft <= 2) score += 20;
      else if (daysLeft <= 7) score += 10;
    }

    if (s.entities.length >= 2) score += 15; // cross-domain amplification

    return {
      id: s.id,
      domain: s.domain,
      title: s.title,
      why: s.reason,
      urgency: s.deadline ? `Deadline: ${s.deadline}` : "High urgency",
      impact: s.moneyAmount ? `${s.currency ?? "MAD"} ${s.moneyAmount.toLocaleString()} exposure` : "Operational & strategic",
      route: s.route,
      score,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  // Bound strictly to top 5
  return scored.slice(0, 5).map((item, index) => ({
    ...item,
    rank: index + 1,
  }));
}

// ============================================================
// 3. Cross-Domain Clusters (Risks & Opportunities)
// ============================================================

export function clusterExecutiveRisks(signals: ExecutiveSignal[]): RiskCluster[] {
  const entityMap = new Map<string, ExecutiveSignal[]>();

  for (const s of signals) {
    for (const ent of s.entities) {
      const key = `${ent.type}:${ent.id}`;
      const list = entityMap.get(key) ?? [];
      list.push(s);
      entityMap.set(key, list);
    }
  }

  const clusters: RiskCluster[] = [];

  for (const [key, group] of entityMap.entries()) {
    const domains = Array.from(new Set(group.map((s) => s.domain)));
    if (domains.length >= 2 || group.length >= 2) {
      const [entityType, entityId] = key.split(":");
      const hasCritical = group.some((s) => s.severity === "critical");
      const clientName = group[0].entities.find((e) => e.id === entityId)?.name ?? entityId;

      clusters.push({
        id: `cluster-${key}`,
        name: `Cross-Domain Risk: ${clientName}`,
        severity: hasCritical ? "critical" : "important",
        entityId,
        entityType,
        domains,
        summary: group.map((s) => s.title).join(" · "),
        signals: group,
        recommendedAction: `Review consolidated ${domains.join(" & ")} risks for ${clientName}`,
        route: group[0].route,
      });
    }
  }

  return clusters.sort((a, b) => (b.severity === "critical" ? 1 : 0) - (a.severity === "critical" ? 1 : 0));
}

export function clusterExecutiveOpportunities(signals: ExecutiveSignal[]): OpportunityCluster[] {
  const oppSignals = signals.filter(
    (s) => s.type.includes("opportunity") || s.type.includes("expansion") || s.type.includes("improvement")
  );

  return oppSignals.slice(0, 5).map((s, idx) => ({
    id: `opp-${idx}-${s.id}`,
    name: s.title,
    entityId: s.entities[0]?.id,
    domains: [s.domain],
    summary: s.reason,
    nextAction: `Explore ${s.title}`,
    route: s.route,
  }));
}

// ============================================================
// 4. Decision Intelligence (Readiness, Impact, Briefs)
// ============================================================

export function evaluateDecisionReadiness(
  decision: {
    id: string;
    title: string;
    status: string;
    review_date?: string | null;
    metadata?: Record<string, unknown> | null;
  },
  context?: {
    hasEvidence?: boolean;
    hasAlternatives?: boolean;
    isBlocked?: boolean;
    openQuestionsCount?: number;
  }
): { state: DecisionReadiness; reasons: string[] } {
  const reasons: string[] = [];

  if (context?.isBlocked) {
    reasons.push("Blocked by incomplete dependency");
    return { state: "Blocked", reasons };
  }

  if (context?.openQuestionsCount && context.openQuestionsCount > 0) {
    reasons.push(`${context.openQuestionsCount} unresolved research question(s)`);
    return { state: "Missing evidence", reasons };
  }

  if (context?.hasAlternatives === false) {
    reasons.push("No explicit alternatives or tradeoffs formulated");
    return { state: "Almost ready", reasons };
  }

  if (decision.review_date && new Date(decision.review_date).getTime() < Date.now() - 30 * 86400000) {
    reasons.push("Decision record has not been reviewed in over 30 days");
    return { state: "Stale", reasons };
  }

  if (context?.hasEvidence && context.hasAlternatives) {
    reasons.push("Clear alternatives, linked evidence, and evaluated tradeoffs");
    return { state: "Ready", reasons };
  }

  reasons.push("Grounded in available records");
  return { state: "Almost ready", reasons };
}

export function evaluateDecisionImpact(
  decision: { title: string; metadata?: Record<string, unknown> | null },
  context?: { moneyAmount?: number; affectedDomains?: string[]; affectsKeyClient?: boolean }
): { impact: DecisionImpact; dimensions: string[]; reasons: string[] } {
  const dimensions: string[] = [];
  const reasons: string[] = [];
  let score = 0;

  if (context?.moneyAmount && context.moneyAmount >= 20000) {
    score += 40;
    dimensions.push("Cash");
    reasons.push(`Material financial commitment: >20,000 DH`);
  }

  if (context?.affectsKeyClient) {
    score += 30;
    dimensions.push("Client");
    reasons.push("Directly affects major client relationship");
  }

  if (context?.affectedDomains && context.affectedDomains.length >= 2) {
    score += 25;
    dimensions.push("Operations", "Strategy");
    reasons.push(`Downstream effects across ${context.affectedDomains.join(", ")}`);
  }

  let impact: DecisionImpact = "Moderate";
  if (score >= 60) impact = "Critical";
  else if (score >= 35) impact = "High";
  else if (score < 20) impact = "Low";

  if (dimensions.length === 0) dimensions.push("Operations");
  if (reasons.length === 0) reasons.push("Standard operational decision");

  return { impact, dimensions, reasons };
}

export function evaluateDecisionUrgency(
  decision: { review_date?: string | null },
  today = new Date().toISOString().slice(0, 10)
): "no_deadline" | "upcoming" | "due_soon" | "due" | "overdue" {
  if (!decision.review_date) return "no_deadline";
  if (decision.review_date < today) return "overdue";
  if (decision.review_date === today) return "due";
  const diffDays = (new Date(decision.review_date).getTime() - new Date(today).getTime()) / (1000 * 3600 * 24);
  if (diffDays <= 3) return "due_soon";
  return "upcoming";
}

// ============================================================
// 5. What Can Wait & Delegation Candidates
// ============================================================

export function buildCanWaitList(
  signals: ExecutiveSignal[],
  tasks: Array<{ id: string; title: string; priority?: string; due_date?: string | null }> = []
): Array<{ title: string; reason: string; revisitDate?: string }> {
  const waitItems: Array<{ title: string; reason: string; revisitDate?: string }> = [];

  for (const s of signals) {
    if (s.severity === "info" && (!s.moneyAmount || s.moneyAmount === 0)) {
      waitItems.push({
        title: s.title,
        reason: "Low severity observation with no financial or deadline exposure",
      });
    }
  }

  for (const t of tasks) {
    if (t.priority === "low" && !t.due_date) {
      waitItems.push({
        title: t.title,
        reason: "Low priority task with no deadline; can safely be deferred",
      });
    }
  }

  return waitItems.slice(0, 5);
}

export function buildDelegationCandidates(context: {
  people?: Array<{ id: string; name: string; capacity?: number }>;
  processes?: Array<{ id: string; name: string; hasSop?: boolean }>;
  tasks?: Array<{ id: string; title: string; isFounderOnly?: boolean }>;
}): Array<{ taskTitle: string; reason: string; currentOwner?: string; suggestedOwner?: string; sopTitle?: string }> {
  const candidates: Array<{ taskTitle: string; reason: string; currentOwner?: string; suggestedOwner?: string; sopTitle?: string }> = [];

  for (const p of context.processes ?? []) {
    if (p.hasSop) {
      candidates.push({
        taskTitle: `Process Run: ${p.name}`,
        reason: "Documented SOP exists; standard repeatable operation suitable for team delegation",
        sopTitle: p.name,
      });
    }
  }

  return candidates.slice(0, 5);
}

// ============================================================
// 6. Plan vs Reality & Metric Tracking
// ============================================================

export function buildPlanVsReality(context: {
  milestones?: Array<{ title: string; target_date?: string; status: string }>;
  budgets?: Array<{ name: string; currency: string; amount: number; spent?: number }>;
  targets?: Array<{ metric_type: string; target_value: number; actual_value?: number; currency?: string }>;
}): PlanVsRealityItem[] {
  const items: PlanVsRealityItem[] = [];

  for (const m of context.milestones ?? []) {
    items.push({
      domain: "strategy",
      item: m.title,
      planned: m.target_date ?? "Target date",
      actual: m.status,
      variance: m.status === "completed" ? "0 days" : m.status === "at_risk" ? "Slipping" : "On track",
      status: m.status === "completed" ? "on_track" : m.status === "at_risk" ? "slipping" : "on_track",
      reason: m.status === "at_risk" ? "Milestone flagged at risk" : "Progress recorded",
    });
  }

  for (const b of context.budgets ?? []) {
    const spent = b.spent ?? 0;
    const varAmount = b.amount - spent;
    items.push({
      domain: "finance",
      item: `Budget: ${b.name}`,
      planned: `${b.currency} ${b.amount.toLocaleString()}`,
      actual: `${b.currency} ${spent.toLocaleString()}`,
      variance: `${b.currency} ${varAmount.toLocaleString()} remaining`,
      status: varAmount < 0 ? "missed" : "on_track",
      reason: varAmount < 0 ? "Budget exceeded" : "Within budget ceiling",
    });
  }

  return items;
}

export function detectMetricChange(
  current: Record<string, number>,
  previous?: Record<string, number>
): ExecutiveMetricDelta[] {
  const deltas: ExecutiveMetricDelta[] = [];

  for (const [key, val] of Object.entries(current)) {
    const prev = previous ? previous[key] : null;
    const delta = prev != null ? val - prev : null;
    let state: "improving" | "stable" | "worsening" | "insufficient_history" = "insufficient_history";

    if (delta != null) {
      if (delta === 0) state = "stable";
      else if (key.includes("overdue") || key.includes("risk") || key.includes("incident")) {
        state = delta > 0 ? "worsening" : "improving";
      } else {
        state = delta > 0 ? "improving" : "worsening";
      }
    }

    deltas.push({
      name: key.replace(/_/g, " "),
      domain: key.startsWith("cash") || key.startsWith("rec") ? "finance" : "operations",
      current: val,
      previous: prev,
      delta,
      state,
      formattedDelta: delta == null ? "Baseline" : delta > 0 ? `+${delta.toLocaleString()}` : delta.toLocaleString(),
    });
  }

  return deltas;
}

// ============================================================
// 7. Executive Brief Assembly
// ============================================================

export function buildExecutiveBrief(context: {
  signals: ExecutiveSignal[];
  changes: ExecutiveChange[];
  priorities: ExecutivePriority[];
  decisions: DecisionBrief[];
  riskClusters: RiskCluster[];
  oppClusters: OpportunityCluster[];
  canWait: Array<{ title: string; reason: string }>;
}): ExecutiveBrief {
  const priorityCount = context.priorities.length;
  let headline = "All systems operating within normal parameters.";
  let recommendedFocus = "Maintain focus on current sprint commitments.";

  if (priorityCount > 0) {
    headline = `${priorityCount} issue${priorityCount === 1 ? "" : "s"} require executive attention today.`;
    recommendedFocus = `Resolve highest-ranked issue: ${context.priorities[0].title}`;
  }

  return {
    headline,
    priorities: context.priorities,
    topDecision: context.decisions[0] ?? null,
    topRisk: context.riskClusters[0] ?? context.signals.find((s) => s.severity === "critical") ?? null,
    topOpportunity: context.oppClusters[0] ?? null,
    materialChanges: context.changes.slice(0, 3),
    whatCanWait: context.canWait,
    recommendedFocus,
  };
}

// ============================================================
// 8. Foreign Ownership Validation
// ============================================================

export async function validateForeignOwnership(
  client: SupabaseClient,
  userId: string,
  entityType: string,
  entityId: string
): Promise<{ valid: boolean; error?: string }> {
  const tableMap: Record<string, string> = {
    decision: "decisions",
    task: "tasks",
    project: "projects",
    client: "clients",
    invoice: "invoices",
    product: "product_catalog_refs",
    supplier: "supplier_records",
    sop: "operational_sops",
    commitment: "strategic_commitments",
    person: "team_people",
  };

  const table = tableMap[entityType] ?? entityType;
  try {
    const res = await client.from(table).select("id").eq("user_id", userId).eq("id", entityId).maybeSingle();
    if (res.error || !res.data) {
      return { valid: false, error: `Unauthorized or inaccessible ${entityType} ID` };
    }
    return { valid: true };
  } catch (err: unknown) {
    return { valid: false, error: err instanceof Error ? err.message : String(err) };
  }
}

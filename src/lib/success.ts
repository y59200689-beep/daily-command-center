import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================
// Types and Interfaces
// ============================================================

export type AccountHealthState =
  | "healthy"
  | "needs_attention"
  | "at_risk"
  | "critical"
  | "insufficient_data";

export type ChurnRiskState =
  | "low"
  | "watch"
  | "elevated"
  | "high"
  | "unknown";

export type DeliveryHealthState =
  | "on_track"
  | "needs_attention"
  | "at_risk"
  | "blocked"
  | "complete"
  | "unknown";

export type OnboardingHealthState =
  | "not_started"
  | "in_progress"
  | "waiting_on_us"
  | "waiting_on_client"
  | "blocked"
  | "complete"
  | "at_risk"
  | "unknown";

export type ExpansionReadinessState =
  | "ready"
  | "potential"
  | "not_yet"
  | "do_not_pursue"
  | "unknown";

export type ClientEngagementState =
  | "active"
  | "normal"
  | "quiet"
  | "inactive"
  | "unknown";

export type OutcomeStatus =
  | "planned"
  | "in_progress"
  | "at_risk"
  | "achieved"
  | "cancelled"
  | "unknown";

export type SuccessPlanStatus =
  | "draft"
  | "active"
  | "needs_review"
  | "completed"
  | "archived";

export type CommitmentDirection = "we_owe_client" | "client_owes_us";
export type CommitmentStatus = "open" | "completed" | "cancelled" | "unclear";

export type CheckInType =
  | "routine"
  | "success_review"
  | "delivery_review"
  | "renewal"
  | "risk_recovery"
  | "expansion"
  | "executive_review"
  | "other";

export type CheckInStatus = "scheduled" | "completed" | "cancelled" | "rescheduled";

export type SatisfactionSignalType =
  | "positive_feedback"
  | "neutral_feedback"
  | "negative_feedback"
  | "complaint"
  | "praise"
  | "requested_change"
  | "referral"
  | "renewal_intent";

export type ClientRiskType =
  | "delivery_delay"
  | "communication_gap"
  | "quality_issue"
  | "payment_issue"
  | "stakeholder_issue"
  | "unmet_outcome"
  | "renewal_risk"
  | "low_engagement"
  | "scope_mismatch"
  | "dependency"
  | "support_issue"
  | "other";

export type ClientRiskSeverity = "low" | "medium" | "high" | "critical";
export type ClientRiskStatus = "open" | "monitoring" | "mitigating" | "resolved" | "dismissed";

export type RenewalType =
  | "subscription"
  | "retainer"
  | "maintenance"
  | "service_contract"
  | "license"
  | "custom";

export type RenewalStatus =
  | "upcoming"
  | "preparing"
  | "discussing"
  | "renewed"
  | "not_renewing"
  | "deferred"
  | "unknown";

export type RenewalForecastCategory = "committed" | "likely" | "uncertain" | "at_risk";

export interface ClientRecord {
  id: string;
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  status: string;
  notes?: string | null;
  last_contact_at?: string | null;
  next_follow_up_at?: string | null;
  tier?: "standard" | "important" | "strategic" | null;
  created_at?: string;
  updated_at?: string;
}

export interface ClientOutcome {
  id: string;
  client_id: string;
  title: string;
  description?: string | null;
  target_date?: string | null;
  status: OutcomeStatus;
  priority: "low" | "medium" | "high" | "critical";
  success_criteria?: string | null;
  evidence?: string | null;
  completed_at?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ClientSuccessPlan {
  id: string;
  client_id: string;
  title: string;
  period?: string | null;
  objective: string;
  key_outcomes?: string | null;
  risks?: string | null;
  stakeholders?: string | null;
  responsibilities?: string | null;
  review_cadence?: string | null;
  next_review_at?: string | null;
  last_reviewed_at?: string | null;
  status: SuccessPlanStatus;
  created_at?: string;
  updated_at?: string;
}

export interface ClientCommitment {
  id: string;
  client_id: string;
  direction: CommitmentDirection;
  statement: string;
  due_at?: string | null;
  status: CommitmentStatus;
  source_entity_type?: string | null;
  source_entity_id?: string | null;
  completed_at?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ClientCheckIn {
  id: string;
  client_id: string;
  check_in_type: CheckInType;
  scheduled_at?: string | null;
  completed_at?: string | null;
  status: CheckInStatus;
  purpose: string;
  summary?: string | null;
  next_action?: string | null;
  meeting_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ClientSatisfactionSignal {
  id: string;
  client_id: string;
  signal_type: SatisfactionSignalType;
  source: string;
  recorded_at: string;
  summary: string;
  severity?: ClientRiskSeverity | null;
  linked_entity_type?: string | null;
  linked_entity_id?: string | null;
  created_at?: string;
}

export interface ClientRisk {
  id: string;
  client_id: string;
  risk_type: ClientRiskType;
  severity: ClientRiskSeverity;
  description: string;
  evidence?: string | null;
  status: ClientRiskStatus;
  owner_person_id?: string | null;
  mitigation?: string | null;
  review_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ClientRenewal {
  id: string;
  client_id: string;
  service_id?: string | null;
  renewal_date: string;
  renewal_type: RenewalType;
  status: RenewalStatus;
  forecast_category: RenewalForecastCategory;
  value?: number | null;
  currency: string;
  owner_person_id?: string | null;
  preparation_state: "not_started" | "in_progress" | "ready" | "not_needed";
  last_review_at?: string | null;
  next_action?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ClientMilestone {
  id: string;
  client_id: string;
  milestone_type: string;
  title: string;
  achieved_date?: string | null;
  status: "planned" | "achieved" | "missed";
  notes?: string | null;
  evidence?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ClientIssue {
  id: string;
  client_id: string;
  title: string;
  description: string;
  severity: ClientRiskSeverity;
  source?: string | null;
  owner_person_id?: string | null;
  status: "open" | "investigating" | "waiting_on_client" | "waiting_on_us" | "resolved" | "closed";
  opened_at?: string;
  resolved_at?: string | null;
  resolution?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ClientAccountReview {
  id: string;
  client_id: string;
  period: "week" | "month" | "quarter" | "annual";
  health_state: AccountHealthState;
  wins?: string | null;
  risks?: string | null;
  open_commitments_count?: number;
  outcomes_summary?: string | null;
  renewal_status?: string | null;
  expansion_readiness?: ExpansionReadinessState | null;
  next_actions?: string | null;
  reviewed_at: string;
  created_at?: string;
}

export interface ClientRecoveryPlan {
  id: string;
  client_id: string;
  risk_summary: string;
  target_state: string;
  actions: string;
  owner_person_id?: string | null;
  review_date?: string | null;
  status: "draft" | "active" | "monitoring" | "resolved" | "archived";
  created_at?: string;
  updated_at?: string;
}

export interface ClientWaitingItem {
  id: string;
  client_id: string;
  client_name: string;
  what: string;
  direction: "waiting_on_us" | "waiting_on_client";
  since: string;
  due?: string | null;
  owner_label?: string | null;
  reason: string;
  route: string;
  is_overdue: boolean;
}

export interface NextCustomerSuccessAction {
  action: string;
  priority: number;
  client_id: string;
  client_name: string;
  reason: string;
  badge: "critical" | "warning" | "info";
  direct_route: string;
  affected_entities?: Array<{ type: string; id: string; title: string }>;
}

export interface AccountHealthResult {
  state: AccountHealthState;
  positiveReasons: string[];
  negativeReasons: string[];
  summary: string;
  nextSuggestedStep: string;
}

export interface ChurnRiskResult {
  state: ChurnRiskState;
  reasons: string[];
  mitigatingFactors: string[];
  summary: string;
}

// ============================================================
// 1. evaluateAccountHealth
// ============================================================
export function evaluateAccountHealth(
  client: ClientRecord,
  outcomes: ClientOutcome[] = [],
  risks: ClientRisk[] = [],
  renewals: ClientRenewal[] = [],
  issues: ClientIssue[] = [],
  commitments: ClientCommitment[] = [],
  projects: Array<{ id: string; status: string; name?: string }> = [],
  runs: Array<{ id: string; status: string; title?: string }> = [],
  signals: ClientSatisfactionSignal[] = [],
  lastContactAt?: string | null,
  nowIso = new Date().toISOString()
): AccountHealthResult {
  const todayStr = nowIso.slice(0, 10);
  const positiveReasons: string[] = [];
  const negativeReasons: string[] = [];

  // Critical issues
  const criticalIssues = issues.filter(
    (i) => ["open", "investigating", "waiting_on_us"].includes(i.status) && i.severity === "critical"
  );
  if (criticalIssues.length > 0) {
    negativeReasons.push(`${criticalIssues.length} critical client issue(s) unresolved.`);
  }

  // Active critical risks
  const criticalRisks = risks.filter(
    (r) => ["open", "monitoring", "mitigating"].includes(r.status) && r.severity === "critical"
  );
  if (criticalRisks.length > 0) {
    negativeReasons.push(`${criticalRisks.length} critical active risk(s) recorded.`);
  }

  // Delivery blockers
  const blockedProjects = projects.filter((p) => p.status === "blocked");
  const blockedRuns = runs.filter((r) => r.status === "blocked");
  if (blockedProjects.length > 0 || blockedRuns.length > 0) {
    negativeReasons.push(
      `Delivery blocked on ${blockedProjects.length + blockedRuns.length} project/process run(s).`
    );
  }

  // Overdue promises we made to client
  const overdueOurCommitments = commitments.filter(
    (c) => c.direction === "we_owe_client" && c.status === "open" && c.due_at && c.due_at.slice(0, 10) < todayStr
  );
  if (overdueOurCommitments.length > 0) {
    negativeReasons.push(`${overdueOurCommitments.length} overdue deliverable/commitment(s) owed to client.`);
  }

  // Imminent renewal without prep
  const upcomingRenewals = renewals.filter(
    (r) => ["upcoming", "preparing"].includes(r.status) && r.renewal_date && r.renewal_date <= todayStr
  );
  const unpreparedRenewals = upcomingRenewals.filter((r) => r.preparation_state === "not_started");
  if (unpreparedRenewals.length > 0) {
    negativeReasons.push(`Renewal date reached with no preparation started.`);
  }

  // Negative satisfaction feedback
  const recentNegative = signals.filter(
    (s) => ["negative_feedback", "complaint"].includes(s.signal_type)
  );
  if (recentNegative.length > 0) {
    negativeReasons.push(`${recentNegative.length} negative feedback/complaint signal(s) on record.`);
  }

  // Interaction recency
  const contactDate = lastContactAt || client.last_contact_at;
  if (contactDate) {
    const daysSince = Math.floor(
      (new Date(nowIso).getTime() - new Date(contactDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    const threshold = client.tier === "strategic" ? 21 : 45;
    if (daysSince > threshold) {
      negativeReasons.push(`No recorded interaction for ${daysSince} days (threshold: ${threshold}d).`);
    }
  }

  // Positive signals
  const achievedOutcomes = outcomes.filter((o) => o.status === "achieved");
  if (achievedOutcomes.length > 0) {
    positiveReasons.push(`${achievedOutcomes.length} documented outcome(s) achieved.`);
  }

  const positiveSignals = signals.filter(
    (s) => ["positive_feedback", "praise", "referral", "renewal_intent"].includes(s.signal_type)
  );
  if (positiveSignals.length > 0) {
    positiveReasons.push(`${positiveSignals.length} recorded positive feedback/referral signal(s).`);
  }

  const resolvedIssues = issues.filter((i) => i.status === "resolved" || i.status === "closed");
  if (resolvedIssues.length > 0) {
    positiveReasons.push(`${resolvedIssues.length} client issue(s) successfully resolved.`);
  }

  const activeProjects = projects.filter((p) => ["in_progress", "active"].includes(p.status));
  if (activeProjects.length > 0 && blockedProjects.length === 0) {
    positiveReasons.push(`${activeProjects.length} delivery project(s) actively progressing.`);
  }

  // Determine State
  let state: AccountHealthState = "healthy";

  if (
    outcomes.length === 0 &&
    projects.length === 0 &&
    risks.length === 0 &&
    issues.length === 0 &&
    commitments.length === 0 &&
    !contactDate
  ) {
    state = "insufficient_data";
    return {
      state,
      positiveReasons,
      negativeReasons,
      summary: "Insufficient operational signals recorded for this account.",
      nextSuggestedStep: "Establish first success plan, outcomes, or schedule an onboarding check-in.",
    };
  }

  if (criticalIssues.length > 0 || criticalRisks.length > 0 || (blockedProjects.length > 0 && unpreparedRenewals.length > 0)) {
    state = "critical";
  } else if (negativeReasons.length >= 2 || blockedProjects.length > 0 || overdueOurCommitments.length > 0) {
    state = "at_risk";
  } else if (negativeReasons.length === 1) {
    state = "needs_attention";
  } else {
    state = "healthy";
  }

  const summary =
    state === "critical"
      ? "Account requires immediate executive recovery intervention."
      : state === "at_risk"
      ? "Account has multiple active risk factors that may impair retention."
      : state === "needs_attention"
      ? "Account is largely functional but has one unaddressed friction point."
      : "Account is healthy with verified delivery progress and positive engagement.";

  const nextSuggestedStep =
    state === "critical"
      ? "Formulate a recovery plan and schedule an executive alignment call."
      : state === "at_risk"
      ? "Clear delivery blockers and review open client commitments."
      : state === "needs_attention"
      ? "Address pending feedback or schedule a milestone check-in."
      : "Confirm outcome achievement evidence and assess expansion readiness.";

  return { state, positiveReasons, negativeReasons, summary, nextSuggestedStep };
}

// ============================================================
// 2. evaluateChurnRisk
// ============================================================
export function evaluateChurnRisk(
  client: ClientRecord,
  healthState: AccountHealthState,
  risks: ClientRisk[] = [],
  issues: ClientIssue[] = [],
  renewals: ClientRenewal[] = [],
  signals: ClientSatisfactionSignal[] = [],
  daysSinceInteraction?: number | null
): ChurnRiskResult {
  const reasons: string[] = [];
  const mitigatingFactors: string[] = [];

  const openCriticalIssues = issues.filter(
    (i) => ["open", "investigating"].includes(i.status) && (i.severity === "critical" || i.severity === "high")
  );
  if (openCriticalIssues.length > 0) {
    reasons.push(`${openCriticalIssues.length} unresolved high/critical issue(s).`);
  }

  const openRenewalRisks = risks.filter(
    (r) => ["open", "mitigating"].includes(r.status) && (r.risk_type === "renewal_risk" || r.severity === "critical")
  );
  if (openRenewalRisks.length > 0) {
    reasons.push(`${openRenewalRisks.length} active renewal/critical risk(s) recorded.`);
  }

  const notRenewingOrAtRisk = renewals.filter(
    (r) => r.status === "not_renewing" || r.forecast_category === "at_risk"
  );
  if (notRenewingOrAtRisk.length > 0) {
    reasons.push("Explicit indication of non-renewal or at-risk forecast category.");
  }

  const complaints = signals.filter((s) => s.signal_type === "complaint" || s.signal_type === "negative_feedback");
  if (complaints.length > 0) {
    reasons.push(`${complaints.length} explicit negative feedback/complaint signal(s).`);
  }

  if (typeof daysSinceInteraction === "number" && daysSinceInteraction > 60) {
    reasons.push(`Extended silence: ${daysSinceInteraction} days without recorded contact.`);
  }

  // Mitigating factors
  const renewalsCommitted = renewals.filter((r) => r.status === "renewed" || r.forecast_category === "committed");
  if (renewalsCommitted.length > 0) {
    mitigatingFactors.push("Renewal confirmed or formally committed.");
  }

  const positivePraise = signals.filter((s) => s.signal_type === "praise" || s.signal_type === "renewal_intent");
  if (positivePraise.length > 0) {
    mitigatingFactors.push("Documented praise or renewal intent recorded.");
  }

  if (healthState === "insufficient_data") {
    return {
      state: "unknown",
      reasons: ["Insufficient data points to evaluate churn risk."],
      mitigatingFactors: [],
      summary: "Churn risk cannot be evaluated without operational history.",
    };
  }

  let state: ChurnRiskState = "low";

  // Require multiple corroborating signals for High
  if (notRenewingOrAtRisk.length > 0 || (reasons.length >= 3 && mitigatingFactors.length === 0)) {
    state = "high";
  } else if (reasons.length >= 2 || (reasons.length === 1 && healthState === "critical")) {
    state = "elevated";
  } else if (reasons.length === 1 || healthState === "needs_attention") {
    state = "watch";
  } else {
    state = "low";
  }

  const summary =
    state === "high"
      ? "Account exhibits severe corroborating churn signals."
      : state === "elevated"
      ? "Account has notable churn vulnerability requiring mitigation."
      : state === "watch"
      ? "Account should be monitored closely."
      : "Low churn risk based on active delivery and positive signals.";

  return { state, reasons, mitigatingFactors, summary };
}

// ============================================================
// 3. evaluateDeliveryHealth
// ============================================================
export function evaluateDeliveryHealth(
  projects: Array<{ id: string; status: string; progress?: number }> = [],
  tasks: Array<{ id: string; status: string; priority?: string }> = [],
  runs: Array<{ id: string; status: string }> = [],
  qualityIncidents: Array<{ id: string; status: string; severity: string }> = []
): { state: DeliveryHealthState; reasons: string[] } {
  if (projects.length === 0 && tasks.length === 0 && runs.length === 0) {
    return { state: "unknown", reasons: ["No delivery projects or process runs linked to client."] };
  }

  const reasons: string[] = [];

  const blockedRuns = runs.filter((r) => r.status === "blocked");
  const blockedProjects = projects.filter((p) => p.status === "blocked");
  if (blockedRuns.length > 0 || blockedProjects.length > 0) {
    reasons.push(`${blockedProjects.length + blockedRuns.length} item(s) currently blocked.`);
    return { state: "blocked", reasons };
  }

  const openCriticalQuality = qualityIncidents.filter(
    (q) => q.status !== "resolved" && (q.severity === "critical" || q.severity === "high")
  );
  if (openCriticalQuality.length > 0) {
    reasons.push(`${openCriticalQuality.length} unresolved quality incident(s).`);
  }

  const overdueTasks = tasks.filter((t) => t.status === "in_progress" && (t.priority === "high" || t.priority === "urgent"));
  if (overdueTasks.length > 0) {
    reasons.push(`${overdueTasks.length} high-priority delivery task(s) open.`);
  }

  if (openCriticalQuality.length > 0) {
    return { state: "at_risk", reasons };
  }

  if (reasons.length > 0) {
    return { state: "needs_attention", reasons };
  }

  const allCompleted =
    projects.every((p) => ["completed", "delivered", "done"].includes(p.status)) &&
    runs.every((r) => r.status === "completed");

  if (allCompleted && (projects.length > 0 || runs.length > 0)) {
    return { state: "complete", reasons: ["All linked delivery projects and operational runs completed."] };
  }

  return { state: "on_track", reasons: ["Delivery progressing without reported blockers or quality incidents."] };
}

// ============================================================
// 4. evaluateOnboardingHealth
// ============================================================
export function evaluateOnboardingHealth(
  runs: Array<{ id: string; status: string; title?: string }> = [],
  commitments: ClientCommitment[] = [],
  milestones: ClientMilestone[] = []
): { state: OnboardingHealthState; reasons: string[] } {
  const onboardingMilestone = milestones.find((m) => m.milestone_type === "onboarding_completed");
  if (onboardingMilestone?.status === "achieved") {
    return { state: "complete", reasons: ["Client onboarding milestone achieved."] };
  }

  if (runs.length === 0 && commitments.length === 0) {
    return { state: "not_started", reasons: ["No onboarding run or initial commitments recorded."] };
  }

  const reasons: string[] = [];
  const blockedRun = runs.find((r) => r.status === "blocked");
  if (blockedRun) {
    return { state: "blocked", reasons: [`Onboarding process run "${blockedRun.title || "Onboarding"}" is blocked.`] };
  }

  const waitingOnClientCommitments = commitments.filter(
    (c) => c.direction === "client_owes_us" && c.status === "open"
  );
  if (waitingOnClientCommitments.length > 0) {
    reasons.push(`Awaiting ${waitingOnClientCommitments.length} required prerequisite(s) from client.`);
    return { state: "waiting_on_client", reasons };
  }

  const waitingOnUsCommitments = commitments.filter(
    (c) => c.direction === "we_owe_client" && c.status === "open"
  );
  if (waitingOnUsCommitments.length > 0) {
    reasons.push(`Team has ${waitingOnUsCommitments.length} setup action(s) to deliver.`);
    return { state: "waiting_on_us", reasons };
  }

  const activeRun = runs.find((r) => ["in_progress", "ready"].includes(r.status));
  if (activeRun) {
    return { state: "in_progress", reasons: ["Onboarding process execution is active."] };
  }

  return { state: "in_progress", reasons: ["Onboarding is progressing."] };
}

// ============================================================
// 5. evaluateExpansionReadiness
// ============================================================
export function evaluateExpansionReadiness(
  healthState: AccountHealthState,
  outcomes: ClientOutcome[] = [],
  deliveryState: DeliveryHealthState = "on_track",
  openIssuesCount = 0,
  growthCandidatesCount = 0
): { state: ExpansionReadinessState; reasons: string[] } {
  const reasons: string[] = [];

  if (healthState === "critical" || healthState === "at_risk" || openIssuesCount > 0) {
    return {
      state: "do_not_pursue",
      reasons: ["Relationship has active issues or elevated account risk. Stabilize delivery before discussing expansion."],
    };
  }

  const achieved = outcomes.filter((o) => o.status === "achieved").length;

  if (healthState === "healthy" && achieved > 0 && ["on_track", "complete"].includes(deliveryState)) {
    reasons.push(`Account is healthy with ${achieved} verified outcome(s) achieved.`);
    if (growthCandidatesCount > 0) {
      reasons.push(`${growthCandidatesCount} V10 expansion candidate(s) identified.`);
    }
    return { state: "ready", reasons };
  }

  if (healthState === "healthy" || growthCandidatesCount > 0) {
    return {
      state: "potential",
      reasons: ["Account is stable. Await completion of initial milestone before opening formal expansion discussion."],
    };
  }

  return {
    state: "not_yet",
    reasons: ["Baseline delivery in progress. Focus on establishing initial outcome success."],
  };
}

// ============================================================
// 6. evaluateClientEngagement
// ============================================================
export function evaluateClientEngagement(
  lastContactAt?: string | null,
  tier: "standard" | "important" | "strategic" = "standard",
  recentActivitiesCount = 0,
  nowIso = new Date().toISOString()
): { state: ClientEngagementState; daysSince: number | null; summary: string } {
  if (!lastContactAt) {
    return {
      state: "unknown",
      daysSince: null,
      summary: "No recorded interaction timestamp found.",
    };
  }

  const daysSince = Math.floor(
    (new Date(nowIso).getTime() - new Date(lastContactAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  const quietThreshold = tier === "strategic" ? 21 : 45;
  const inactiveThreshold = tier === "strategic" ? 45 : 90;

  if (daysSince > inactiveThreshold) {
    return {
      state: "inactive",
      daysSince,
      summary: `Inactive: ${daysSince} days since last interaction (threshold: ${inactiveThreshold}d).`,
    };
  }

  if (daysSince > quietThreshold) {
    return {
      state: "quiet",
      daysSince,
      summary: `Quiet: ${daysSince} days since last interaction (threshold: ${quietThreshold}d).`,
    };
  }

  if (recentActivitiesCount >= 3 || daysSince <= 7) {
    return {
      state: "active",
      daysSince,
      summary: `Active: Interacted ${daysSince} days ago with steady recent communication.`,
    };
  }

  return {
    state: "normal",
    daysSince,
    summary: `Normal: Interacted ${daysSince} days ago within standard relationship window.`,
  };
}

// ============================================================
// 7. rankNextCustomerSuccessAction
// ============================================================
export function rankNextCustomerSuccessAction(
  clients: ClientRecord[] = [],
  outcomes: ClientOutcome[] = [],
  risks: ClientRisk[] = [],
  renewals: ClientRenewal[] = [],
  issues: ClientIssue[] = [],
  commitments: ClientCommitment[] = [],
  waitingList: ClientWaitingItem[] = [],
  nowIso = new Date().toISOString()
): NextCustomerSuccessAction | null {
  const clientMap = new Map(clients.map((c) => [c.id, c]));
  const todayStr = nowIso.slice(0, 10);
  const twoWeeksOut = new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10);

  // 1. Critical open client issue
  const criticalIssue = issues.find(
    (i) => ["open", "investigating", "waiting_on_us"].includes(i.status) && i.severity === "critical"
  );
  if (criticalIssue) {
    const c = clientMap.get(criticalIssue.client_id);
    return {
      action: `Resolve critical issue: ${criticalIssue.title}`,
      priority: 100,
      client_id: criticalIssue.client_id,
      client_name: c?.name ?? "Client",
      reason: "Critical client-facing issue is blocking value delivery.",
      badge: "critical",
      direct_route: `/success/clients/${criticalIssue.client_id}`,
      affected_entities: [{ type: "client_issue", id: criticalIssue.id, title: criticalIssue.title }],
    };
  }

  // 2. Critical active risk
  const criticalRisk = risks.find(
    (r) => ["open", "mitigating"].includes(r.status) && r.severity === "critical"
  );
  if (criticalRisk) {
    const c = clientMap.get(criticalRisk.client_id);
    return {
      action: `Mitigate critical risk: ${criticalRisk.description.slice(0, 45)}`,
      priority: 95,
      client_id: criticalRisk.client_id,
      client_name: c?.name ?? "Client",
      reason: "A critical customer success risk requires mitigation.",
      badge: "critical",
      direct_route: `/success/risks`,
      affected_entities: [{ type: "client_risk", id: criticalRisk.id, title: criticalRisk.description }],
    };
  }

  // 3. Imminent renewal without preparation
  const imminentRenewal = renewals.find(
    (r) =>
      ["upcoming", "preparing"].includes(r.status) &&
      r.renewal_date <= twoWeeksOut &&
      r.preparation_state === "not_started"
  );
  if (imminentRenewal) {
    const c = clientMap.get(imminentRenewal.client_id);
    return {
      action: `Prepare renewal review for ${c?.name ?? "client"}`,
      priority: 90,
      client_id: imminentRenewal.client_id,
      client_name: c?.name ?? "Client",
      reason: `Renewal scheduled on ${imminentRenewal.renewal_date} has no preparation started.`,
      badge: "warning",
      direct_route: `/success/renewals`,
      affected_entities: [{ type: "client_renewal", id: imminentRenewal.id, title: `Renewal ${imminentRenewal.renewal_date}` }],
    };
  }

  // 4. Overdue deliverable owed to client
  const overdueCommitment = commitments.find(
    (c) =>
      c.direction === "we_owe_client" &&
      c.status === "open" &&
      c.due_at &&
      c.due_at.slice(0, 10) < todayStr
  );
  if (overdueCommitment) {
    const c = clientMap.get(overdueCommitment.client_id);
    return {
      action: `Deliver overdue commitment: ${overdueCommitment.statement.slice(0, 45)}`,
      priority: 85,
      client_id: overdueCommitment.client_id,
      client_name: c?.name ?? "Client",
      reason: `Commitment was due on ${overdueCommitment.due_at?.slice(0, 10)}.`,
      badge: "warning",
      direct_route: `/success/clients/${overdueCommitment.client_id}`,
      affected_entities: [{ type: "client_commitment", id: overdueCommitment.id, title: overdueCommitment.statement }],
    };
  }

  // 5. Overdue client waiting on us
  const overdueWait = waitingList.find((w) => w.direction === "waiting_on_us" && w.is_overdue);
  if (overdueWait) {
    return {
      action: `Respond to: ${overdueWait.what}`,
      priority: 80,
      client_id: overdueWait.client_id,
      client_name: overdueWait.client_name,
      reason: `Client has been blocked waiting for internal action since ${overdueWait.since}.`,
      badge: "warning",
      direct_route: overdueWait.route,
    };
  }

  // 6. Outcome at risk
  const outcomeAtRisk = outcomes.find((o) => o.status === "at_risk");
  if (outcomeAtRisk) {
    const c = clientMap.get(outcomeAtRisk.client_id);
    return {
      action: `Review at-risk outcome: ${outcomeAtRisk.title}`,
      priority: 75,
      client_id: outcomeAtRisk.client_id,
      client_name: c?.name ?? "Client",
      reason: "Client success outcome has slipped into at-risk status.",
      badge: "warning",
      direct_route: `/success/clients/${outcomeAtRisk.client_id}`,
      affected_entities: [{ type: "client_outcome", id: outcomeAtRisk.id, title: outcomeAtRisk.title }],
    };
  }

  // 7. Quiet strategic client
  for (const client of clients.filter((c) => c.tier === "strategic" && c.status === "active")) {
    if (client.last_contact_at) {
      const daysSince = Math.floor(
        (new Date(nowIso).getTime() - new Date(client.last_contact_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSince > 21) {
        return {
          action: `Schedule relationship check-in with ${client.name}`,
          priority: 70,
          client_id: client.id,
          client_name: client.name,
          reason: `Strategic client has had no recorded contact for ${daysSince} days.`,
          badge: "info",
          direct_route: `/success/check-ins`,
        };
      }
    }
  }

  return null;
}

// ============================================================
// 8. buildClientWaitingState
// ============================================================
export function buildClientWaitingState(
  clients: ClientRecord[] = [],
  commitments: ClientCommitment[] = [],
  tasks: Array<{ id: string; client_id?: string | null; title: string; waiting_for?: string | null; status: string; due_date?: string | null; created_at: string }> = [],
  waitingItems: Array<{ id: string; client_id?: string | null; title: string; status: string; requested_at: string; expected_by?: string | null }> = [],
  approvals: Array<{ id: string; client_id?: string | null; title: string; status: string; created_at: string }> = [],
  nowIso = new Date().toISOString()
): { waitingOnUs: ClientWaitingItem[]; waitingOnClient: ClientWaitingItem[] } {
  const clientMap = new Map(clients.map((c) => [c.id, c]));
  const todayStr = nowIso.slice(0, 10);
  const waitingOnUs: ClientWaitingItem[] = [];
  const waitingOnClient: ClientWaitingItem[] = [];

  // Commitments: we_owe_client -> waiting on us
  for (const c of commitments.filter((item) => item.status === "open")) {
    const client = clientMap.get(c.client_id);
    const isOverdue = Boolean(c.due_at && c.due_at.slice(0, 10) < todayStr);

    if (c.direction === "we_owe_client") {
      waitingOnUs.push({
        id: `wait:comm:us:${c.id}`,
        client_id: c.client_id,
        client_name: client?.name ?? "Client",
        what: c.statement,
        direction: "waiting_on_us",
        since: c.created_at?.slice(0, 10) ?? todayStr,
        due: c.due_at?.slice(0, 10) ?? null,
        reason: "Promised deliverable or action owed to client.",
        route: `/success/clients/${c.client_id}`,
        is_overdue: isOverdue,
      });
    } else {
      waitingOnClient.push({
        id: `wait:comm:client:${c.id}`,
        client_id: c.client_id,
        client_name: client?.name ?? "Client",
        what: c.statement,
        direction: "waiting_on_client",
        since: c.created_at?.slice(0, 10) ?? todayStr,
        due: c.due_at?.slice(0, 10) ?? null,
        reason: "Prerequisite or decision requested from client.",
        route: `/success/clients/${c.client_id}`,
        is_overdue: isOverdue,
      });
    }
  }

  // Waiting items from V1 waiting_items table
  for (const w of waitingItems.filter((item) => item.status === "waiting" && item.client_id)) {
    const client = clientMap.get(w.client_id!);
    const isOverdue = Boolean(w.expected_by && w.expected_by.slice(0, 10) < todayStr);

    waitingOnClient.push({
      id: `wait:item:${w.id}`,
      client_id: w.client_id!,
      client_name: client?.name ?? "Client",
      what: w.title,
      direction: "waiting_on_client",
      since: w.requested_at?.slice(0, 10) ?? todayStr,
      due: w.expected_by?.slice(0, 10) ?? null,
      reason: "External dependency awaiting client input.",
      route: `/success/clients/${w.client_id}`,
      is_overdue: isOverdue,
    });
  }

  // Tasks waiting on client input
  for (const t of tasks.filter((item) => item.status !== "done" && item.client_id && item.waiting_for)) {
    const client = clientMap.get(t.client_id!);
    const isOverdue = Boolean(t.due_date && t.due_date.slice(0, 10) < todayStr);

    waitingOnClient.push({
      id: `wait:task:${t.id}`,
      client_id: t.client_id!,
      client_name: client?.name ?? "Client",
      what: `${t.title} (${t.waiting_for})`,
      direction: "waiting_on_client",
      since: t.created_at?.slice(0, 10) ?? todayStr,
      due: t.due_date?.slice(0, 10) ?? null,
      reason: `Task waiting on client: ${t.waiting_for}`,
      route: `/success/clients/${t.client_id}`,
      is_overdue: isOverdue,
    });
  }

  // Approvals: client-linked pending approvals -> waiting on us
  for (const a of approvals.filter((item) => item.status === "pending" && item.client_id)) {
    const client = clientMap.get(a.client_id!);
    waitingOnUs.push({
      id: `wait:app:${a.id}`,
      client_id: a.client_id!,
      client_name: client?.name ?? "Client",
      what: `Owner approval: ${a.title}`,
      direction: "waiting_on_us",
      since: a.created_at?.slice(0, 10) ?? todayStr,
      reason: "Requires owner approval decision before client work can proceed.",
      route: `/approvals`,
      is_overdue: false,
    });
  }

  return { waitingOnUs, waitingOnClient };
}

// ============================================================
// 9. evaluateRenewalReadiness
// ============================================================
export function evaluateRenewalReadiness(
  renewal: ClientRenewal,
  healthState: AccountHealthState = "healthy",
  outcomesCount = 0,
  nowIso = new Date().toISOString()
): {
  isUrgent: boolean;
  needsPreparation: boolean;
  suggestedAction: string;
  daysUntil: number;
} {
  const daysUntil = Math.floor(
    (new Date(renewal.renewal_date).getTime() - new Date(nowIso).getTime()) / (1000 * 60 * 60 * 24)
  );

  const isUrgent = daysUntil <= 30 && ["upcoming", "preparing"].includes(renewal.status);
  const needsPreparation = daysUntil <= 45 && renewal.preparation_state === "not_started";

  let suggestedAction = "Monitor renewal cadence.";

  if (healthState === "critical" || healthState === "at_risk") {
    suggestedAction = "Address delivery issues and client friction before discussing contract terms.";
  } else if (daysUntil <= 14 && renewal.preparation_state === "not_started") {
    suggestedAction = "Prepare renewal options and schedule contract review immediately.";
  } else if (needsPreparation) {
    suggestedAction = outcomesCount > 0
      ? "Review documented outcomes and assemble renewal proposal options."
      : "Document delivered value and assemble renewal proposal options.";
  } else if (renewal.status === "discussing") {
    suggestedAction = "Follow up on client feedback to finalize terms.";
  }

  return { isUrgent, needsPreparation, suggestedAction, daysUntil };
}

// ============================================================
// 10. buildRetentionReview
// ============================================================
export function buildRetentionReview(
  clients: ClientRecord[] = [],
  renewals: ClientRenewal[] = [],
  risks: ClientRisk[] = [],
  outcomes: ClientOutcome[] = [],
  issues: ClientIssue[] = [],
  commitments: ClientCommitment[] = [],
  period: "week" | "month" = "week"
) {
  const activeClients = clients.filter((c) => c.status === "active");
  const openRisks = risks.filter((r) => ["open", "monitoring", "mitigating"].includes(r.status));
  const openIssues = issues.filter((i) => ["open", "investigating", "waiting_on_us"].includes(i.status));
  const achievedOutcomes = outcomes.filter((o) => o.status === "achieved");
  const upcomingRenewals = renewals.filter((r) => ["upcoming", "preparing", "discussing"].includes(r.status));
  const renewedContracts = renewals.filter((r) => r.status === "renewed");

  // Currency totals
  const upcomingByCurrency: Record<string, number> = {};
  for (const r of upcomingRenewals) {
    if (r.value) {
      upcomingByCurrency[r.currency] = (upcomingByCurrency[r.currency] ?? 0) + Number(r.value);
    }
  }

  const renewedByCurrency: Record<string, number> = {};
  for (const r of renewedContracts) {
    if (r.value) {
      renewedByCurrency[r.currency] = (renewedByCurrency[r.currency] ?? 0) + Number(r.value);
    }
  }

  return {
    period,
    metrics: {
      totalClients: activeClients.length,
      openRisksCount: openRisks.length,
      criticalRisksCount: openRisks.filter((r) => r.severity === "critical").length,
      openIssuesCount: openIssues.length,
      achievedOutcomesCount: achievedOutcomes.length,
      upcomingRenewalsCount: upcomingRenewals.length,
      renewedCount: renewedContracts.length,
      openCommitmentsCount: commitments.filter((c) => c.status === "open").length,
      upcomingRenewalValueByCurrency: upcomingByCurrency,
      renewedValueByCurrency: renewedByCurrency,
    },
    topRisks: openRisks.slice(0, 10),
    topIssues: openIssues.slice(0, 10),
    upcomingRenewals: upcomingRenewals.slice(0, 10),
  };
}

// ============================================================
// 11. validateForeignOwnership
// ============================================================
export async function validateForeignOwnership(
  client: SupabaseClient,
  userId: string,
  entityType: string,
  entityId: string
): Promise<boolean> {
  const allowedEntities: Record<string, { table: string; idCol: string }> = {
    client: { table: "clients", idCol: "id" },
    project: { table: "projects", idCol: "id" },
    task: { table: "tasks", idCol: "id" },
    invoice: { table: "invoices", idCol: "id" },
    service: { table: "services", idCol: "id" },
    opportunity: { table: "opportunities", idCol: "id" },
    campaign: { table: "campaigns", idCol: "id" },
    process: { table: "process_templates", idCol: "id" },
    process_run: { table: "process_runs", idCol: "id" },
    quality_incident: { table: "quality_incidents", idCol: "id" },
    person: { table: "team_people", idCol: "id" },
    responsibility: { table: "team_responsibilities", idCol: "id" },
    research_topic: { table: "knowledge_topics", idCol: "id" },
    strategic_commitment: { table: "strategic_commitments", idCol: "id" },
    calendar_event: { table: "calendar_events", idCol: "id" },
    note: { table: "notes", idCol: "id" },
    file: { table: "attachments", idCol: "id" },
    client_outcome: { table: "client_outcomes", idCol: "id" },
  };

  const config = allowedEntities[entityType];
  if (!config) return false;

  try {
    const { data, error } = await client
      .from(config.table)
      .select(config.idCol)
      .eq(config.idCol, entityId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) return false;
    return true;
  } catch {
    return false;
  }
}

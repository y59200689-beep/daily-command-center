import type { SupabaseClient } from "@supabase/supabase-js";

export type SopStatus = "draft" | "active" | "needs_review" | "deprecated" | "archived";
export type SopCriticality = "low" | "medium" | "high" | "critical";
export type SopStepType = "action" | "check" | "decision" | "approval" | "reference" | "wait" | "manual_entry" | "other";
export type ProcessStatus = "draft" | "active" | "paused" | "archived";
export type RunStatus = "planned" | "ready" | "in_progress" | "blocked" | "needs_review" | "completed" | "failed" | "cancelled";
export type FailureType = "human_error" | "missing_information" | "dependency_unavailable" | "tool_failure" | "integration_failure" | "quality_failure" | "timing" | "approval_blocked" | "external_dependency" | "unknown" | "other";
export type QualityCheckStatus = "pass" | "fail" | "needs_review" | "not_applicable";
export type IncidentStatus = "open" | "investigating" | "corrective_action" | "monitoring" | "resolved" | "archived";
export type SystemStatus = "active" | "degraded" | "unavailable" | "deprecated" | "unknown";
export type ImprovementStatus = "idea" | "reviewing" | "approved" | "testing" | "adopted" | "rejected" | "archived";
export type DependencyState = "ready" | "waiting" | "blocked" | "unavailable" | "unknown";
export type SopReviewState = "Current" | "Review soon" | "Review due" | "Overdue review" | "No review rule";
export type ProcessHealthState = "Healthy" | "Needs attention" | "At risk" | "Unhealthy" | "Insufficient history";

export interface SopInput {
  id: string;
  title: string;
  purpose?: string | null;
  status: SopStatus;
  category?: string | null;
  criticality?: SopCriticality;
  review_cadence?: string | null;
  last_reviewed_at?: string | null;
  next_review_at?: string | null;
  current_version?: number;
}

export interface SopStepInput {
  id: string;
  sop_id: string;
  position: number;
  title: string;
  instructions?: string | null;
  required: boolean;
  step_type: SopStepType;
  estimated_minutes?: number | null;
  linked_tool_or_system?: string | null;
}

export interface RunChecklistItemInput {
  id: string;
  run_id: string;
  label: string;
  required: boolean;
  position: number;
  completed: boolean;
  evidence_required?: boolean;
  evidence_text?: string | null;
}

export interface ProcessRunInput {
  id: string;
  title: string;
  status: RunStatus;
  priority: SopCriticality;
  process_template_id?: string | null;
  sop_id?: string | null;
  sop_version_number?: number | null;
  started_at?: string | null;
  due_at?: string | null;
  completed_at?: string | null;
  failure_reason?: string | null;
  step_progress?: Array<{ step_id: string; status: "completed" | "skipped" | "pending"; notes?: string }>;
  completion_override?: boolean;
  completion_override_reason?: string | null;
  process_templates?: { name: string; criticality?: SopCriticality } | null;
}

export interface BlockerInput {
  id: string;
  run_id: string;
  description: string;
  severity: SopCriticality;
  blocked_since: string;
  resolved_at?: string | null;
  process_runs?: { title: string; priority: SopCriticality } | null;
}

export interface FailureInput {
  id: string;
  run_id: string;
  step_id?: string | null;
  failure_type: FailureType;
  description: string;
  severity: SopCriticality;
  detected_at: string;
  resolved_at?: string | null;
}

export interface QualityIncidentInput {
  id: string;
  title: string;
  description: string;
  severity: SopCriticality;
  status: IncidentStatus;
  detected_at: string;
  resolved_at?: string | null;
  run_id?: string | null;
  sop_id?: string | null;
}

export interface QualityExecutionInput {
  id: string;
  run_id: string;
  quality_check_id: string;
  status: QualityCheckStatus;
  quality_checks?: { name: string; required?: boolean; severity_if_failed?: SopCriticality } | null;
}

export interface NextOperationalMove {
  action: string;
  priority: SopCriticality;
  reason: string;
  affectedProcessOrEntity: string;
  route: string;
  score: number;
}

/**
 * Deterministic ranking for Next Operational Move without AI.
 * Ranks by urgency, criticality, blockers, and failure severity.
 */
export function rankNextOperationalMove(
  runs: ProcessRunInput[],
  sops: SopInput[],
  incidents: QualityIncidentInput[],
  blockers: BlockerInput[],
  today = new Date().toISOString().slice(0, 10)
): NextOperationalMove | null {
  const candidates: NextOperationalMove[] = [];

  // 1. Critical failed runs
  for (const run of runs) {
    if (run.status === "failed") {
      const isCritical = run.priority === "critical" || run.process_templates?.criticality === "critical";
      candidates.push({
        action: `Review failed run: ${run.title}`,
        priority: isCritical ? "critical" : run.priority ?? "high",
        reason: run.failure_reason ? `Failed: ${run.failure_reason}` : "Process execution failed and requires resolution.",
        affectedProcessOrEntity: run.process_templates?.name ?? run.title,
        route: `/operations/runs/${run.id}`,
        score: isCritical ? 1000 : 800,
      });
    }
  }

  // 2. Critical/High blocked runs
  for (const blocker of blockers) {
    if (!blocker.resolved_at) {
      const isCritical = blocker.severity === "critical";
      candidates.push({
        action: `Unblock operational run: ${blocker.process_runs?.title ?? "Process run"}`,
        priority: blocker.severity,
        reason: `Blocked: ${blocker.description}`,
        affectedProcessOrEntity: blocker.process_runs?.title ?? "Active Run",
        route: `/operations/runs/${blocker.run_id}`,
        score: isCritical ? 900 : 700,
      });
    }
  }

  // 3. Open Critical / High Quality Incidents
  for (const incident of incidents) {
    if (!["resolved", "archived"].includes(incident.status)) {
      const isCritical = incident.severity === "critical";
      candidates.push({
        action: `Resolve quality incident: ${incident.title}`,
        priority: incident.severity,
        reason: `${incident.severity.toUpperCase()} incident is currently ${incident.status.replace("_", " ")}.`,
        affectedProcessOrEntity: incident.title,
        route: `/operations/quality`,
        score: isCritical ? 850 : 650,
      });
    }
  }

  // 4. Overdue process runs
  for (const run of runs) {
    if (["planned", "ready", "in_progress"].includes(run.status) && run.due_at) {
      const dueDate = run.due_at.slice(0, 10);
      if (dueDate < today) {
        candidates.push({
          action: `Complete overdue operational run: ${run.title}`,
          priority: run.priority === "critical" ? "critical" : "high",
          reason: `Execution was due on ${dueDate}.`,
          affectedProcessOrEntity: run.process_templates?.name ?? run.title,
          route: `/operations/runs/${run.id}`,
          score: run.priority === "critical" ? 820 : 600,
        });
      }
    }
  }

  // 5. Overdue / Due SOP reviews
  for (const sop of sops) {
    const reviewState = evaluateSopReviewState(sop, today);
    if (reviewState === "Overdue review" || reviewState === "Review due") {
      const isCritical = sop.criticality === "critical";
      candidates.push({
        action: `Review outdated SOP: ${sop.title}`,
        priority: isCritical ? "critical" : sop.criticality === "high" ? "high" : "medium",
        reason: reviewState === "Overdue review" ? `Review past due (${sop.next_review_at}).` : "Scheduled SOP review is due today.",
        affectedProcessOrEntity: sop.title,
        route: `/operations/sops/${sop.id}`,
        score: isCritical ? 750 : reviewState === "Overdue review" ? 500 : 400,
      });
    }
  }

  // 6. Active runs due today
  for (const run of runs) {
    if (["planned", "ready", "in_progress"].includes(run.status) && run.due_at) {
      const dueDate = run.due_at.slice(0, 10);
      if (dueDate === today) {
        candidates.push({
          action: `Execute process due today: ${run.title}`,
          priority: run.priority,
          reason: "Scheduled for execution today.",
          affectedProcessOrEntity: run.process_templates?.name ?? run.title,
          route: `/operations/runs/${run.id}`,
          score: run.priority === "critical" ? 550 : 350,
        });
      }
    }
  }

  if (!candidates.length) return null;

  // Deterministic sort: highest score first, then alphabetical by action
  candidates.sort((a, b) => b.score - a.score || a.action.localeCompare(b.action));
  return candidates[0];
}

/**
 * SOP review status evaluation without universal expiry rule.
 * Only checks user-defined cadence and next_review_at date.
 */
export function evaluateSopReviewState(sop: SopInput, today = new Date().toISOString().slice(0, 10)): SopReviewState {
  if (!sop.next_review_at || sop.review_cadence === "none") {
    return "No review rule";
  }
  const diffDays = Math.ceil((Date.parse(`${sop.next_review_at}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  if (diffDays < 0) return "Overdue review";
  if (diffDays === 0) return "Review due";
  if (diffDays <= 14) return "Review soon";
  return "Current";
}

/**
 * Deterministic process health derived from actual run history.
 * Never outputs fake precision percentages.
 */
export function evaluateProcessHealth(
  runs: ProcessRunInput[],
  failures: FailureInput[] = [],
  incidents: QualityIncidentInput[] = [],
  minSample = 3
): { health: ProcessHealthState; reason: string; totalRuns: number; failedRuns: number; onTimeRate: number | null } {
  const completedRuns = runs.filter((r) => ["completed", "failed"].includes(r.status));
  const totalRuns = completedRuns.length;

  if (totalRuns < minSample) {
    return {
      health: "Insufficient history",
      reason: `Only ${totalRuns} completed run${totalRuns === 1 ? "" : "s"} recorded. Minimum sample threshold is ${minSample}.`,
      totalRuns,
      failedRuns: runs.filter((r) => r.status === "failed").length + failures.length,
      onTimeRate: null,
    };
  }

  const failedRuns = completedRuns.filter((r) => r.status === "failed").length + failures.length;
  const failureRate = failedRuns / (totalRuns + (failures.length > 0 ? failures.length : 0));


  // On-time check
  let onTimeCount = 0;
  let datedRuns = 0;
  for (const run of completedRuns) {
    if (run.completed_at && run.due_at) {
      datedRuns += 1;
      if (run.completed_at <= run.due_at) onTimeCount += 1;
    }
  }
  const onTimeRate = datedRuns > 0 ? Math.round((onTimeCount / datedRuns) * 100) : null;

  const activeBlocked = runs.some((r) => r.status === "blocked");
  const hasCriticalIncidents = incidents.some((i) => i.severity === "critical" && !["resolved", "archived"].includes(i.status));

  if (hasCriticalIncidents || failureRate >= 0.3) {
    return {
      health: "Unhealthy",
      reason: hasCriticalIncidents
        ? "Active critical quality incident linked to this process."
        : `High failure rate (${Math.round(failureRate * 100)}% of runs failed).`,
      totalRuns,
      failedRuns,
      onTimeRate,
    };
  }

  if (failureRate >= 0.15 || activeBlocked) {
    return {
      health: "At risk",
      reason: activeBlocked
        ? "One or more runs are actively blocked."
        : `Elevated failure frequency (${failedRuns} out of ${totalRuns} runs).`,
      totalRuns,
      failedRuns,
      onTimeRate,
    };
  }

  if (onTimeRate !== null && onTimeRate < 70) {
    return {
      health: "Needs attention",
      reason: `On-time completion rate is ${onTimeRate}%.`,
      totalRuns,
      failedRuns,
      onTimeRate,
    };
  }

  return {
    health: "Healthy",
    reason: "Consistent execution with low failure rate and no active blockers.",
    totalRuns,
    failedRuns,
    onTimeRate,
  };
}

/**
 * Detect repeated failure patterns across runs.
 */
export function detectRepeatedFailures(failures: FailureInput[]): Array<{ failureType: FailureType; count: number; recentDescription: string }> {
  const map = new Map<FailureType, { count: number; recentDescription: string }>();
  for (const f of failures) {
    const existing = map.get(f.failure_type);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(f.failure_type, { count: 1, recentDescription: f.description });
    }
  }
  return Array.from(map.entries())
    .filter(([, data]) => data.count >= 2)
    .map(([failureType, data]) => ({ failureType, count: data.count, recentDescription: data.recentDescription }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Strict run completion validation.
 * Enforces:
 * - All required checklist items are checked.
 * - All required steps are marked completed (or explicitly skipped if permitted).
 * - No unresolved critical quality checks failed.
 * Can be overridden ONLY with explicit reason.
 */
export function validateRunCompletion(
  steps: SopStepInput[],
  stepProgress: Array<{ step_id: string; status: "completed" | "skipped" | "pending" }>,
  checklist: RunChecklistItemInput[],
  qualityExecutions: QualityExecutionInput[],
  override = false,
  overrideReason?: string | null
): { canComplete: boolean; blockers: string[] } {
  const blockers: string[] = [];

  // Check required checklist items
  const incompleteChecklist = checklist.filter((item) => item.required && !item.completed);
  if (incompleteChecklist.length > 0) {
    blockers.push(`${incompleteChecklist.length} required checklist item(s) incomplete (${incompleteChecklist.map((c) => c.label).slice(0, 2).join(", ")}).`);
  }

  // Check required steps
  const progressMap = new Map(stepProgress.map((p) => [p.step_id, p.status]));
  const requiredSteps = steps.filter((s) => s.required);
  const incompleteSteps = requiredSteps.filter((s) => progressMap.get(s.id) !== "completed");
  if (incompleteSteps.length > 0) {
    blockers.push(`${incompleteSteps.length} required step(s) not marked completed (${incompleteSteps.map((s) => s.title).slice(0, 2).join(", ")}).`);
  }

  // Check critical quality check failures
  const criticalQualityFails = qualityExecutions.filter(
    (q) => q.status === "fail" && q.quality_checks?.severity_if_failed === "critical"
  );
  if (criticalQualityFails.length > 0) {
    blockers.push(`Unresolved critical quality failure: ${criticalQualityFails[0].quality_checks?.name ?? "Quality Check"}.`);
  }

  if (blockers.length === 0) {
    return { canComplete: true, blockers: [] };
  }

  if (override) {
    if (!overrideReason || !overrideReason.trim()) {
      return { canComplete: false, blockers: ["Override requested but no explanation/reason was provided."] };
    }
    return { canComplete: true, blockers: [] };
  }

  return { canComplete: false, blockers };
}

/**
 * Builds deterministic Operations Review summary for a period (e.g. week or month).
 */
export function buildOperationsReview(
  runs: ProcessRunInput[],
  sops: SopInput[],
  incidents: QualityIncidentInput[],
  improvements: Array<{ id: string; status: ImprovementStatus }>,
  periodStart: string,
  periodEnd: string
) {
  const completedRuns = runs.filter(
    (r) => r.status === "completed" && r.completed_at && r.completed_at >= `${periodStart}T00:00:00Z` && r.completed_at <= `${periodEnd}T23:59:59Z`
  ).length;

  const failedRuns = runs.filter(
    (r) => r.status === "failed" && r.completed_at && r.completed_at >= `${periodStart}T00:00:00Z` && r.completed_at <= `${periodEnd}T23:59:59Z`
  ).length;

  const blockedRuns = runs.filter((r) => r.status === "blocked").length;

  const overdueRuns = runs.filter(
    (r) => ["planned", "ready", "in_progress"].includes(r.status) && r.due_at && r.due_at.slice(0, 10) < periodEnd
  ).length;

  const openIncidents = incidents.filter(
    (i) => !["resolved", "archived"].includes(i.status) && i.detected_at >= `${periodStart}T00:00:00Z`
  ).length;

  const sopsNeedingReview = sops.filter((s) => {
    const state = evaluateSopReviewState(s, periodEnd);
    return state === "Review due" || state === "Overdue review";
  }).length;

  const adoptedImprovements = improvements.filter((i) => i.status === "adopted").length;

  return {
    periodStart,
    periodEnd,
    runsCompleted: completedRuns,
    runsFailed: failedRuns,
    runsBlocked: blockedRuns,
    runsOverdue: overdueRuns,
    qualityIncidents: openIncidents,
    sopsNeedingReview,
    improvementsAdopted: adoptedImprovements,
  };
}

/**
 * Server-side foreign entity ownership check.
 * Strictly verifies that the authenticated user owns the linked foreign record.
 */
export async function validateForeignOwnership(
  client: SupabaseClient,
  userId: string,
  entityType: string,
  entityId: string
): Promise<boolean> {
  const allowedTables: Record<string, string> = {
    project: "projects",
    task: "tasks",
    client: "clients",
    lead: "leads",
    opportunity: "opportunities",
    supplier: "suppliers",
    product: "product_catalog_refs",
    campaign: "campaigns",
    strategic_commitment: "strategic_commitments",
    strategic_milestone: "strategic_milestones",
    note: "notes",
    attachment: "attachments",
    integration: "integrations",
    automation: "automations",
    research_topic: "research_topics",
    research_finding: "research_findings",
    knowledge_source: "knowledge_sources",
  };

  const table = allowedTables[entityType];
  if (!table) return false;

  const { data, error } = await client
    .from(table)
    .select("id")
    .eq("id", entityId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return false;
  return true;
}

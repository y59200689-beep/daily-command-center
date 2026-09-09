// V17 Chief of Staff Safe Action Orchestration Engine
// Pure deterministic business logic with zero AI hallucination or fabricated execution.

export type ActionRiskLevel = "safe_internal" | "low" | "moderate" | "high" | "critical";

export type ActionReversibility =
  | "reversible"
  | "partially_reversible"
  | "hard_to_reverse"
  | "irreversible"
  | "unknown";

export type ActionPolicyDecision =
  | "auto_executable"
  | "approval_required"
  | "additional_confirmation_required"
  | "unsupported";

export type ChiefOfStaffAutonomyLevel =
  | 0
  | 1
  | 2
  | "level_0_read_only"
  | "level_1_propose_and_draft"
  | "level_2_safe_internal_autonomous";

export type ActionExecutionStatus =
  | "prepared"
  | "awaiting_approval"
  | "approved"
  | "preflight"
  | "executing"
  | "executed"
  | "verifying"
  | "verified"
  | "failed"
  | "blocked"
  | "cancelled"
  | "rolled_back";

export type ActionReadinessState =
  | "proposed"
  | "needs_preparation"
  | "needs_approval"
  | "ready"
  | "blocked"
  | "executing"
  | "needs_verification"
  | "complete"
  | "failed";

export type ApprovalFreshnessState =
  | "fresh"
  | "context_changed"
  | "expired"
  | "target_changed"
  | "provider_state_changed"
  | "requires_reapproval";

export type ErrorCategory =
  | "validation"
  | "authentication"
  | "authorization"
  | "provider_unavailable"
  | "rate_limited"
  | "conflict"
  | "context_changed"
  | "expired_approval"
  | "unsupported"
  | "network"
  | "verification_failed"
  | "unknown";

export interface ActionProposal {
  id: string;
  title: string;
  description?: string;
  source_domain: string;
  source_entity_type?: string;
  source_entity_id?: string;
  action_type: string;
  target_type?: string;
  target_id?: string;
  risk_level: ActionRiskLevel;
  reversibility: ActionReversibility;
  reason: string;
  evidence?: string;
  proposed_payload: Record<string, unknown>;
  approval_id?: string | null;
  plan_id?: string | null;
  expires_at?: string | null;
  status: "proposed" | "preparing" | "ready_for_review" | "approved" | "rejected" | "expired" | "cancelled" | "executed";
  created_at: string;
}

export interface ActionPlanStep {
  id: string;
  plan_id: string;
  position: number;
  title: string;
  action_type: string;
  risk_level: ActionRiskLevel;
  reversibility: ActionReversibility;
  requires_approval: boolean;
  status: "pending" | "preparing" | "awaiting_approval" | "ready" | "executing" | "verifying" | "completed" | "blocked" | "failed" | "skipped" | "cancelled";
  input_payload: Record<string, unknown>;
  output_payload?: Record<string, unknown> | null;
  approval_id?: string | null;
  execution_id?: string | null;
  dependencies?: string[];
}

export interface NextChiefAction {
  actionId?: string;
  title: string;
  whyNow: string;
  risk: ActionRiskLevel;
  approvalRequirement: ActionPolicyDecision;
  readiness: ActionReadinessState;
  route: string;
  score: number;
}

// ============================================================
// 1. Action Risk Classification
// ============================================================

export function classifyActionRisk(
  actionType: string,
  payload: Record<string, unknown> = {},
  context?: { hasExternalSideEffect?: boolean; isDestructive?: boolean; irreversible?: boolean }
): { riskLevel: ActionRiskLevel; reversibility: ActionReversibility; reason: string } {
  void payload;
  // Hard Safety Critical overrides
  if (
    actionType === "move_money" ||
    actionType === "execute_payment" ||
    actionType === "wire_transfer" ||
    actionType === "charge_client" ||
    actionType === "pay_supplier" ||
    actionType === "destroy_database" ||
    actionType === "hard_delete_all"
  ) {
    return {
      riskLevel: "critical",
      reversibility: "irreversible",
      reason: "Direct money movement or destructive irreversible operation",
    };
  }

  // High risk operations
  if (
    actionType === "delete_calendar_event" ||
    actionType === "publish_content" ||
    actionType === "deploy_production" ||
    actionType === "cancel_service" ||
    actionType === "reassign_personnel" ||
    context?.isDestructive
  ) {
    return {
      riskLevel: "high",
      reversibility: actionType === "delete_calendar_event" ? "hard_to_reverse" : "irreversible",
      reason: "Consequential destructive or high-impact operational action",
    };
  }

  // Moderate risk: External outbound communication or calendar creation
  if (
    actionType === "send_email" ||
    actionType === "create_calendar_event" ||
    actionType === "update_calendar_event" ||
    actionType === "create_github_issue" ||
    actionType === "comment_github_issue" ||
    context?.hasExternalSideEffect
  ) {
    return {
      riskLevel: "moderate",
      reversibility: actionType === "send_email" ? "irreversible" : "reversible",
      reason: "External side effect affecting external systems or recipients",
    };
  }

  // Low risk: Previews, drafts, staged items
  if (
    actionType === "create_email_draft" ||
    actionType === "prepare_calendar_event" ||
    actionType === "prepare_supplier_order" ||
    actionType === "prepare_invoice_reminder" ||
    actionType === "draft_action_plan"
  ) {
    return {
      riskLevel: "low",
      reversibility: "reversible",
      reason: "Prepared draft or proposal with zero immediate external impact",
    };
  }

  // Safe internal: Internal tasks, notes, follow-ups, audit entries
  return {
    riskLevel: "safe_internal",
    reversibility: "reversible",
    reason: "Internal workspace record creation or non-destructive state update",
  };
}

// ============================================================
// 2. Policy Classification & Hard Safety Limits
// ============================================================

export function classifyActionPolicy(
  actionType: string,
  riskLevel: ActionRiskLevel,
  autonomyLevel = 1,
  userPolicies: Record<string, string> = {}
): ActionPolicyDecision {
  // Hard Safety Invariant: Unsupported or dangerous money movement
  if (
    actionType === "move_money" ||
    actionType === "wire_transfer" ||
    actionType === "charge_client" ||
    actionType === "pay_supplier" ||
    actionType === "silent_deploy"
  ) {
    return "unsupported";
  }

  // User policy lookup
  if (userPolicies[actionType] === "unsupported") return "unsupported";
  if (userPolicies[actionType] === "approval_required") return "approval_required";

  // Critical risk always requires explicit additional confirmation
  if (riskLevel === "critical") {
    return "additional_confirmation_required";
  }

  // High or moderate risk always requires user approval
  if (riskLevel === "high" || riskLevel === "moderate") {
    return "approval_required";
  }

  // Low risk (drafts)
  if (riskLevel === "low") {
    return autonomyLevel >= 1 ? "approval_required" : "approval_required";
  }

  // Safe internal: Check autonomy level
  if (riskLevel === "safe_internal") {
    if (autonomyLevel >= 2) return "auto_executable";
    return "approval_required";
  }

  return "approval_required";
}

// ============================================================
// 3. Payload Hashing & Validation
// ============================================================

export function computePayloadHash(payload: unknown): string {
  const jsonStr = JSON.stringify(payload, Object.keys(payload as object || {}).sort());
  // Deterministic 32-bit FNV-1a / DJB2 combined hash
  let hash = 2166136261;
  for (let i = 0; i < jsonStr.length; i++) {
    hash ^= jsonStr.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return `h_${(hash >>> 0).toString(16)}`;
}

export function validateApprovedPayload(
  approvedPayloadHash: string,
  currentPayload: unknown
): { valid: boolean; reason?: string } {
  const currentHash = computePayloadHash(currentPayload);
  if (currentHash !== approvedPayloadHash) {
    return {
      valid: false,
      reason: `Payload was modified after approval. Expected hash ${approvedPayloadHash}, found ${currentHash}.`,
    };
  }
  return { valid: true };
}

// ============================================================
// 4. Stale Approval & Context Drift Detection
// ============================================================

export function evaluateApprovalFreshness(
  approval: {
    created_at: string;
    expires_at?: string | null;
    status: string;
    approved_at?: string | null;
  },
  now = new Date()
): ApprovalFreshnessState {
  if (approval.status !== "approved" && approval.status !== "pending") {
    return "requires_reapproval";
  }

  if (approval.expires_at && new Date(approval.expires_at).getTime() < now.getTime()) {
    return "expired";
  }

  // Approval older than 48 hours is considered stale
  const approvedTime = approval.approved_at ? new Date(approval.approved_at).getTime() : new Date(approval.created_at).getTime();
  if (now.getTime() - approvedTime > 48 * 3600 * 1000) {
    return "requires_reapproval";
  }

  return "fresh";
}

export function detectContextDrift(
  snapshot: Record<string, unknown>,
  current: Record<string, unknown>
): { drifted: boolean; differences: string[] } {
  const differences: string[] = [];

  for (const [key, oldVal] of Object.entries(snapshot)) {
    const newVal = current[key];
    if (newVal !== undefined && oldVal !== newVal) {
      differences.push(`${key} changed from '${String(oldVal)}' to '${String(newVal)}'`);
    }
  }

  return {
    drifted: differences.length > 0,
    differences,
  };
}

// ============================================================
// 5. Idempotency Key Builder
// ============================================================

export function buildActionIdempotencyKey(
  userId: string,
  actionType: string,
  targetId: string | null | undefined,
  payloadHash: string
): string {
  return `idemp:${userId}:${actionType}:${targetId ?? "singleton"}:${payloadHash}`;
}

// ============================================================
// 6. Action State Machine Transitions
// ============================================================

const VALID_TRANSITIONS: Record<ActionExecutionStatus, ActionExecutionStatus[]> = {
  prepared: ["awaiting_approval", "preflight", "cancelled"],
  awaiting_approval: ["approved", "cancelled"],
  approved: ["preflight", "cancelled"],
  preflight: ["executing", "blocked", "failed", "awaiting_approval"],
  executing: ["executed", "failed", "verifying"],
  executed: ["verifying", "verified", "failed"],
  verifying: ["verified", "failed"],
  verified: ["rolled_back"],
  failed: ["preflight", "executing", "cancelled"],
  blocked: ["preflight", "cancelled"],
  cancelled: [],
  rolled_back: [],
};

export function validateStateTransition(
  current: ActionExecutionStatus,
  next: ActionExecutionStatus
): { valid: boolean; error?: string } {
  const allowed = VALID_TRANSITIONS[current] ?? [];
  if (!allowed.includes(next)) {
    return {
      valid: false,
      error: `Invalid transition from '${current}' to '${next}'.`,
    };
  }
  return { valid: true };
}

// ============================================================
// 7. Retry Management
// ============================================================

export function evaluateRetryability(
  errorCategory: ErrorCategory,
  attemptCount: number,
  maxRetries = 3
): { retryable: boolean; reason: string; nextDelayMs?: number } {
  if (attemptCount >= maxRetries) {
    return { retryable: false, reason: `Exceeded maximum retries (${maxRetries}).` };
  }

  const nonRetryable: ErrorCategory[] = [
    "validation",
    "authentication",
    "authorization",
    "context_changed",
    "expired_approval",
    "unsupported",
  ];

  if (nonRetryable.includes(errorCategory)) {
    return { retryable: false, reason: `Error category '${errorCategory}' is non-retryable without user intervention.` };
  }

  // Exponential backoff with jitter
  const backoff = Math.min(60000, 1000 * Math.pow(2, attemptCount));
  return {
    retryable: true,
    reason: `Temporary ${errorCategory} failure; retry scheduled in ${Math.round(backoff / 1000)}s.`,
    nextDelayMs: backoff,
  };
}

// ============================================================
// 8. Rollback Availability
// ============================================================

export function evaluateRollbackAvailability(
  actionType: string,
  executionResult: Record<string, unknown> = {}
): {
  available: boolean;
  rollbackType: "reversal" | "compensating_action" | "none";
  reason: string;
} {
  if (actionType === "send_email") {
    return {
      available: true,
      rollbackType: "compensating_action",
      reason: "Sent email cannot be unsent. A corrective follow-up email can be prepared.",
    };
  }

  if (actionType === "create_calendar_event" && executionResult.eventId) {
    return {
      available: true,
      rollbackType: "reversal",
      reason: "Created Calendar event can be deleted from remote provider.",
    };
  }

  if (actionType === "create_task" && executionResult.taskId) {
    return {
      available: true,
      rollbackType: "reversal",
      reason: "Created internal task can be archived or deleted.",
    };
  }

  return {
    available: false,
    rollbackType: "none",
    reason: "No safe automatic rollback supported for this action.",
  };
}

// ============================================================
// 9. Next Chief of Staff Action Ranking
// ============================================================

export function rankNextChiefOfStaffAction(context: {
  proposals: ActionProposal[];
  pendingApprovals: Array<{ id: string; title: string; risk_level: ActionRiskLevel; action_type: string }>;
  failedExecutions: Array<{ id: string; action_type: string; error_message?: string }>;
  escalations: Array<{ id: string; title: string; severity: string }>;
}): NextChiefAction {
  // 1. Critical Escalation
  if (context.escalations.length > 0) {
    const esc = context.escalations[0];
    return {
      actionId: esc.id,
      title: `Review Escalation: ${esc.title}`,
      whyNow: "Critical operational or execution block requires owner resolution",
      risk: "high",
      approvalRequirement: "additional_confirmation_required",
      readiness: "needs_approval",
      route: "/chief-of-staff/escalations",
      score: 100,
    };
  }

  // 2. Pending High-Risk Approvals
  const highApproval = context.pendingApprovals.find((a) => a.risk_level === "high" || a.risk_level === "critical");
  if (highApproval) {
    return {
      actionId: highApproval.id,
      title: `Approve: ${highApproval.title}`,
      whyNow: "High-impact action is prepared and waiting for your explicit approval",
      risk: highApproval.risk_level,
      approvalRequirement: "approval_required",
      readiness: "needs_approval",
      route: "/chief-of-staff/approvals",
      score: 90,
    };
  }

  // 3. Failed Executions needing retry or review
  if (context.failedExecutions.length > 0) {
    const failed = context.failedExecutions[0];
    return {
      actionId: failed.id,
      title: `Failed Execution: ${failed.action_type}`,
      whyNow: failed.error_message || "Action execution failed and requires manual retry or correction",
      risk: "moderate",
      approvalRequirement: "approval_required",
      readiness: "failed",
      route: "/chief-of-staff/executions",
      score: 80,
    };
  }

  // 4. Any Pending Approval
  if (context.pendingApprovals.length > 0) {
    const first = context.pendingApprovals[0];
    return {
      actionId: first.id,
      title: `Approve: ${first.title}`,
      whyNow: "Prepared action is ready for your review and execution",
      risk: first.risk_level,
      approvalRequirement: "approval_required",
      readiness: "needs_approval",
      route: "/chief-of-staff/approvals",
      score: 70,
    };
  }

  // 5. Action Proposals
  if (context.proposals.length > 0) {
    const prop = context.proposals[0];
    return {
      actionId: prop.id,
      title: `Prepare: ${prop.title}`,
      whyNow: prop.reason,
      risk: prop.risk_level,
      approvalRequirement: "approval_required",
      readiness: "proposed",
      route: "/chief-of-staff/inbox",
      score: 50,
    };
  }

  // Default clean state
  return {
    title: "All systems operating within normal parameters",
    whyNow: "No pending approvals, failed executions, or urgent action proposals",
    risk: "safe_internal",
    approvalRequirement: "auto_executable",
    readiness: "complete",
    route: "/chief-of-staff",
    score: 0,
  };
}

// ============================================================
// 10. Execution Receipt Builder
// ============================================================

export function buildExecutionReceipt(context: {
  actionType: string;
  title: string;
  summary: string;
  provider?: string;
  externalReference?: string;
  payload: Record<string, unknown>;
  executionResult: Record<string, unknown>;
  verified?: boolean;
}): {
  receiptId: string;
  whatHappened: string;
  whatChanged: Record<string, unknown>;
  externalReference: string | null;
  verificationState: "verified" | "unverified";
  nextSteps: string[];
} {
  const receiptId = `rcpt_${Date.now()}`;
  const whatHappened = `Successfully executed ${context.actionType}: "${context.title}".`;
  const whatChanged = {
    actionType: context.actionType,
    externalId: context.externalReference ?? context.executionResult.id ?? null,
    provider: context.provider ?? "internal",
    timestamp: new Date().toISOString(),
  };

  const nextSteps: string[] = [];
  if (context.actionType === "send_email") {
    nextSteps.push("Wait 3 days for client reply or schedule follow-up check.");
  } else if (context.actionType === "create_calendar_event") {
    nextSteps.push("Verify attendee acceptance in Google Calendar.");
  } else {
    nextSteps.push("Monitor outcome progress in workspace.");
  }

  return {
    receiptId,
    whatHappened,
    whatChanged,
    externalReference: context.externalReference ?? null,
    verificationState: context.verified ? "verified" : "unverified",
    nextSteps,
  };
}

// ============================================================
// 11. Multi-Step Plan State Evaluator
// ============================================================

export function evaluatePlanState(
  steps: ActionPlanStep[],
  dependencies: Array<{ step_id: string; depends_on_step_id: string; dependency_state: string }> = []
): {
  planStatus: "draft" | "pending_approval" | "partially_approved" | "approved" | "executing" | "partially_completed" | "completed" | "failed" | "blocked";
  canExecuteStepIds: string[];
  blockedStepIds: string[];
} {
  if (steps.length === 0) {
    return { planStatus: "draft", canExecuteStepIds: [], blockedStepIds: [] };
  }

  const stepStatusMap = new Map(steps.map((s) => [s.id, s.status]));
  const canExecuteStepIds: string[] = [];
  const blockedStepIds: string[] = [];

  for (const step of steps) {
    // Check if dependencies satisfied
    const stepDeps = dependencies.filter((d) => d.step_id === step.id);
    const satisfied = stepDeps.every((d) => {
      const depStatus = stepStatusMap.get(d.depends_on_step_id);
      return depStatus === "completed" || depStatus === "skipped";
    });

    if (!satisfied) {
      blockedStepIds.push(step.id);
    } else if (step.status === "ready" || step.status === "awaiting_approval") {
      canExecuteStepIds.push(step.id);
    }
  }

  const completedCount = steps.filter((s) => s.status === "completed" || s.status === "skipped").length;
  const failedCount = steps.filter((s) => s.status === "failed").length;

  let planStatus: "draft" | "pending_approval" | "partially_approved" | "approved" | "executing" | "partially_completed" | "completed" | "failed" | "blocked" = "executing";

  if (completedCount === steps.length) {
    planStatus = "completed";
  } else if (failedCount > 0) {
    planStatus = "failed";
  } else if (blockedStepIds.length === steps.length) {
    planStatus = "blocked";
  } else if (steps.some((s) => s.status === "awaiting_approval")) {
    planStatus = "pending_approval";
  } else if (completedCount > 0) {
    planStatus = "partially_completed";
  }

  return { planStatus, canExecuteStepIds, blockedStepIds };
}

// ============================================================
// 12. Automation Opportunity Detector
// ============================================================

export function buildAutomationOpportunity(
  history: Array<{ action_type: string; created_at: string; title: string }>
): Array<{
  name: string;
  action_type: string;
  occurrenceCount: number;
  safetyClass: ActionRiskLevel;
  recommendation: string;
}> {
  const counts: Record<string, { count: number; sampleTitle: string }> = {};

  for (const item of history) {
    if (!counts[item.action_type]) {
      counts[item.action_type] = { count: 0, sampleTitle: item.title };
    }
    counts[item.action_type].count++;
  }

  const opportunities: Array<{
    name: string;
    action_type: string;
    occurrenceCount: number;
    safetyClass: ActionRiskLevel;
    recommendation: string;
  }> = [];

  for (const [actionType, data] of Object.entries(counts)) {
    // Only suggest for repeated manual patterns (>= 3 times)
    if (data.count >= 3) {
      const risk = classifyActionRisk(actionType).riskLevel;
      opportunities.push({
        name: `Automate ${actionType.replace(/_/g, " ")}`,
        action_type: actionType,
        occurrenceCount: data.count,
        safetyClass: risk,
        recommendation: `Performed manually ${data.count} times. Consider automating this recurring internal routine.`,
      });
    }
  }

  return opportunities;
}

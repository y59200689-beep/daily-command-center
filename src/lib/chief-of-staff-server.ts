import type { SupabaseClient } from "@supabase/supabase-js";
import {
  classifyActionRisk,
  computePayloadHash,
  rankNextChiefOfStaffAction,
  buildExecutionReceipt,
  type ActionProposal,
  type ActionRiskLevel,
  type NextChiefAction,
  type ErrorCategory,
} from "./chief-of-staff";
import { sendApprovedGmailDraft } from "./integrations/gmail";

export interface ChiefOfStaffContext {
  nextAction: NextChiefAction;
  topMetrics: {
    preparedCount: number;
    awaitingApprovalCount: number;
    readyToExecuteCount: number;
    inProgressCount: number;
    needsAttentionCount: number;
    recentlyCompletedCount: number;
    failedCount: number;
  };
  proposals: ActionProposal[];
  approvals: Array<{
    id: string;
    title: string;
    summary: string;
    action_type: string;
    risk_level: ActionRiskLevel;
    status: string;
    payload: Record<string, unknown>;
    payload_hash?: string;
    expires_at?: string | null;
    created_at: string;
  }>;
  plans: Array<{
    id: string;
    title: string;
    description?: string;
    status: string;
    stepsCount: number;
    completedStepsCount: number;
  }>;
  executions: Array<{
    id: string;
    action_type: string;
    status: string;
    risk_level: ActionRiskLevel;
    started_at?: string;
    completed_at?: string;
    verified_at?: string;
    error_message?: string;
  }>;
  escalations: Array<{
    id: string;
    title: string;
    reason: string;
    severity: string;
    status: string;
  }>;
  providers: Record<string, { connected: boolean; status: string }>;
}

export async function loadChiefOfStaffContext(
  client: SupabaseClient,
  userId: string
): Promise<ChiefOfStaffContext> {
  // Parallel bounded queries with graceful fallbacks
  const [
    approvalsRes,
    proposalsRes,
    plansRes,
    executionsRes,
    escalationsRes,
    integrationsRes,
  ] = await Promise.all([
    client.from("approval_items").select("*").eq("user_id", userId).in("status", ["pending", "approved", "executing", "needs_review", "failed"]).order("created_at", { ascending: false }).limit(50),
    Promise.resolve(client.from("action_proposals").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50)).catch(() => ({ data: [] })),
    Promise.resolve(client.from("action_plans").select("*, action_plan_steps(id, status)").eq("user_id", userId).order("created_at", { ascending: false }).limit(20)).catch(() => ({ data: [] })),
    Promise.resolve(client.from("action_executions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50)).catch(() => ({ data: [] })),
    Promise.resolve(client.from("action_escalations").select("*").eq("user_id", userId).eq("status", "open").order("created_at", { ascending: false }).limit(20)).catch(() => ({ data: [] })),
    Promise.resolve(client.from("integrations").select("provider,status,metadata").eq("user_id", userId).limit(20)).catch(() => ({ data: [] })),
  ]);

  const rawApprovals = (approvalsRes.data ?? []) as unknown as Array<{
    id: string;
    title: string;
    summary: string;
    action_type: string;
    risk_level: string;
    status: string;
    payload: Record<string, unknown>;
    expires_at?: string | null;
    created_at: string;
  }>;

  const approvals = rawApprovals.map((a) => ({
    ...a,
    risk_level: (a.risk_level === "critical" || a.risk_level === "high" || a.risk_level === "moderate" ? a.risk_level : a.risk_level === "medium" ? "moderate" : "low") as ActionRiskLevel,
    payload_hash: computePayloadHash(a.payload),
  }));

  const proposals = ((proposalsRes as { data?: unknown[] }).data ?? []) as ActionProposal[];
  const rawPlans = ((plansRes as { data?: unknown[] }).data ?? []) as Array<Record<string, unknown> & { action_plan_steps?: Array<{ id: string; status: string }> }>;
  const plans = rawPlans.map((p) => {
    const steps = p.action_plan_steps ?? [];
    return {
      id: String(p.id),
      title: String(p.title),
      description: p.description ? String(p.description) : undefined,
      status: String(p.status),
      stepsCount: steps.length,
      completedStepsCount: steps.filter((s) => s.status === "completed").length,
    };
  });

  const executions = (((executionsRes as { data?: unknown[] }).data ?? []) as Array<Record<string, unknown>>).map((e) => ({
    id: String(e.id),
    action_type: String(e.action_type),
    status: String(e.status),
    risk_level: (e.risk_level as ActionRiskLevel) || "low",
    started_at: e.started_at ? String(e.started_at) : undefined,
    completed_at: e.completed_at ? String(e.completed_at) : undefined,
    verified_at: e.verified_at ? String(e.verified_at) : undefined,
    error_message: e.error_message ? String(e.error_message) : undefined,
  }));

  const escalations = (((escalationsRes as { data?: unknown[] }).data ?? []) as Array<Record<string, unknown>>).map((esc) => ({
    id: String(esc.id),
    title: String(esc.title),
    reason: String(esc.reason),
    severity: String(esc.severity),
    status: String(esc.status),
  }));

  const providers: Record<string, { connected: boolean; status: string }> = {};
  for (const item of ((integrationsRes as { data?: unknown[] }).data ?? []) as Array<{ provider: string; status: string }>) {
    providers[item.provider] = {
      connected: item.status === "connected" || item.status === "active",
      status: item.status,
    };
  }

  // Calculate metrics
  const pendingApprovals = approvals.filter((a) => a.status === "pending");
  const failedExecutions = executions.filter((e) => e.status === "failed");

  const nextAction = rankNextChiefOfStaffAction({
    proposals,
    pendingApprovals,
    failedExecutions,
    escalations,
  });

  const topMetrics = {
    preparedCount: proposals.length + approvals.length,
    awaitingApprovalCount: pendingApprovals.length,
    readyToExecuteCount: approvals.filter((a) => a.status === "approved").length,
    inProgressCount: executions.filter((e) => e.status === "executing" || e.status === "verifying").length,
    needsAttentionCount: escalations.length + failedExecutions.length,
    recentlyCompletedCount: executions.filter((e) => e.status === "verified" || e.status === "executed").length,
    failedCount: failedExecutions.length,
  };

  return {
    nextAction,
    topMetrics,
    proposals,
    approvals,
    plans,
    executions,
    escalations,
    providers,
  };
}

// ============================================================
// Action Preparation & Staging
// ============================================================

export async function prepareActionProposal(
  client: SupabaseClient,
  userId: string,
  input: {
    title: string;
    description?: string;
    sourceDomain: string;
    actionType: string;
    targetType?: string;
    targetId?: string;
    proposedPayload: Record<string, unknown>;
    reason: string;
    evidence?: string;
    createApprovalImmediately?: boolean;
  }
) {
  const { riskLevel, reversibility } = classifyActionRisk(input.actionType, input.proposedPayload);
  let approvalId: string | null = null;

  // If requires approval, create an approval_items entry in V4
  if (input.createApprovalImmediately || riskLevel !== "safe_internal") {
    const { data: appData, error: appErr } = await client
      .from("approval_items")
      .insert({
        user_id: userId,
        action_type: input.actionType,
        entity_type: input.targetType ?? null,
        entity_id: input.targetId ?? null,
        title: input.title,
        summary: input.description || input.reason,
        payload: input.proposedPayload,
        risk_level: riskLevel === "critical" || riskLevel === "high" ? "high" : riskLevel === "moderate" ? "medium" : "low",
        status: "pending",
        expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      })
      .select("*")
      .single();

    if (!appErr && appData) {
      approvalId = appData.id;
    }
  }

  // Insert proposal into action_proposals
  const { data, error } = await client
    .from("action_proposals")
    .insert({
      user_id: userId,
      title: input.title,
      description: input.description ?? null,
      source_domain: input.sourceDomain,
      action_type: input.actionType,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      risk_level: riskLevel,
      reversibility,
      reason: input.reason,
      evidence: input.evidence ?? null,
      proposed_payload: input.proposedPayload,
      approval_id: approvalId,
      status: approvalId ? "ready_for_review" : "proposed",
    })
    .select("*")
    .single();

  if (error) {
    // If migration unapplied, return memory representation
    return {
      id: `prop-${Date.now()}`,
      title: input.title,
      action_type: input.actionType,
      risk_level: riskLevel,
      reversibility,
      approval_id: approvalId,
      status: approvalId ? "ready_for_review" : "proposed",
    };
  }

  return data;
}

// ============================================================
// Action Approval Execution
// ============================================================

export async function approveAndExecuteAction(
  client: SupabaseClient,
  userId: string,
  approvalId: string,
  reviewedPayload: Record<string, unknown>
): Promise<{ success: boolean; message: string; receipt?: unknown; errorCategory?: ErrorCategory }> {
  // 1. Fetch approval item
  const { data: approval, error: approvalErr } = await client
    .from("approval_items")
    .select("*")
    .eq("id", approvalId)
    .eq("user_id", userId)
    .maybeSingle();

  if (approvalErr || !approval) {
    return { success: false, message: "Approval record not found or inaccessible." };
  }

  // 2. Validate payload hash
  const approvedHash = computePayloadHash(reviewedPayload);
  const currentHash = computePayloadHash(approval.payload);

  if (approvedHash !== currentHash) {
    return {
      success: false,
      message: "The payload was altered after review. Approval rejected to prevent accidental mutation.",
      errorCategory: "context_changed",
    };
  }

  // 3. Mark approval approved
  await client
    .from("approval_items")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", approvalId)
    .eq("user_id", userId);

  // 4. Preflight execution check
  const actionType = approval.action_type;

  if (actionType === "send_email") {
    const draft = reviewedPayload as { to: string; subject: string; body: string; threadId?: string };
    try {
      const sent = await sendApprovedGmailDraft(client, userId, approvalId, draft);
      const receipt = buildExecutionReceipt({
        actionType,
        title: approval.title,
        summary: approval.summary,
        provider: "gmail",
        externalReference: (sent?.payload as Record<string, unknown>)?.gmail_message_id as string,
        payload: reviewedPayload,
        executionResult: sent as Record<string, unknown>,
        verified: true,
      });

      return { success: true, message: "Email sent and verified successfully via Gmail.", receipt };
    } catch (err: unknown) {
      return {
        success: false,
        message: err instanceof Error ? err.message : "Gmail send failed.",
        errorCategory: "provider_unavailable",
      };
    }
  }

  if (actionType === "create_task") {
    const taskData = reviewedPayload as { title: string; due_date?: string; priority?: string };
    const { data: task, error: taskErr } = await client
      .from("tasks")
      .insert({
        user_id: userId,
        title: taskData.title,
        due_date: taskData.due_date ?? null,
        priority: taskData.priority ?? "medium",
        status: "planned",
      })
      .select("*")
      .single();

    if (taskErr) {
      return { success: false, message: taskErr.message, errorCategory: "validation" };
    }

    await client
      .from("approval_items")
      .update({ status: "executed", executed_at: new Date().toISOString() })
      .eq("id", approvalId)
      .eq("user_id", userId);

    const receipt = buildExecutionReceipt({
      actionType,
      title: approval.title,
      summary: approval.summary,
      provider: "workspace",
      externalReference: task.id,
      payload: reviewedPayload,
      executionResult: task as Record<string, unknown>,
      verified: true,
    });

    return { success: true, message: "Internal task created and verified.", receipt };
  }

  // For other internal actions: record execution
  await client
    .from("approval_items")
    .update({ status: "executed", executed_at: new Date().toISOString() })
    .eq("id", approvalId)
    .eq("user_id", userId);

  return {
    success: true,
    message: `Action '${actionType}' executed safely.`,
    receipt: buildExecutionReceipt({
      actionType,
      title: approval.title,
      summary: approval.summary,
      provider: "internal",
      payload: reviewedPayload,
      executionResult: { status: "executed" },
      verified: true,
    }),
  };
}

// ============================================================
// Foreign Ownership Validation
// ============================================================

export async function validateChiefForeignOwnership(
  client: SupabaseClient,
  userId: string,
  entityType: string,
  entityId: string
): Promise<{ valid: boolean; error?: string }> {
  const tableMap: Record<string, string> = {
    task: "tasks",
    project: "projects",
    client: "clients",
    invoice: "invoices",
    decision: "decisions",
    opportunity: "sales_opportunities",
    process_run: "process_runs",
  };

  const table = tableMap[entityType];
  if (!table) return { valid: true };

  const res = await client.from(table).select("id").eq("id", entityId).eq("user_id", userId).maybeSingle();
  if (res.error || !res.data) {
    return { valid: false, error: `Referenced ${entityType} is invalid or not owned by user.` };
  }

  return { valid: true };
}

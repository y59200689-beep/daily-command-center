import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyOnce } from "@/lib/v4-notifications";
import { loadChiefOfStaffContext } from "./chief-of-staff-server";

export const chiefOfStaffAutomationTypes = [
  "chief_of_staff_daily_review",
  "approved_action_queue_review",
  "failed_execution_review",
  "stale_approval_review",
  "provider_health_review",
  "automation_opportunity_review",
  "post_action_verification_review",
] as const;

export async function emitChiefOfStaffNotifications(
  client: SupabaseClient,
  userId: string
): Promise<{ affected: number }> {
  let affected = 0;

  // Load context safely
  let ctx;
  try {
    ctx = await loadChiefOfStaffContext(client, userId);
  } catch {
    return { affected: 0 };
  }

  // 1. Pending Approvals Awaiting Action
  const pendingApprovals = ctx.approvals.filter((a) => a.status === "pending");
  if (pendingApprovals.length > 0) {
    const first = pendingApprovals[0];
    const dedupeKey = `chief:approval:${first.id}`;
    const sent = await notifyOnce(client, userId, {
      type: "decisions",
      title: `Action Awaiting Approval: ${first.title}`,
      body: `${pendingApprovals.length} action${pendingApprovals.length === 1 ? "" : "s"} awaiting your explicit review in Chief of Staff.`,
      severity: first.risk_level === "critical" || first.risk_level === "high" ? "important" : "attention",
      entityType: "chief_approval",
      entityId: first.id,
      dedupeKey,
      cooldownHours: 24,
    });
    if (sent) affected++;
  }

  // 2. Failed Executions
  const failedExecutions = ctx.executions.filter((e) => e.status === "failed");
  for (const failed of failedExecutions.slice(0, 3)) {
    const dedupeKey = `chief:execution-failed:${failed.id}`;
    const sent = await notifyOnce(client, userId, {
      type: "tasks",
      title: `Action Execution Failed: ${failed.action_type}`,
      body: failed.error_message || "An approved action failed execution and requires manual review.",
      severity: "important",
      entityType: "chief_execution",
      entityId: failed.id,
      dedupeKey,
      cooldownHours: 24,
    });
    if (sent) affected++;
  }

  // 3. Escalations
  for (const esc of ctx.escalations.slice(0, 3)) {
    const dedupeKey = `chief:escalation:${esc.id}`;
    const sent = await notifyOnce(client, userId, {
      type: "decisions",
      title: `Chief of Staff Escalation: ${esc.title}`,
      body: esc.reason,
      severity: esc.severity === "critical" ? "critical" : "important",
      entityType: "chief_escalation",
      entityId: esc.id,
      dedupeKey,
      cooldownHours: 48,
    });
    if (sent) affected++;
  }

  return { affected };
}

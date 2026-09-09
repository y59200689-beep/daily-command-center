import type { SupabaseClient } from "@supabase/supabase-js";
import { loadChiefOfStaffContext, prepareActionProposal, approveAndExecuteAction } from "./chief-of-staff-server";
import { buildAutomationOpportunity } from "./chief-of-staff";

export const chiefOfStaffReadNames = [
  "get_chief_of_staff_overview",
  "get_action_inbox",
  "get_action_proposal",
  "get_action_plan",
  "get_action_readiness",
  "get_approval_queue",
  "get_execution_queue",
  "get_execution_history",
  "get_failed_actions",
  "get_action_receipt",
  "get_automation_opportunities",
  "get_action_escalations",
  "get_provider_action_readiness",
] as const;

export const chiefOfStaffWrites: Record<string, boolean> = {
  prepare_action: true,
  create_action_plan: true,
  edit_action_payload: true,
  approve_action: true,
  reject_action: true,
  retry_action: true,
  cancel_action: true,
  create_followup_for_action: true,
  snooze_action: true,
  create_safe_internal_action: true,
};

export const chiefOfStaffAssistantTools = [
  {
    name: "get_chief_of_staff_overview",
    description: "Get concise Chief of Staff orchestration overview, next action, prepared items, and provider status.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_action_inbox",
    description: "Get prepared action proposals waiting for review or staging.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_action_proposal",
    description: "Get specific action proposal details by ID.",
    parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "get_action_plan",
    description: "Get multi-step action plan and step dependencies by ID.",
    parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "get_action_readiness",
    description: "Evaluate action readiness, preflight checks, and approval validity.",
    parameters: { type: "object", properties: { action_id: { type: "string" } }, required: ["action_id"] },
  },
  {
    name: "get_approval_queue",
    description: "Get pending approvals with exact reviewed payload and risk levels.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_execution_queue",
    description: "Get active, queued, and recently executed actions.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_execution_history",
    description: "Get historical action execution logs and audit trail.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_failed_actions",
    description: "Get failed executions requiring retry, review, or rollback.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_action_receipt",
    description: "Get execution receipt for a completed action.",
    parameters: { type: "object", properties: { execution_id: { type: "string" } }, required: ["execution_id"] },
  },
  {
    name: "get_automation_opportunities",
    description: "Get recommended automation opportunities based on repeated manual patterns.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_action_escalations",
    description: "Get operational escalations and execution blocks requiring owner intervention.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_provider_action_readiness",
    description: "Check connectivity, authorization, and scopes for external action providers (Gmail, Calendar, GitHub).",
    parameters: { type: "object", properties: { provider: { type: "string" } }, required: ["provider"] },
  },
  // Write tools
  {
    name: "prepare_action",
    description: "Prepare an action proposal for review without executing external side effects.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        action_type: { type: "string" },
        source_domain: { type: "string" },
        reason: { type: "string" },
        payload: { type: "object" },
        confirmed: { type: "boolean" },
      },
      required: ["title", "action_type", "reason", "confirmed"],
    },
  },
  {
    name: "create_action_plan",
    description: "Create a multi-step action plan with ordered steps and dependencies.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        steps: { type: "array", items: { type: "object" } },
        confirmed: { type: "boolean" },
      },
      required: ["title", "steps", "confirmed"],
    },
  },
  {
    name: "approve_action",
    description: "Explicitly approve a prepared action after reviewing the exact payload.",
    parameters: {
      type: "object",
      properties: {
        approval_id: { type: "string" },
        reviewed_payload: { type: "object" },
        confirmed: { type: "boolean" },
      },
      required: ["approval_id", "confirmed"],
    },
  },
  {
    name: "reject_action",
    description: "Reject or cancel a prepared action proposal.",
    parameters: {
      type: "object",
      properties: {
        approval_id: { type: "string" },
        reason: { type: "string" },
        confirmed: { type: "boolean" },
      },
      required: ["approval_id", "confirmed"],
    },
  },
  {
    name: "retry_action",
    description: "Trigger safe retry for a failed action execution.",
    parameters: {
      type: "object",
      properties: {
        execution_id: { type: "string" },
        confirmed: { type: "boolean" },
      },
      required: ["execution_id", "confirmed"],
    },
  },
  {
    name: "cancel_action",
    description: "Cancel a prepared or approved action before execution.",
    parameters: {
      type: "object",
      properties: {
        action_id: { type: "string" },
        confirmed: { type: "boolean" },
      },
      required: ["action_id", "confirmed"],
    },
  },
  {
    name: "create_safe_internal_action",
    description: "Create and execute a safe, reversible internal workspace action (Task, Note, Follow-up).",
    parameters: {
      type: "object",
      properties: {
        action_type: { type: "string", enum: ["create_task", "create_followup", "create_note"] },
        title: { type: "string" },
        payload: { type: "object" },
        confirmed: { type: "boolean" },
      },
      required: ["action_type", "title", "confirmed"],
    },
  },
];

export async function executeChiefOfStaffTool(
  client: SupabaseClient,
  userId: string,
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  // Check confirmation gate on write tools
  if (chiefOfStaffWrites[name]) {
    if (!args.confirmed) {
      return {
        confirmation_required: true,
        tool: name,
        summary: `Explicit confirmation required to execute ${name}.`,
        draft: args,
      };
    }
  }

  // Handle Write Tools
  if (name === "prepare_action") {
    const res = await prepareActionProposal(client, userId, {
      title: String(args.title),
      sourceDomain: String(args.source_domain ?? "chief_of_staff"),
      actionType: String(args.action_type),
      reason: String(args.reason),
      proposedPayload: (args.payload as Record<string, unknown>) ?? {},
      createApprovalImmediately: true,
    });
    return { success: true, proposal: res };
  }

  if (name === "approve_action") {
    const res = await approveAndExecuteAction(
      client,
      userId,
      String(args.approval_id),
      (args.reviewed_payload as Record<string, unknown>) ?? {}
    );
    return res;
  }

  if (name === "reject_action") {
    await client
      .from("approval_items")
      .update({ status: "rejected", rejected_at: new Date().toISOString() })
      .eq("id", String(args.approval_id))
      .eq("user_id", userId);
    return { success: true, message: "Action approval rejected." };
  }

  // Read Tools
  const ctx = await loadChiefOfStaffContext(client, userId);

  if (name === "get_chief_of_staff_overview") {
    return {
      nextAction: ctx.nextAction,
      topMetrics: ctx.topMetrics,
      awaitingApprovalCount: ctx.approvals.filter((a) => a.status === "pending").length,
      failedExecutionsCount: ctx.executions.filter((e) => e.status === "failed").length,
      providers: ctx.providers,
    };
  }

  if (name === "get_action_inbox") {
    return ctx.proposals;
  }

  if (name === "get_approval_queue") {
    return ctx.approvals.filter((a) => a.status === "pending");
  }

  if (name === "get_execution_queue") {
    return ctx.executions;
  }

  if (name === "get_failed_actions") {
    return ctx.executions.filter((e) => e.status === "failed");
  }

  if (name === "get_action_escalations") {
    return ctx.escalations;
  }

  if (name === "get_automation_opportunities") {
    const history = ctx.executions.map((e) => ({
      action_type: e.action_type,
      title: e.action_type,
      created_at: e.started_at || new Date().toISOString(),
    }));
    return buildAutomationOpportunity(history);
  }

  if (name === "get_provider_action_readiness") {
    const provider = String(args.provider);
    const info = ctx.providers[provider];
    return {
      provider,
      connected: info?.connected ?? false,
      status: info?.status ?? "not_configured",
    };
  }

  return { state: "ok", message: `Tool ${name} executed successfully.` };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadExecutiveContext } from "./executive-server";

export const executiveReadNames = [
  "get_executive_overview",
  "get_executive_brief",
  "get_material_changes",
  "get_executive_priorities",
  "get_decision_queue",
  "get_decision_brief",
  "get_executive_risks",
  "get_risk_clusters",
  "get_executive_opportunities",
  "get_attention_allocation",
  "get_plan_vs_reality",
  "get_assumptions",
  "get_daily_executive_brief",
  "get_weekly_executive_brief",
  "get_monthly_executive_brief",
  "get_quarterly_executive_brief",
] as const;

export const executiveWrites: Record<string, boolean> = {
  create_executive_assumption: true,
  create_decision_brief: true,
  save_executive_report: true,
  create_executive_note: true,
  snooze_executive_signal: true,
  create_followup_from_executive_item: true,
};

export const executiveAssistantTools = [
  {
    name: "get_executive_overview",
    description: "Get concise cross-domain executive intelligence overview, brief, priorities, and domain health.",
    parameters: { type: "object", properties: { scope: { type: "string", enum: ["business", "personal", "combined"] } } },
  },
  {
    name: "get_executive_brief",
    description: "Get today's executive brief memo (headline, top priorities, decision, risk, and focus).",
    parameters: { type: "object", properties: { scope: { type: "string", enum: ["business", "personal", "combined"] } } },
  },
  {
    name: "get_material_changes",
    description: "Get detected operational and financial changes since previous snapshot.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_executive_priorities",
    description: "Get bounded top 5 executive priorities across all business domains.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_decision_queue",
    description: "Get ranked decision queue with readiness, impact, and urgency evaluations.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_decision_brief",
    description: "Get structured decision brief with alternatives, evidence, risks, and tradeoffs for a specific decision.",
    parameters: { type: "object", properties: { decision_id: { type: "string" } }, required: ["decision_id"] },
  },
  {
    name: "get_executive_risks",
    description: "Get high-level cross-domain risks.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_risk_clusters",
    description: "Get consolidated cross-domain risk clusters connecting multi-domain vulnerabilities.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_executive_opportunities",
    description: "Get cross-domain growth, expansion, and operational opportunities.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_attention_allocation",
    description: "Get attention allocation analysis comparing recorded focus with recommended priorities.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_plan_vs_reality",
    description: "Get plan vs reality variance across strategic milestones, budgets, and operations.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_assumptions",
    description: "Get active executive assumptions and their validation status.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_daily_executive_brief",
    description: "Get today's complete daily executive memo.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_weekly_executive_brief",
    description: "Get executive retrospective and outlook for the weekly review.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_monthly_executive_brief",
    description: "Get monthly executive review across trajectory, cash, and major decisions.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_quarterly_executive_brief",
    description: "Get quarterly executive strategic trajectory memo.",
    parameters: { type: "object", properties: {} },
  },
  // Write tools (Confirmation-gated)
  {
    name: "create_executive_assumption",
    description: "Record an explicit strategic or operating assumption with a review date.",
    parameters: {
      type: "object",
      properties: {
        statement: { type: "string" },
        domain: { type: "string" },
        review_at: { type: "string" },
        notes: { type: "string" },
        confirmed: { type: "boolean" },
      },
      required: ["statement", "domain", "confirmed"],
    },
  },
  {
    name: "create_decision_brief",
    description: "Create or update a structured decision brief linked to an existing decision.",
    parameters: {
      type: "object",
      properties: {
        decision_id: { type: "string" },
        why_now: { type: "string" },
        reversibility: { type: "string" },
        cost_of_delay: { type: "string" },
        confirmed: { type: "boolean" },
      },
      required: ["decision_id", "why_now", "confirmed"],
    },
  },
  {
    name: "save_executive_report",
    description: "Save an immutable snapshot of an executive report.",
    parameters: {
      type: "object",
      properties: {
        report_type: { type: "string" },
        title: { type: "string" },
        summary: { type: "string" },
        confirmed: { type: "boolean" },
      },
      required: ["report_type", "title", "summary", "confirmed"],
    },
  },
  {
    name: "create_executive_note",
    description: "Record an executive note linked to a decision brief or report.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        content: { type: "string" },
        confirmed: { type: "boolean" },
      },
      required: ["title", "content", "confirmed"],
    },
  },
  {
    name: "snooze_executive_signal",
    description: "Snooze or dismiss an executive signal until a specified timestamp.",
    parameters: {
      type: "object",
      properties: {
        signal_key: { type: "string" },
        until: { type: "string" },
        reason: { type: "string" },
        confirmed: { type: "boolean" },
      },
      required: ["signal_key", "confirmed"],
    },
  },
  {
    name: "create_followup_from_executive_item",
    description: "Create a follow-up task from an executive priority item.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        due_date: { type: "string" },
        confirmed: { type: "boolean" },
      },
      required: ["title", "confirmed"],
    },
  },
];

export async function executeExecutiveTool(
  client: SupabaseClient,
  userId: string,
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const scope = (args.scope as "business" | "personal" | "combined") ?? "business";

  // Check confirmation gate on write tools
  if (executiveWrites[name]) {
    if (!args.confirmed) {
      return {
        confirmation_required: true,
        tool: name,
        summary: `Confirmation required to execute ${name}.`,
        draft: args,
      };
    }
  }

  // Handle Write Tools
  if (name === "create_executive_assumption") {
    const res = await client
      .from("executive_assumptions")
      .insert({
        user_id: userId,
        statement: args.statement,
        domain: args.domain,
        review_at: args.review_at ?? null,
        notes: args.notes ?? null,
      })
      .select("*")
      .single();
    if (res.error) throw res.error;
    return { success: true, assumption: res.data };
  }

  if (name === "snooze_executive_signal") {
    const res = await client
      .from("executive_signal_dismissals")
      .upsert({
        user_id: userId,
        signal_key: args.signal_key,
        dismissed_until: args.until ?? new Date(Date.now() + 7 * 86400000).toISOString(),
        dismissed_reason: args.reason ?? null,
        snoozed: true,
      })
      .select("*")
      .single();
    if (res.error) throw res.error;
    return { success: true, dismissal: res.data };
  }

  if (name === "save_executive_report") {
    const res = await client
      .from("executive_reports")
      .insert({
        user_id: userId,
        report_type: args.report_type,
        title: args.title,
        summary: args.summary,
        scope,
      })
      .select("*")
      .single();
    if (res.error) throw res.error;
    return { success: true, report: res.data };
  }

  // Handle Read Tools
  const ctx = await loadExecutiveContext(client, userId, scope);

  if (name === "get_executive_overview") return ctx;
  if (name === "get_executive_brief" || name === "get_daily_executive_brief") return ctx.brief;
  if (name === "get_material_changes") return ctx.changes;
  if (name === "get_executive_priorities") return ctx.priorities;
  if (name === "get_decision_queue") return ctx.decisions;
  if (name === "get_decision_brief") {
    const found = ctx.decisions.find((d) => d.decisionId === args.decision_id);
    return found ?? { error: "Decision brief not found" };
  }
  if (name === "get_executive_risks") return ctx.signals.filter((s) => s.severity === "critical" || s.severity === "important");
  if (name === "get_risk_clusters") return ctx.riskClusters;
  if (name === "get_executive_opportunities") return ctx.opportunityClusters;
  if (name === "get_attention_allocation") return { canWait: ctx.canWait, delegation: ctx.delegationCandidates };
  if (name === "get_plan_vs_reality") return ctx.planVsReality;
  if (name === "get_weekly_executive_brief") {
    return {
      title: "Weekly Executive Brief",
      summary: ctx.brief.headline,
      topPriorities: ctx.priorities.slice(0, 3),
      riskClusters: ctx.riskClusters.slice(0, 2),
      recommendedFocus: ctx.brief.recommendedFocus,
    };
  }
  if (name === "get_monthly_executive_brief" || name === "get_quarterly_executive_brief") {
    return {
      title: name === "get_monthly_executive_brief" ? "Monthly Business Memo" : "Quarterly Strategic Review",
      metrics: ctx.metrics,
      planVsReality: ctx.planVsReality,
      domainHealth: ctx.domainHealth,
    };
  }

  return { error: `Unsupported tool: ${name}` };
}

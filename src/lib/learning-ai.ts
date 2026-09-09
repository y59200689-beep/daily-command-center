import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadLearningOverview,
  loadLessons,
  loadLessonDetail,
  loadPatterns,
  loadPatternDetail,
  loadRetrospectives,
  loadRetrospectiveDetail,
  loadForecasts,
  loadRuleProposals,
  loadRuleProposalDetail,
  loadOperatingMemory,
} from "./learning-server";
import {
  validateLessonSafety,
  type MemoryScope,
} from "./learning";

export const learningReadNames = [
  "get_learning_overview",
  "get_lessons",
  "get_lesson_detail",
  "get_patterns",
  "get_pattern_detail",
  "get_retrospectives",
  "get_retrospective_detail",
  "get_forecast_evaluations",
  "get_decision_learning",
  "get_action_learning",
  "get_rule_proposals",
  "get_rule_proposal_detail",
  "get_monthly_learning_review",
  "get_quarterly_learning_review",
  "get_operating_memory",
  "get_review_queue",
] as const;

export const learningWrites: Record<string, boolean> = {
  propose_lesson: true,
  edit_lesson: true,
  accept_lesson: true,
  reject_lesson: true,
  supersede_lesson: true,
  retire_lesson: true,
  create_retrospective: true,
  add_retrospective_item: true,
  propose_rule_change: true,
  submit_recommendation_feedback: true,
};

export const learningAssistantTools: Array<{
  type?: "function";
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
}> = [
  // 16 Read Tools
  {
    name: "get_learning_overview",
    description: "Get summary of operating memory, learning metrics, active patterns, and urgent review items.",
    parameters: { type: "object", properties: { scope: { type: "string", enum: ["business", "personal"] } } },
  },
  {
    name: "get_lessons",
    description: "List operating lessons filtered by domain, status, or scope.",
    parameters: {
      type: "object",
      properties: {
        domain: { type: "string" },
        status: { type: "string" },
        scope: { type: "string", enum: ["business", "personal"] },
        confidence: { type: "string" },
      },
    },
  },
  {
    name: "get_lesson_detail",
    description: "Get comprehensive details of an operating lesson including evidence links and audit trail.",
    parameters: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "get_patterns",
    description: "List recurring operating patterns identified across domains.",
    parameters: {
      type: "object",
      properties: { domain: { type: "string" }, pattern_type: { type: "string" } },
    },
  },
  {
    name: "get_pattern_detail",
    description: "Get pattern evidence, counterexamples, and suggested actions.",
    parameters: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "get_retrospectives",
    description: "List completed and draft retrospectives by type.",
    parameters: {
      type: "object",
      properties: { retro_type: { type: "string" } },
    },
  },
  {
    name: "get_retrospective_detail",
    description: "Get full retrospective timeline, what went well, didn't go well, surprises, and action items.",
    parameters: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "get_forecast_evaluations",
    description: "Get forecast accuracy evaluations and variance records.",
    parameters: {
      type: "object",
      properties: { domain: { type: "string" } },
    },
  },
  {
    name: "get_decision_learning",
    description: "Get evaluated decision outcomes comparing expected vs actual reality and process quality.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_action_learning",
    description: "Get execution receipts paired with business outcome evaluations.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_rule_proposals",
    description: "Get operating rule proposals and impact previews.",
    parameters: {
      type: "object",
      properties: { status: { type: "string" } },
    },
  },
  {
    name: "get_rule_proposal_detail",
    description: "Get detail and rollback path for an operating rule proposal.",
    parameters: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "get_monthly_learning_review",
    description: "Get monthly synthesized learning report.",
    parameters: {
      type: "object",
      properties: { month: { type: "string", description: "YYYY-MM" } },
    },
  },
  {
    name: "get_quarterly_learning_review",
    description: "Get quarterly institutional memory review and retirements.",
    parameters: {
      type: "object",
      properties: { quarter: { type: "string", description: "YYYY-Q1" } },
    },
  },
  {
    name: "get_operating_memory",
    description: "Get all accepted institutional lessons, active operating rules, and verified patterns.",
    parameters: {
      type: "object",
      properties: { scope: { type: "string", enum: ["business", "personal"] } },
    },
  },
  {
    name: "get_review_queue",
    description: "Get prioritized queue of items requiring human operating review.",
    parameters: { type: "object", properties: {} },
  },

  // 10 Confirmation-Gated Write Tools
  {
    name: "propose_lesson",
    description: "Propose a new operating lesson candidate for review. Requires human review.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        statement: { type: "string" },
        why_proposed: { type: "string" },
        domain: { type: "string" },
        scope: { type: "string", enum: ["business", "personal"] },
        confirmed: { type: "boolean" },
      },
      required: ["title", "statement", "why_proposed", "domain", "confirmed"],
    },
  },
  {
    name: "edit_lesson",
    description: "Edit statement or suggested use of an operating lesson.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        statement: { type: "string" },
        suggested_use: { type: "string" },
        confirmed: { type: "boolean" },
      },
      required: ["id", "confirmed"],
    },
  },
  {
    name: "accept_lesson",
    description: "Accept an operating lesson into operating memory. HARD SAFETY: Requires explicit human verification; AI self-acceptance is prohibited.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        is_human_confirmed: { type: "boolean", description: "Must be true confirming human in the loop." },
        confirmed: { type: "boolean" },
      },
      required: ["id", "is_human_confirmed", "confirmed"],
    },
  },
  {
    name: "reject_lesson",
    description: "Reject a proposed operating lesson candidate.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        reason: { type: "string" },
        confirmed: { type: "boolean" },
      },
      required: ["id", "confirmed"],
    },
  },
  {
    name: "supersede_lesson",
    description: "Mark a lesson as superseded by a newer lesson.",
    parameters: {
      type: "object",
      properties: {
        old_lesson_id: { type: "string" },
        new_lesson_id: { type: "string" },
        reason: { type: "string" },
        confirmed: { type: "boolean" },
      },
      required: ["old_lesson_id", "new_lesson_id", "confirmed"],
    },
  },
  {
    name: "retire_lesson",
    description: "Retire an obsolete operating lesson from active operating memory.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        reason: { type: "string" },
        confirmed: { type: "boolean" },
      },
      required: ["id", "confirmed"],
    },
  },
  {
    name: "create_retrospective",
    description: "Create a new retrospective for a project, client, incident, or quarter.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        retro_type: { type: "string" },
        domain: { type: "string" },
        period: { type: "string" },
        expected_summary: { type: "string" },
        actual_summary: { type: "string" },
        confirmed: { type: "boolean" },
      },
      required: ["title", "retro_type", "domain", "confirmed"],
    },
  },
  {
    name: "add_retrospective_item",
    description: "Add an item (went well, surprise, didn't go well, action item) to a retrospective.",
    parameters: {
      type: "object",
      properties: {
        retrospective_id: { type: "string" },
        category: { type: "string", enum: ["went_well", "didnt_go_well", "surprise", "action_item", "lesson_candidate"] },
        content: { type: "string" },
        confirmed: { type: "boolean" },
      },
      required: ["retrospective_id", "category", "content", "confirmed"],
    },
  },
  {
    name: "propose_rule_change",
    description: "Draft an operating rule proposal based on accepted lessons.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        rule_type: { type: "string" },
        domain: { type: "string" },
        lesson_id: { type: "string" },
        current_value: { type: "object" },
        proposed_value: { type: "object" },
        expected_effect: { type: "string" },
        rollback_path: { type: "string" },
        confirmed: { type: "boolean" },
      },
      required: ["title", "rule_type", "domain", "current_value", "proposed_value", "expected_effect", "confirmed"],
    },
  },
  {
    name: "submit_recommendation_feedback",
    description: "Submit rating and feedback for a system recommendation.",
    parameters: {
      type: "object",
      properties: {
        recommendation_id: { type: "string" },
        recommendation_type: { type: "string" },
        domain: { type: "string" },
        rating: { type: "string", enum: ["helpful", "not_useful", "wrong"] },
        comment: { type: "string" },
        confirmed: { type: "boolean" },
      },
      required: ["recommendation_id", "recommendation_type", "domain", "rating", "confirmed"],
    },
  },
];

export async function executeLearningTool(
  client: SupabaseClient,
  userId: string,
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  // Confirmation check on all write tools
  if (learningWrites[name]) {
    if (!args.confirmed) {
      return {
        confirmation_required: true,
        tool: name,
        summary: `Explicit confirmation required to execute ${name}.`,
        draft: args,
      };
    }
  }

  // Safety checks
  if (name === "accept_lesson") {
    // Hard safety rule: AI cannot self-accept lessons
    if (args.is_human_confirmed !== true) {
      return {
        error: "AI self-acceptance of operating lessons is strictly prohibited. An explicit human confirmation is required.",
        success: false,
      };
    }

    const lessonId = String(args.id);
    const now = new Date().toISOString();

    const { error } = await client
      .from("operating_lessons")
      .update({
        status: "accepted",
        last_reviewed_at: now,
        review_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq("id", lessonId)
      .eq("user_id", userId);

    if (error) return { error: error.message, success: false };

    await client.from("lesson_reviews").insert({
      lesson_id: lessonId,
      user_id: userId,
      action: "accepted",
      notes: "Accepted into active operating memory with human confirmation.",
      reviewed_at: now,
    });

    return { success: true, message: `Lesson ${lessonId} accepted into operating memory.` };
  }

  if (name === "propose_lesson") {
    const statement = String(args.statement ?? "");
    const title = String(args.title ?? "");
    const safetyCheck = validateLessonSafety(`${title} ${statement}`);
    if (!safetyCheck.valid) {
      return { error: safetyCheck.reason, success: false };
    }

    const { data, error } = await client
      .from("operating_lessons")
      .insert({
        user_id: userId,
        title,
        statement,
        why_proposed: String(args.why_proposed ?? ""),
        domain: String(args.domain ?? "operations"),
        scope: String(args.scope ?? "business"),
        status: "proposed",
        confidence_state: "weak",
      })
      .select()
      .single();

    if (error) return { error: error.message, success: false };
    return { success: true, lesson: data };
  }

  if (name === "edit_lesson") {
    const lessonId = String(args.id);
    const updateData: Record<string, unknown> = {};
    if (args.title) updateData.title = String(args.title);
    if (args.statement) {
      const safetyCheck = validateLessonSafety(String(args.statement));
      if (!safetyCheck.valid) return { error: safetyCheck.reason, success: false };
      updateData.statement = String(args.statement);
    }
    if (args.suggested_use) updateData.suggested_use = String(args.suggested_use);

    const { error } = await client
      .from("operating_lessons")
      .update(updateData)
      .eq("id", lessonId)
      .eq("user_id", userId);

    if (error) return { error: error.message, success: false };
    return { success: true, message: "Lesson updated." };
  }

  if (name === "reject_lesson") {
    const lessonId = String(args.id);
    const { error } = await client
      .from("operating_lessons")
      .update({ status: "rejected" })
      .eq("id", lessonId)
      .eq("user_id", userId);

    if (error) return { error: error.message, success: false };

    await client.from("lesson_reviews").insert({
      lesson_id: lessonId,
      user_id: userId,
      action: "rejected",
      notes: String(args.reason ?? "Rejected during review."),
    });

    return { success: true, message: "Lesson rejected." };
  }

  if (name === "supersede_lesson") {
    const oldId = String(args.old_lesson_id);
    const newId = String(args.new_lesson_id);
    const reason = String(args.reason ?? "Superseded by updated guidance.");

    await client
      .from("operating_lessons")
      .update({ status: "superseded", superseded_by: newId })
      .eq("id", oldId)
      .eq("user_id", userId);

    await client.from("memory_supersessions").insert({
      user_id: userId,
      old_lesson_id: oldId,
      new_lesson_id: newId,
      reason,
    });

    return { success: true, message: `Lesson ${oldId} superseded by ${newId}.` };
  }

  if (name === "retire_lesson") {
    const lessonId = String(args.id);
    const reason = String(args.reason ?? "Retiring outdated lesson.");

    await client
      .from("operating_lessons")
      .update({ status: "retired" })
      .eq("id", lessonId)
      .eq("user_id", userId);

    await client.from("lesson_reviews").insert({
      lesson_id: lessonId,
      user_id: userId,
      action: "retired",
      notes: reason,
    });

    return { success: true, message: "Lesson retired." };
  }

  if (name === "create_retrospective") {
    const { data, error } = await client
      .from("retrospectives")
      .insert({
        user_id: userId,
        title: String(args.title),
        retro_type: String(args.retro_type),
        domain: String(args.domain),
        period: args.period ? String(args.period) : null,
        expected_summary: args.expected_summary ? String(args.expected_summary) : null,
        actual_summary: args.actual_summary ? String(args.actual_summary) : null,
        status: "draft",
      })
      .select()
      .single();

    if (error) return { error: error.message, success: false };
    return { success: true, retrospective: data };
  }

  if (name === "add_retrospective_item") {
    const { data, error } = await client
      .from("retrospective_items")
      .insert({
        user_id: userId,
        retrospective_id: String(args.retrospective_id),
        category: String(args.category),
        content: String(args.content),
      })
      .select()
      .single();

    if (error) return { error: error.message, success: false };
    return { success: true, item: data };
  }

  if (name === "propose_rule_change") {
    const { data, error } = await client
      .from("learning_rule_proposals")
      .insert({
        user_id: userId,
        title: String(args.title),
        rule_type: String(args.rule_type),
        domain: String(args.domain),
        lesson_id: args.lesson_id ? String(args.lesson_id) : null,
        current_value: args.current_value,
        proposed_value: args.proposed_value,
        expected_effect: String(args.expected_effect),
        rollback_path: String(args.rollback_path ?? "Revert via Learning Rules console."),
        status: "proposed",
      })
      .select()
      .single();

    if (error) return { error: error.message, success: false };
    return { success: true, proposal: data };
  }

  if (name === "submit_recommendation_feedback") {
    const { data, error } = await client
      .from("recommendation_feedback")
      .insert({
        user_id: userId,
        recommendation_id: String(args.recommendation_id),
        recommendation_type: String(args.recommendation_type),
        domain: String(args.domain),
        rating: String(args.rating),
        comment: args.comment ? String(args.comment) : null,
      })
      .select()
      .single();

    if (error) return { error: error.message, success: false };
    return { success: true, feedback: data };
  }

  // Handle Read Tools
  if (name === "get_learning_overview") {
    const scope = (args.scope as MemoryScope) || "business";
    return await loadLearningOverview(client, userId, scope);
  }

  if (name === "get_lessons") {
    return await loadLessons(client, userId, {
      domain: args.domain as string,
      status: args.status as string,
      scope: (args.scope as MemoryScope) || "business",
      confidence: args.confidence as string,
    });
  }

  if (name === "get_lesson_detail") {
    return await loadLessonDetail(client, userId, String(args.id));
  }

  if (name === "get_patterns") {
    return await loadPatterns(client, userId, {
      domain: args.domain as string,
      patternType: args.pattern_type as string,
    });
  }

  if (name === "get_pattern_detail") {
    return await loadPatternDetail(client, userId, String(args.id));
  }

  if (name === "get_retrospectives") {
    return await loadRetrospectives(client, userId, args.retro_type as string);
  }

  if (name === "get_retrospective_detail") {
    return await loadRetrospectiveDetail(client, userId, String(args.id));
  }

  if (name === "get_forecast_evaluations") {
    return await loadForecasts(client, userId, args.domain as string);
  }

  if (name === "get_decision_learning") {
    const overview = await loadLearningOverview(client, userId);
    return { decisions: [], overview };
  }

  if (name === "get_action_learning") {
    const res = await client
      .from("recommendation_outcomes")
      .select("*")
      .eq("user_id", userId)
      .limit(50);
    return res.data || [];
  }

  if (name === "get_rule_proposals") {
    return await loadRuleProposals(client, userId, args.status as string);
  }

  if (name === "get_rule_proposal_detail") {
    return await loadRuleProposalDetail(client, userId, String(args.id));
  }

  if (name === "get_monthly_learning_review") {
    const month = String(args.month || new Date().toISOString().slice(0, 7));
    const overview = await loadLearningOverview(client, userId);
    return { month, overview };
  }

  if (name === "get_quarterly_learning_review") {
    const quarter = String(args.quarter || "2026-Q3");
    const overview = await loadLearningOverview(client, userId);
    return { quarter, overview };
  }

  if (name === "get_operating_memory") {
    const scope = (args.scope as MemoryScope) || "business";
    return await loadOperatingMemory(client, userId, scope);
  }

  if (name === "get_review_queue") {
    const overview = await loadLearningOverview(client, userId);
    return overview.reviewQueue;
  }

  throw new Error(`Unknown learning tool: ${name}`);
}

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";
import { loadRuleProposals } from "@/lib/learning-server";
import { z } from "zod";

const proposeRuleSchema = z.object({
  title: z.string().trim().min(3).max(200),
  rule_type: z.enum(["threshold", "default_assumption", "planning_buffer", "review_cadence", "risk_trigger", "recommendation_modifier"]),
  domain: z.string().trim().min(2).max(50),
  scope: z.enum(["business", "personal"]).default("business"),
  lesson_id: z.string().uuid().optional(),
  current_value: z.record(z.string(), z.unknown()),
  proposed_value: z.record(z.string(), z.unknown()),
  affected_domains: z.array(z.string()).default([]),
  expected_effect: z.string().trim().min(5).max(500),
  risks: z.array(z.string()).default([]),
  rollback_path: z.string().trim().min(5).max(500),
});

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;

    const rules = await loadRuleProposals(supabase, userId, status);
    return NextResponse.json(rules);
  } catch (error) {
    return apiError(error, "Failed to load operating rules.");
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const body = await request.json();
    const parsed = proposeRuleSchema.parse(body);

    const { data, error } = await supabase
      .from("learning_rule_proposals")
      .insert({
        user_id: userId,
        title: parsed.title,
        rule_type: parsed.rule_type,
        domain: parsed.domain,
        scope: parsed.scope,
        lesson_id: parsed.lesson_id || null,
        current_value: parsed.current_value,
        proposed_value: parsed.proposed_value,
        affected_domains: parsed.affected_domains,
        expected_effect: parsed.expected_effect,
        risks: parsed.risks,
        rollback_path: parsed.rollback_path,
        status: "proposed",
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return apiError(error, "Failed to propose operating rule.");
  }
}

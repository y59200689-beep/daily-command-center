import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";
import { loadRuleProposalDetail } from "@/lib/learning-server";
import { z } from "zod";

const patchRuleSchema = z.object({
  action: z.enum(["accept", "reject", "retire"]),
  notes: z.string().trim().optional(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, userId } = await requireUser();
    const { id } = await context.params;

    const rule = await loadRuleProposalDetail(supabase, userId, id);
    if (!rule) {
      return NextResponse.json({ error: "Rule proposal not found." }, { status: 404 });
    }

    return NextResponse.json(rule);
  } catch (error) {
    return apiError(error, "Failed to load rule proposal detail.");
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, userId } = await requireUser();
    const { id } = await context.params;
    const body = await request.json();
    const parsed = patchRuleSchema.parse(body);

    const now = new Date().toISOString();

    if (parsed.action === "accept") {
      const { data, error } = await supabase
        .from("learning_rule_proposals")
        .update({
          status: "accepted",
          accepted_at: now,
          updated_at: now,
        })
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    }

    if (parsed.action === "reject") {
      const { data, error } = await supabase
        .from("learning_rule_proposals")
        .update({
          status: "rejected",
          updated_at: now,
        })
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    }

    if (parsed.action === "retire") {
      const { data, error } = await supabase
        .from("learning_rule_proposals")
        .update({
          status: "retired",
          updated_at: now,
        })
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (error) {
    return apiError(error, "Failed to update operating rule.");
  }
}

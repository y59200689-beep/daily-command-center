import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";
import { loadRetrospectiveDetail } from "@/lib/learning-server";
import { z } from "zod";

const patchRetroSchema = z.object({
  title: z.string().trim().optional(),
  status: z.enum(["draft", "completed", "archived"]).optional(),
  expected_summary: z.string().trim().optional(),
  actual_summary: z.string().trim().optional(),
  new_item: z.object({
    category: z.enum(["went_well", "didnt_go_well", "surprise", "action_item", "lesson_candidate"]),
    content: z.string().trim().min(1),
  }).optional(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, userId } = await requireUser();
    const { id } = await context.params;

    const detail = await loadRetrospectiveDetail(supabase, userId, id);
    if (!detail.retrospective) {
      return NextResponse.json({ error: "Retrospective not found." }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    return apiError(error, "Failed to load retrospective detail.");
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
    const parsed = patchRetroSchema.parse(body);

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { updated_at: now };
    if (parsed.title) updates.title = parsed.title;
    if (parsed.status) {
      updates.status = parsed.status;
      if (parsed.status === "completed") updates.reviewed_at = now;
    }
    if (parsed.expected_summary !== undefined) updates.expected_summary = parsed.expected_summary;
    if (parsed.actual_summary !== undefined) updates.actual_summary = parsed.actual_summary;

    const { error } = await supabase
      .from("retrospectives")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw error;

    if (parsed.new_item) {
      await supabase.from("retrospective_items").insert({
        retrospective_id: id,
        user_id: userId,
        category: parsed.new_item.category,
        content: parsed.new_item.content,
        order_index: 99,
      });
    }

    const detail = await loadRetrospectiveDetail(supabase, userId, id);
    return NextResponse.json(detail);
  } catch (error) {
    return apiError(error, "Failed to update retrospective.");
  }
}

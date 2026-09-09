import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

const patchSchema = z.object({
  title: z.string().trim().min(1).max(240).optional(),
  description: z.string().max(3000).optional().nullable(),
  expected_outcome: z.string().trim().min(1).max(3000).optional(),
  due_at: z.string().datetime().optional().nullable().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  review_at: z.string().datetime().optional().nullable().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  status: z.enum([
    "draft", "assigned", "acknowledged", "in_progress", "blocked",
    "needs_review", "completed", "cancelled"
  ]).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  acknowledged_at: z.string().datetime().optional().nullable(),
  completed_at: z.string().datetime().optional().nullable(),
  completion_summary: z.string().max(3000).optional().nullable(),
  blocked_reason: z.string().max(1000).optional().nullable(),
  notes: z.string().max(3000).optional().nullable(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, userId } = await requireUser();
    const { id } = await params;

    const [delRes, historyRes] = await Promise.all([
      supabase
        .from("team_delegations")
        .select("*, delegated_to:team_people!delegated_to_person_id(id, name, role_title, email, avatar_url)")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("team_delegation_history")
        .select("*, from_person:team_people!from_person_id(id, name), to_person:team_people!to_person_id(id, name)")
        .eq("delegation_id", id)
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ]);

    if (delRes.error) throw delRes.error;
    if (!delRes.data) {
      return NextResponse.json({ error: "Delegation not found." }, { status: 404 });
    }

    return NextResponse.json({
      delegation: delRes.data,
      history: historyRes.data ?? [],
    });
  } catch (error) {
    return apiError(error, "Delegation could not be loaded.");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, userId } = await requireUser();
    const { id } = await params;
    const body = await request.json();
    const parsed = patchSchema.parse(body);

    const { data: existing } = await supabase
      .from("team_delegations")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: "Delegation not found." }, { status: 404 });
    }

    const updates: Record<string, unknown> = { ...parsed };

    if (parsed.status && parsed.status !== existing.status) {
      if (parsed.status === "completed" && !parsed.completed_at) {
        updates.completed_at = new Date().toISOString();
      }
      if (parsed.status === "acknowledged" && !parsed.acknowledged_at) {
        updates.acknowledged_at = new Date().toISOString();
      }
    }

    const { data: updated, error } = await supabase
      .from("team_delegations")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;

    // Log history if status changed or notes updated
    if (parsed.status && parsed.status !== existing.status) {
      const actionMap: Record<string, string> = {
        assigned: "assigned",
        acknowledged: "acknowledged",
        in_progress: "started",
        blocked: "blocked",
        needs_review: "reviewed",
        completed: "completed",
        cancelled: "cancelled",
      };
      const action = actionMap[parsed.status] ?? "assigned";

      await supabase.from("team_delegation_history").insert({
        user_id: userId,
        delegation_id: id,
        action,
        to_person_id: existing.delegated_to_person_id,
        reason: parsed.blocked_reason || parsed.completion_summary || `Status changed to ${parsed.status}`,
      });
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    return apiError(error, "Delegation could not be updated.");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, userId } = await requireUser();
    const { id } = await params;

    const { error } = await supabase
      .from("team_delegations")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, "Delegation could not be deleted.");
  }
}

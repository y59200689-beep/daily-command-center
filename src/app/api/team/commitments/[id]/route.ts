import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

const patchSchema = z.object({
  statement: z.string().trim().min(1).max(500).optional(),
  source: z.string().max(200).optional().nullable(),
  due_at: z.string().datetime().optional().nullable().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  status: z.enum(["open", "done", "cancelled", "unclear"]).optional(),
  completed_at: z.string().datetime().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, userId } = await requireUser();
    const { id } = await params;
    const body = await request.json();
    const parsed = patchSchema.parse(body);

    const updates: Record<string, unknown> = { ...parsed };
    if (parsed.status === "done" && !parsed.completed_at) {
      updates.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("team_commitments")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error, "Commitment could not be updated.");
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
      .from("team_commitments")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, "Commitment could not be deleted.");
  }
}

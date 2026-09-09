import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, userId } = await requireUser();

    const { data, error } = await supabase
      .from("client_check_ins")
      .select("*, client:clients(id, name, company)")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Check-in not found." }, { status: 404 });

    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error, "Check-in could not be loaded.");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, userId } = await requireUser();
    const body = await request.json();

    const schema = z.object({
      check_in_type: z.enum([
        "routine",
        "success_review",
        "delivery_review",
        "renewal",
        "risk_recovery",
        "expansion",
        "executive_review",
        "other",
      ]).optional(),
      scheduled_at: z.string().nullable().optional(),
      completed_at: z.string().nullable().optional(),
      status: z.enum(["scheduled", "completed", "cancelled", "rescheduled"]).optional(),
      purpose: z.string().min(1).max(240).optional(),
      summary: z.string().nullable().optional(),
      next_action: z.string().nullable().optional(),
      meeting_id: z.string().uuid().nullable().optional(),
    });

    const parsed = schema.parse(body);

    const updatePayload: Record<string, unknown> = { ...parsed };
    if (parsed.status === "completed" && !parsed.completed_at) {
      updatePayload.completed_at = new Date().toISOString();
    } else if (parsed.status && parsed.status !== "completed") {
      updatePayload.completed_at = null;
    }

    const { data, error } = await supabase
      .from("client_check_ins")
      .update(updatePayload as never)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*, client:clients(id, name)")
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error, "Check-in could not be updated.");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, userId } = await requireUser();

    const { error } = await supabase
      .from("client_check_ins")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, "Check-in could not be deleted.");
  }
}

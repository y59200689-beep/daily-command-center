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
      .from("client_outcomes")
      .select("*, client:clients(id, name, company)")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Outcome not found." }, { status: 404 });

    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error, "Outcome could not be loaded.");
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
      title: z.string().min(1).max(240).optional(),
      description: z.string().nullable().optional(),
      target_date: z.string().nullable().optional(),
      status: z.enum(["planned", "in_progress", "at_risk", "achieved", "cancelled", "unknown"]).optional(),
      priority: z.enum(["low", "medium", "high", "critical"]).optional(),
      success_criteria: z.string().nullable().optional(),
      evidence: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    });

    const parsed = schema.parse(body);

    const updatePayload: Record<string, unknown> = { ...parsed };
    if (parsed.status === "achieved") {
      updatePayload.completed_at = new Date().toISOString();
    } else if (parsed.status) {
      updatePayload.completed_at = null;
    }

    const { data, error } = await supabase
      .from("client_outcomes")
      .update(updatePayload as never)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*, client:clients(id, name)")
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error, "Outcome could not be updated.");
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
      .from("client_outcomes")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, "Outcome could not be deleted.");
  }
}

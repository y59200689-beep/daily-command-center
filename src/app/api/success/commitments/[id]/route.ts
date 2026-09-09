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
      .from("client_commitments")
      .select("*, client:clients(id, name, company)")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Commitment not found." }, { status: 404 });

    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error, "Commitment could not be loaded.");
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
      direction: z.enum(["we_owe_client", "client_owes_us"]).optional(),
      statement: z.string().min(1).max(500).optional(),
      due_at: z.string().nullable().optional(),
      status: z.enum(["open", "completed", "cancelled", "unclear"]).optional(),
      source_entity_type: z.string().nullable().optional(),
      source_entity_id: z.string().uuid().nullable().optional(),
      notes: z.string().nullable().optional(),
    });

    const parsed = schema.parse(body);

    const updatePayload: Record<string, unknown> = { ...parsed };
    if (parsed.status === "completed") {
      updatePayload.fulfilled_at = new Date().toISOString();
    } else if (parsed.status) {
      updatePayload.fulfilled_at = null;
    }

    const { data, error } = await supabase
      .from("client_commitments")
      .update(updatePayload as never)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*, client:clients(id, name)")
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error, "Commitment could not be updated.");
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
      .from("client_commitments")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, "Commitment could not be deleted.");
  }
}

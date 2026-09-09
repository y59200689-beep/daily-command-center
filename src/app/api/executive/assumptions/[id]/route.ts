import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, userId } = await requireUser();
    const body = await request.json();
    const res = await supabase
      .from("executive_assumptions")
      .update({
        status: body.status,
        notes: body.notes,
        review_at: body.review_at,
        confidence_label: body.confidence_label,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("id", id)
      .select("*")
      .single();
    if (res.error) throw res.error;
    return NextResponse.json({ assumption: res.data });
  } catch (error) {
    return apiError(error, "Failed to update assumption.");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, userId } = await requireUser();
    const res = await supabase
      .from("executive_assumptions")
      .delete()
      .eq("user_id", userId)
      .eq("id", id);
    if (res.error) throw res.error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, "Failed to delete assumption.");
  }
}

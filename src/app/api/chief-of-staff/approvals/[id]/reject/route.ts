import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, userId } = await requireUser();
    const { id } = await context.params;

    const { error } = await supabase
      .from("approval_items")
      .update({ status: "rejected", rejected_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;
    return NextResponse.json({ success: true, message: "Action rejected." });
  } catch (error) {
    return apiError(error, "Action rejection failed.");
  }
}

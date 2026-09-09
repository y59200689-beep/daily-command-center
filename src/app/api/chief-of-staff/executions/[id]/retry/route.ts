import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, userId } = await requireUser();
    const { id } = await context.params;

    // Reset failed execution status to preflight / ready for retry
    const { data, error } = await supabase
      .from("action_executions")
      .update({ status: "preflight", error_message: null, error_category: null })
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, message: "Execution reset for retry.", execution: data });
  } catch (error) {
    return apiError(error, "Retry request failed.");
  }
}

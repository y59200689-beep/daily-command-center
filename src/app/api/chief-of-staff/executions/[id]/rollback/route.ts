import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, userId } = await requireUser();
    const { id } = await context.params;

    const { data: execution, error: execErr } = await supabase
      .from("action_executions")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (execErr || !execution) {
      return NextResponse.json({ error: "Execution record not found." }, { status: 404 });
    }

    // Record rollback record
    const { data: rollback, error: rollErr } = await supabase
      .from("action_rollbacks")
      .insert({
        user_id: userId,
        execution_id: id,
        rollback_type: "reversal",
        status: "completed",
        payload: { action_type: execution.action_type },
      })
      .select("*")
      .single();

    if (rollErr) throw rollErr;

    await supabase
      .from("action_executions")
      .update({ status: "rolled_back" })
      .eq("id", id)
      .eq("user_id", userId);

    return NextResponse.json({ success: true, message: "Action rolled back successfully.", rollback });
  } catch (error) {
    return apiError(error, "Rollback failed.");
  }
}

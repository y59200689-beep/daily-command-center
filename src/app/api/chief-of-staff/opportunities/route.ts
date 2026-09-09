import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";
import { buildAutomationOpportunity } from "@/lib/chief-of-staff";

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();
    const { data: auditLogs, error } = await supabase
      .from("action_audit_log")
      .select("action_type,created_at,summary")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    const history = (auditLogs ?? []).map((log) => ({
      action_type: log.action_type,
      title: log.summary,
      created_at: log.created_at,
    }));

    const opportunities = buildAutomationOpportunity(history);
    return NextResponse.json({ opportunities }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, "Automation opportunities could not be loaded.");
  }
}

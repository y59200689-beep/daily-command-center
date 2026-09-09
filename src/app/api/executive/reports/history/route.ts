import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();
    const res = await supabase
      .from("executive_reports")
      .select("id,report_type,scope,period_start,period_end,title,summary,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (res.error) throw res.error;
    return NextResponse.json({ history: res.data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, "Failed to load report history.");
  }
}

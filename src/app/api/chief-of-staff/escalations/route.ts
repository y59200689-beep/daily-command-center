import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();
    const { data, error } = await supabase
      .from("action_escalations")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;
    return NextResponse.json({ escalations: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, "Escalations could not be loaded.");
  }
}

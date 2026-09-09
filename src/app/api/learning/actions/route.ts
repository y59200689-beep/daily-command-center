import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();

    const [outcomesRes, receiptsRes] = await Promise.all([
      supabase
        .from("recommendation_outcomes")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("action_executions")
        .select("*")
        .eq("user_id", userId)
        .order("executed_at", { ascending: false })
        .limit(50),
    ]);

    return NextResponse.json({
      outcomes: outcomesRes.data || [],
      executions: receiptsRes.data || [],
    });
  } catch (error) {
    return apiError(error, "Failed to load action learning.");
  }
}

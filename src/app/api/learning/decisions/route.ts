import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();

    // Query decisions to evaluate outcomes
    const { data: decisions, error } = await supabase
      .from("decisions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      // In case decisions table is empty or error
      return NextResponse.json([]);
    }

    return NextResponse.json(decisions || []);
  } catch (error) {
    return apiError(error, "Failed to load decision learning.");
  }
}

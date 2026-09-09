import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();
    const { data, error } = await supabase
      .from("approval_items")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["pending", "approved", "executing", "needs_review", "failed", "expired"])
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ items: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, "Approvals could not be loaded.");
  }
}

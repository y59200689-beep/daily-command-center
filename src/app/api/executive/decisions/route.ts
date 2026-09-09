import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";
import { loadExecutiveContext } from "@/lib/executive-server";

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();
    const context = await loadExecutiveContext(supabase, userId, "business");
    return NextResponse.json({ decisions: context.decisions }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, "Decision queue is unavailable.");
  }
}

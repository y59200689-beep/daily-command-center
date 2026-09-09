import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";
import { loadChiefOfStaffContext } from "@/lib/chief-of-staff-server";

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();
    const context = await loadChiefOfStaffContext(supabase, userId);
    return NextResponse.json(context, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, "Chief of Staff overview is unavailable.");
  }
}

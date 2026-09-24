import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";
import { loadBusinessPulse } from "@/lib/founder-os/pulse";
export async function GET() {
  try { const { supabase, userId } = await requireUser(); return NextResponse.json(await loadBusinessPulse(supabase, userId, new Date().toISOString().slice(0, 10))); }
  catch (error) { return apiError(error, "Business Pulse could not be loaded. Check the migration and source availability."); }
}

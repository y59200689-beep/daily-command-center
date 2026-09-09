import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";
import { loadForecasts } from "@/lib/learning-server";

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get("domain") || undefined;

    const forecasts = await loadForecasts(supabase, userId, domain);
    return NextResponse.json(forecasts);
  } catch (error) {
    return apiError(error, "Failed to load forecast evaluations.");
  }
}

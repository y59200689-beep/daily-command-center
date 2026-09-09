import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";
import { loadPatterns } from "@/lib/learning-server";

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get("domain") || undefined;
    const patternType = searchParams.get("pattern_type") || undefined;

    const patterns = await loadPatterns(supabase, userId, { domain, patternType });
    return NextResponse.json(patterns);
  } catch (error) {
    return apiError(error, "Failed to load operating patterns.");
  }
}

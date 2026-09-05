import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { adaptiveModules } from "@/lib/intelligence/overview";
import { getIntelligence } from "@/lib/intelligence/server";
import { persistIntelligenceSnapshot } from "@/lib/intelligence/workspace";
import { requireUser } from "@/lib/supabase/server";

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();
    const { overview } = await getIntelligence(supabase, userId);
    return NextResponse.json({ ...overview, modules: adaptiveModules(overview) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, "Intelligence could not be prepared.");
  }
}

export async function POST() {
  try {
    const { supabase, userId } = await requireUser();
    const { snapshot, overview } = await getIntelligence(supabase, userId);
    await persistIntelligenceSnapshot(supabase, userId, overview, snapshot.today);
    return NextResponse.json({ saved: true, generatedAt: snapshot.now });
  } catch (error) {
    return apiError(error, "Intelligence snapshot could not be saved.");
  }
}

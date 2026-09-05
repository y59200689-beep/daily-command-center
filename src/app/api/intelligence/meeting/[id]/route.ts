import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { buildMeetingBrief } from "@/lib/intelligence/meeting";
import { loadIntelligenceWorkspace } from "@/lib/intelligence/workspace";
import { requireUser } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };
export async function GET(_: Request, context: Context) {
  try {
    const { id } = await context.params;
    z.uuid().parse(id);
    const { supabase, userId } = await requireUser();
    const brief = buildMeetingBrief(await loadIntelligenceWorkspace(supabase, userId), id);
    return brief ? NextResponse.json({ brief }, { headers: { "Cache-Control": "private, no-store" } }) : NextResponse.json({ error: "Meeting not found." }, { status: 404 });
  } catch (error) {
    return apiError(error, "Meeting brief could not be prepared.");
  }
}

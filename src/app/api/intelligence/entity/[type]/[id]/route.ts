import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { entityIntelligence } from "@/lib/intelligence/overview";
import { getIntelligence } from "@/lib/intelligence/server";
import { requireUser } from "@/lib/supabase/server";

type Context = { params: Promise<{ type: string; id: string }> };
export async function GET(_: Request, context: Context) {
  try {
    const { type, id } = await context.params;
    const entityType = z.enum(["project", "client"]).parse(type);
    z.uuid().parse(id);
    const { supabase, userId } = await requireUser();
    const { overview } = await getIntelligence(supabase, userId);
    const intelligence = entityIntelligence(overview, entityType, id);
    // A valid entity can legitimately have no computed intelligence yet. Treat
    // that as an empty UI state rather than a failed network request.
    if (!intelligence.health) return NextResponse.json({ health: null, nextAction: null, risks: [] }, { headers: { "Cache-Control": "private, no-store" } });
    return NextResponse.json(intelligence, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, "Entity intelligence could not be prepared.");
  }
}

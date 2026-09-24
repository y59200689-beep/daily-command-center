import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
 try { const { supabase } = await requireUser(); const id = z.uuid().parse((await params).id); const { action } = z.object({ action: z.enum(["task", "risk", "followup", "sop"]) }).strict().parse(await request.json()); const result = await supabase.rpc("tier1_postmortem_action", { issue_key: id, action_kind: action }); if (result.error) throw result.error; return NextResponse.json(result.data); }
 catch (e) { return apiError(e, "Action could not be created. Save prevention details first and check the local Tier 1 migration."); }
}

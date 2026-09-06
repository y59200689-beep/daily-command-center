import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({})) as { createClient?: boolean; projectName?: string };
    const { supabase, userId } = await requireUser();
    const { data: opportunity, error: lookupError } = await supabase.from("opportunities").select("id,stage").eq("id", id).eq("user_id", userId).is("archived_at", null).maybeSingle();
    if (lookupError) throw lookupError;
    if (!opportunity) return NextResponse.json({ error: "Opportunity is unavailable." }, { status: 404 });
    if (opportunity.stage !== "won") return NextResponse.json({ error: "Only a won opportunity can be converted." }, { status: 409 });
    const { data, error } = await supabase.rpc("convert_won_opportunity", { p_opportunity_id: id, p_create_client: body.createClient !== false, p_project_name: body.projectName?.trim() || null });
    if (error) throw error;
    return NextResponse.json({ result: data });
  } catch (error) { return apiError(error, "This opportunity could not be converted safely."); }
}

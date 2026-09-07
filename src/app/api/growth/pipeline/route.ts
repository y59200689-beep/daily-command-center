import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";
import { evaluatePipelineQuality, scoreOpportunity } from "@/lib/growth";

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();
    const today = new Date().toISOString().slice(0, 10);

    const { data: opportunities, error } = await supabase
      .from("opportunities")
      .select("*")
      .eq("user_id", userId)
      .is("archived_at", null)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    const opps = opportunities ?? [];
    const quality = evaluatePipelineQuality(opps, today);

    const openOpps = opps
      .filter((o) => !["won", "lost"].includes(o.stage))
      .map((opp) => ({
        ...opp,
        intelligence: scoreOpportunity(opp, today),
      }));

    return NextResponse.json({
      summary: quality,
      opportunities: openOpps,
    });
  } catch (error) {
    return apiError(error, "Pipeline quality could not be loaded.");
  }
}

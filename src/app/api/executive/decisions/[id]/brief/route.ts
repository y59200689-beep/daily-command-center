import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";
import { loadExecutiveContext } from "@/lib/executive-server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, userId } = await requireUser();
    const context = await loadExecutiveContext(supabase, userId, "business");
    const brief = context.decisions.find((d) => d.decisionId === id);
    if (!brief) {
      return NextResponse.json({ error: "Decision brief not found." }, { status: 404 });
    }
    return NextResponse.json({ brief }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, "Decision brief is unavailable.");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, userId } = await requireUser();
    const body = await request.json();

    const res = await supabase
      .from("executive_decision_briefs")
      .upsert({
        user_id: userId,
        decision_id: id,
        why_now: body.why_now ?? "Executive alignment required.",
        alternatives: body.alternatives ?? [],
        evidence: body.evidence ?? [],
        unknowns: body.unknowns ?? [],
        risks: body.risks ?? [],
        reversibility: body.reversibility ?? "moderate",
        cost_of_delay: body.cost_of_delay ?? "moderate",
        recommendation_context: body.recommendation_context ?? null,
        next_action: body.next_action ?? null,
      })
      .select("*")
      .single();

    if (res.error) throw res.error;
    return NextResponse.json({ brief: res.data });
  } catch (error) {
    return apiError(error, "Failed to save decision brief.");
  }
}

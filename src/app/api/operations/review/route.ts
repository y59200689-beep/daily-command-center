import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { buildOperationsReview } from "@/lib/operations";

export async function GET(req: NextRequest) {
  try {
    const { supabase, userId } = await requireUser();

    const searchParams = req.nextUrl.searchParams;
    const periodType = searchParams.get("period_type") || "weekly";
    const periodDate = searchParams.get("period_date") || new Date().toISOString().split("T")[0];

    // Compute period start and end
    const now = new Date(periodDate);
    const periodDays = periodType === "monthly" ? 30 : 7;
    const periodStart = new Date(now.getTime() - periodDays * 86_400_000).toISOString().slice(0, 10);
    const periodEnd = periodDate;

    const [runsRes, qualityRes, sopsRes, improvementsRes] = await Promise.all([
      supabase.from("process_runs").select("*").eq("user_id", userId).limit(200),
      supabase.from("quality_incidents").select("*").eq("user_id", userId).limit(100),
      supabase.from("operational_sops").select("*").eq("user_id", userId).limit(200),
      supabase.from("process_improvements").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(100),
    ]);

    const review = buildOperationsReview(
      runsRes.data || [],
      sopsRes.data || [],
      qualityRes.data || [],
      improvementsRes.data || [],
      periodStart,
      periodEnd
    );

    return NextResponse.json({
      period_type: periodType,
      period_date: periodDate,
      period_start: periodStart,
      period_end: periodEnd,
      review,
      improvements: improvementsRes.data || [],
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { supabase, userId } = await requireUser();

    const body = await req.json();
    if (!body.title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("process_improvements")
      .insert({
        user_id: userId,
        title: body.title,
        problem: body.problem_statement || body.problem || null,
        proposed_change: body.proposed_solution || body.proposed_change || null,
        status: body.status || "reviewing",
        source: body.source || "weekly_review",
        sop_id: body.sop_id || null,
        process_template_id: body.process_template_id || null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ improvement: data }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

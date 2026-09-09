import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";
import { loadExecutiveContext } from "@/lib/executive-server";

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const url = new URL(request.url);
    const scope = (url.searchParams.get("scope") as "business" | "personal" | "combined") ?? "business";
    const res = await supabase
      .from("executive_reports")
      .select("id,title,report_type,scope,summary,created_at,period_start,period_end")
      .eq("user_id", userId)
      .eq("scope", scope)
      .order("created_at", { ascending: false })
      .limit(50);

    // Gracefully handle table-not-found
    if (res.error && (res.error as { code?: string }).code === "42P01") {
      return NextResponse.json({ reports: [] }, { headers: { "Cache-Control": "private, no-store" } });
    }
    if (res.error) throw res.error;

    const reports = (res.data ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      type: r.report_type ?? "daily_brief",
      scope: r.scope ?? scope,
      summary: r.summary ?? "",
      generatedAt: r.created_at,
      route: `/executive/reports/${r.id}`,
    }));

    return NextResponse.json({ reports }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, "Failed to list executive reports.");
  }
}


export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const body = await request.json();
    const scope = (body.scope as "business" | "personal" | "combined") ?? "business";

    // Build deterministic report content from live context if not provided
    const ctx = await loadExecutiveContext(supabase, userId, scope);
    const summary = body.summary ?? ctx.brief.headline;
    const title = body.title ?? `${body.report_type.replace(/_/g, " ").toUpperCase()} · ${ctx.today}`;

    const res = await supabase
      .from("executive_reports")
      .insert({
        user_id: userId,
        report_type: body.report_type ?? "daily_brief",
        scope,
        period_start: body.period_start ?? ctx.today,
        period_end: body.period_end ?? ctx.today,
        title,
        summary,
        sections: body.sections ?? [
          { title: "Top Priorities", content: ctx.priorities.map((p) => p.title).join(", ") },
          { title: "Key Decisions", content: ctx.decisions.map((d) => d.title).join(", ") },
          { title: "Risk Radar", content: ctx.riskClusters.map((r) => r.name).join(", ") },
        ],
        metrics: ctx.metrics,
        immutable_data: {
          generated_at: new Date().toISOString(),
          priorities: ctx.priorities,
          riskClusters: ctx.riskClusters,
          brief: ctx.brief,
        },
      })
      .select("*")
      .single();

    if (res.error) throw res.error;
    return NextResponse.json({ report: res.data }, { status: 201 });
  } catch (error) {
    return apiError(error, "Failed to create executive report.");
  }
}

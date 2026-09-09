import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";
import { loadExecutiveContext } from "@/lib/executive-server";

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();
    const res = await supabase
      .from("executive_snapshots")
      .select("*")
      .eq("user_id", userId)
      .order("snapshot_date", { ascending: false })
      .limit(30);
    if (res.error) throw res.error;
    return NextResponse.json({ snapshots: res.data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, "Failed to load snapshots.");
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const url = new URL(request.url);
    const scope = (url.searchParams.get("scope") as "business" | "personal" | "combined") ?? "business";
    const ctx = await loadExecutiveContext(supabase, userId, scope);

    const res = await supabase
      .from("executive_snapshots")
      .insert({
        user_id: userId,
        scope,
        snapshot_date: ctx.today,
        metrics: ctx.metrics.reduce((acc, m) => ({ ...acc, [m.name.replace(/ /g, "_")]: m.current }), {}),
        risk_states: ctx.signals.map((s) => ({ key: s.id, severity: s.severity, domain: s.domain })),
        decision_states: ctx.decisions.map((d) => ({ key: d.decisionId, readiness: d.readiness, urgency: d.urgency })),
        priority_states: ctx.priorities.map((p) => ({ key: p.id, rank: p.rank })),
        domain_health: ctx.domainHealth,
        summary: ctx.brief.headline,
      })
      .select("*")
      .single();

    if (res.error) throw res.error;
    return NextResponse.json({ snapshot: res.data }, { status: 201 });
  } catch (error) {
    return apiError(error, "Failed to record executive snapshot.");
  }
}

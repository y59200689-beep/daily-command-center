import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";
import { loadExecutiveContext } from "@/lib/executive-server";

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const url = new URL(request.url);
    const scope = (url.searchParams.get("scope") as "business" | "personal" | "combined") ?? "business";
    const context = await loadExecutiveContext(supabase, userId, scope);

    // Build the daily brief data shape
    const criticalRisks = context.signals
      .filter((s) => s.severity === "critical")
      .slice(0, 5)
      .map((s) => ({ title: s.title, domain: s.domain, action: s.reason }));

    const topPriorities = context.priorities.slice(0, 5).map((p) => ({
      title: p.title,
      domain: p.domain,
      why: p.why,
      route: p.route,
    }));

    const openDecisions = context.decisions.slice(0, 5).map((d) => ({
      title: d.title,
      readiness: d.readiness,
      route: d.route,
    }));

    const keyChanges = context.changes.slice(0, 8).map((c) => ({
      domain: c.domain,
      change: c.title,
    }));

    return NextResponse.json(
      {
        date: context.today,
        headline: context.brief.headline,
        executiveSummary: context.brief.headline + " — " + (context.brief.recommendedFocus ?? "Focus on highest-priority items."),
        recommendedFocus: context.brief.recommendedFocus,
        scope: context.scope,
        topPriorities,
        openDecisions,
        keyChanges,
        criticalRisks,
        whatCanWait: context.canWait,
        domainHealth: context.domainHealth,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    return apiError(error, "Executive brief is unavailable.");
  }
}

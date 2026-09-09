import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";
import { loadExecutiveContext } from "@/lib/executive-server";

const DOMAIN_ROUTES: Record<string, string> = {
  finance: "/finance",
  growth: "/growth",
  success: "/success",
  commerce: "/commerce",
  operations: "/operations",
  team: "/team",
  strategy: "/control-tower",
  knowledge: "/knowledge",
};

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();
    const context = await loadExecutiveContext(supabase, userId, "business");

    // Transform PlanVsRealityItem[] into per-domain view
    const domainMap = new Map<string, { plan: string; actual: string; delta: string; deltaNote: string; keyRisk?: string }>();

    for (const item of context.planVsReality) {
      if (!domainMap.has(item.domain)) {
        domainMap.set(item.domain, {
          plan: item.planned,
          actual: item.actual,
          delta: item.status === "on_track" ? "on_track" : item.status === "missed" ? "behind" : "behind",
          deltaNote: item.reason,
        });
      }
    }

    // Add domain health as summary
    const domains = Object.entries(context.domainHealth).map(([domain, h]) => {
      const pvr = domainMap.get(domain);
      return {
        domain,
        plan: pvr?.plan ?? "Operating normally",
        actual: h.reason,
        delta: h.status === "healthy" ? "on_track" : h.status === "at_risk" ? "behind" : "on_track",
        deltaNote: pvr?.deltaNote ?? h.reason,
        keyRisk: h.status === "at_risk" ? h.reason : undefined,
        route: DOMAIN_ROUTES[domain] ?? `/${domain}`,
      };
    });

    const atRiskCount = domains.filter((d) => d.delta === "behind").length;
    const overallDelta =
      atRiskCount === 0 ? "on_track" :
      atRiskCount === domains.length ? "behind" :
      atRiskCount > 2 ? "mixed" : "mixed";

    return NextResponse.json(
      {
        asOf: context.today,
        horizon: "Current Period",
        domains,
        overallDelta,
        summary: atRiskCount === 0
          ? "All domains are tracking on or ahead of plan."
          : `${atRiskCount} domain(s) require attention. Review risk clusters for detail.`,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    return apiError(error, "Plan vs reality data is unavailable.");
  }
}

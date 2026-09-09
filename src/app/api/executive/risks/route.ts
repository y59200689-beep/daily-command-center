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
    return NextResponse.json({
      risks: context.signals.filter((s) => s.severity === "critical" || s.severity === "important"),
      riskClusters: context.riskClusters,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, "Executive risks are unavailable.");
  }
}

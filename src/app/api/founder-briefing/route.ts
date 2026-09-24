import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";
import { loadTier1Briefing } from "@/lib/founder-os/briefing-server";
async function load(request: Request) {
  const { supabase, userId } = await requireUser();
  const days = z.enum(["1", "7", "30"]).parse(new URL(request.url).searchParams.get("window") ?? "7");
  const profile = await supabase.from("profiles").select("timezone").eq("id", userId).maybeSingle();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: profile.data?.timezone || "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const briefing = await loadTier1Briefing(supabase, userId, today, Number(days));
  return { supabase, userId, briefing };
}
export async function GET(request: Request) {
  try { const { briefing } = await load(request); const { facts: _facts, ...view } = briefing; void _facts; return NextResponse.json(view); }
  catch (e) { return apiError(e, "Executive briefing could not be loaded."); }
}
export async function POST(request: Request) {
  try {
    const { supabase, userId, briefing } = await load(request);
    if (briefing.coverage.some(c => c.status !== "available")) return NextResponse.json({ error: "A complete snapshot requires every source. Check the local Tier 1 migration and coverage." }, { status: 409 });
    if (new URL(request.url).searchParams.get("action") === "weekly") {
      const evidence = Object.entries(briefing.weekly).map(([title, rows]) => `${title}\n${rows.map(r => `${r.title}: ${r.why} (${r.route})`).join("\n")}`).join("\n\n");
      const result = await supabase.rpc("tier1_weekly_review", { period_end: briefing.today, evidence });
      if (result.error) throw result.error;
      return NextResponse.json({ reviewId: result.data });
    }
    const { error } = await supabase.from("executive_snapshots").insert({ user_id: userId, scope: "combined", snapshot_date: briefing.today, founder_facts: briefing.facts, founder_signals: briefing.state.signals, summary: "Tier 1 reviewed state" });
    if (error) throw error;
    return NextResponse.json({ saved: true });
  } catch (e) { return apiError(e, "Snapshot could not be saved."); }
}

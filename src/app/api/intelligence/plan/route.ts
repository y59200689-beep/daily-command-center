import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { generateDailyPlan } from "@/lib/intelligence/planning";
import { getIntelligence } from "@/lib/intelligence/server";
import { requireUser } from "@/lib/supabase/server";

const actionSchema = z.object({ action: z.enum(["accept", "reject"]), selectedTaskIds: z.array(z.uuid()).max(3).default([]) }).strict();

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();
    const { snapshot, overview } = await getIntelligence(supabase, userId);
    const plan = generateDailyPlan(snapshot, overview.recommendations);
    const existing = await supabase.from("daily_plans").select("status,suggestion,accepted_at,rejected_at").eq("user_id", userId).eq("plan_date", snapshot.today).maybeSingle();
    if (existing.error) throw existing.error;
    return NextResponse.json({ plan, existing: existing.data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, "Today's plan could not be prepared.");
  }
}

export async function POST(request: Request) {
  try {
    const input = actionSchema.parse(await request.json());
    const { supabase, userId } = await requireUser();
    const { snapshot, overview } = await getIntelligence(supabase, userId);
    const plan = generateDailyPlan(snapshot, overview.recommendations);
    if (input.action === "reject") {
      const result = await supabase.rpc("reject_daily_plan", { plan_date_value: snapshot.today, plan_payload: plan } as never);
      if (result.error) throw result.error;
      return NextResponse.json({ status: "rejected", plan: result.data });
    }
    const availableIds = new Set(overview.recommendations.filter((item) => item.entityType === "task").map((item) => item.entityId));
    if (input.selectedTaskIds.some((id) => !availableIds.has(id))) return NextResponse.json({ error: "One selected win is no longer available." }, { status: 409 });
    const selected = input.selectedTaskIds.length ? input.selectedTaskIds : plan.wins.map((item) => item.entityId);
    const acceptedPlan = { ...plan, wins: selected.map((id) => overview.recommendations.find((item) => item.entityType === "task" && item.entityId === id)).filter(Boolean) };
    const result = await supabase.rpc("accept_daily_plan", { plan_date_value: snapshot.today, plan_payload: acceptedPlan, priority_task_ids: selected } as never);
    if (result.error) throw result.error;
    return NextResponse.json({ status: "accepted", plan: result.data });
  } catch (error) {
    return apiError(error, "Today's plan could not be saved.");
  }
}

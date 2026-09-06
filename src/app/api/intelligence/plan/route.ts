import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { generateDailyPlan } from "@/lib/intelligence/planning";
import { getIntelligence } from "@/lib/intelligence/server";
import { requireUser } from "@/lib/supabase/server";
import { planBlockConflicts, type ScheduleItem } from "@/lib/calendar-conflicts";

const planBlockSchema = z.object({ startsAt: z.iso.datetime({ offset: true }), endsAt: z.iso.datetime({ offset: true }), title: z.string().min(1).max(240), kind: z.enum(["focus", "followup", "meeting", "fitness"]), minutes: z.number().nonnegative().optional(), label: z.string().max(200).optional(), taskId: z.uuid().optional() }).strict().refine((block) => new Date(block.endsAt) > new Date(block.startsAt), { message: "A plan block must end after it starts." });
const actionSchema = z.object({ action: z.enum(["accept", "reject"]), selectedTaskIds: z.array(z.uuid()).max(3).default([]), blocks: z.array(planBlockSchema).max(40).optional(), keptOverlapKeys: z.array(z.string().min(1).max(1000)).max(40).default([]) }).strict();

async function existingSchedule(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], userId: string, today: string) {
  const [events, focus, accepted] = await Promise.all([
    supabase.from("calendar_events").select("id,title,starts_at,ends_at,provider,timezone,all_day").eq("user_id", userId).is("deleted_at", null).neq("status", "cancelled").gte("ends_at", `${today}T00:00:00.000Z`).limit(100),
    supabase.from("focus_sessions").select("id,started_at,ended_at,tasks(title)").eq("user_id", userId).gte("started_at", `${today}T00:00:00.000Z`).not("ended_at", "is", null).limit(100),
    supabase.from("daily_plans").select("id,suggestion").eq("user_id", userId).eq("status", "accepted").gte("plan_date", today).limit(7),
  ]);
  const failed = [events, focus, accepted].find((result) => result.error); if (failed?.error) throw failed.error;
  const items: ScheduleItem[] = (events.data ?? []).map((event) => ({ id: String(event.id), title: String(event.title), starts_at: String(event.starts_at), ends_at: String(event.ends_at), source: event.provider === "google" ? "google" : "local", timezone: event.timezone, all_day: event.all_day }));
  for (const session of focus.data ?? []) { const task = session.tasks as unknown as { title?: string } | null; items.push({ id: `focus:${session.id}`, title: task?.title ? `Focus — ${task.title}` : "Focus session", starts_at: String(session.started_at), ends_at: String(session.ended_at), source: "focus" }); }
  for (const row of accepted.data ?? []) { const suggestion = row.suggestion as { blocks?: Array<{ startsAt?: string; endsAt?: string; title?: string; kind?: string }> } | null; suggestion?.blocks?.forEach((block, index) => { if (block.startsAt && block.endsAt && block.kind !== "meeting") items.push({ id: `plan:${row.id}:${index}`, title: block.title ?? "Planned work", starts_at: block.startsAt, ends_at: block.endsAt, source: "daily_plan" }); }); }
  return items;
}

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();
    const { snapshot, overview } = await getIntelligence(supabase, userId);
    const plan = generateDailyPlan(snapshot, overview.recommendations);
    const conflicts = planBlockConflicts(plan.blocks, await existingSchedule(supabase, userId, snapshot.today));
    const existing = await supabase.from("daily_plans").select("status,suggestion,accepted_at,rejected_at").eq("user_id", userId).eq("plan_date", snapshot.today).maybeSingle();
    if (existing.error) throw existing.error;
    return NextResponse.json({ plan, conflicts, existing: existing.data }, { headers: { "Cache-Control": "private, no-store" } });
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
    const acceptedBlocks = input.blocks ?? plan.blocks;
    if (acceptedBlocks.some((block) => block.taskId && !availableIds.has(block.taskId))) return NextResponse.json({ error: "A scheduled task is no longer available." }, { status: 409 });
    const unresolved = planBlockConflicts(acceptedBlocks, await existingSchedule(supabase, userId, snapshot.today)).filter((conflict) => !input.keptOverlapKeys.includes(conflict.versionKey));
    if (unresolved.length) return NextResponse.json({ error: "This plan still contains a Calendar conflict.", conflicts: unresolved }, { status: 409 });
    const acceptedPlan = { ...plan, blocks: acceptedBlocks, wins: selected.map((id) => overview.recommendations.find((item) => item.entityType === "task" && item.entityId === id)).filter(Boolean) };
    const result = await supabase.rpc("accept_daily_plan", { plan_date_value: snapshot.today, plan_payload: acceptedPlan, priority_task_ids: selected } as never);
    if (result.error) throw result.error;
    return NextResponse.json({ status: "accepted", plan: result.data });
  } catch (error) {
    return apiError(error, "Today's plan could not be saved.");
  }
}

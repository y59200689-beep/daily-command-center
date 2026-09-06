import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import {
  calendarConflictDisplayType,
  detectScheduleOverlaps,
  recurrenceIdentityIsAmbiguous,
  recurrenceScope,
  type ScheduleItem,
} from "@/lib/calendar-conflicts";
import { resolveGoogleCalendarConflict } from "@/lib/integrations/google-calendar";
import { requireUser } from "@/lib/supabase/server";
import { canonicalizeCalendarEvent, compareCalendarSnapshots, type CalendarSnapshot } from "@/lib/v4";

const inputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("overlap"), action: z.literal("keep_both"), versionKey: z.string().min(1).max(1000) }).strict(),
  z.object({
    kind: z.literal("sync"),
    conflictId: z.uuid(),
    action: z.enum(["keep_local", "keep_google", "restore_google", "delete_local", "delete_anyway", "keep_google_after_delete", "refresh"]),
  }).strict(),
]);

type Client = Awaited<ReturnType<typeof requireUser>>["supabase"];

async function ownedScheduleItems(supabase: Client, userId: string) {
  const now = new Date();
  const from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const to = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const today = now.toISOString().slice(0, 10);
  const [events, focus, plans] = await Promise.all([
    supabase.from("calendar_events").select("*").eq("user_id", userId).is("deleted_at", null).neq("status", "cancelled").gte("ends_at", from).lte("starts_at", to).order("starts_at").limit(150),
    supabase.from("focus_sessions").select("id,task_id,started_at,ended_at,tasks(title)").eq("user_id", userId).gte("started_at", from).lte("started_at", to).not("ended_at", "is", null).limit(100),
    supabase.from("daily_plans").select("id,plan_date,suggestion,status").eq("user_id", userId).eq("status", "accepted").gte("plan_date", today).order("plan_date").limit(14),
  ]);
  const failed = [events, focus, plans].find((result) => result.error);
  if (failed?.error) throw failed.error;
  const items: ScheduleItem[] = (events.data ?? []).map((event) => ({
    id: String(event.id), title: String(event.title), starts_at: String(event.starts_at), ends_at: String(event.ends_at), all_day: Boolean(event.all_day), timezone: event.timezone ? String(event.timezone) : null, source: event.provider === "google" ? "google" : "local", source_record_id: String(event.id),
  }));
  for (const session of focus.data ?? []) {
    const task = session.tasks as unknown as { title?: string } | null;
    items.push({ id: `focus:${session.id}`, title: task?.title ? `Focus — ${task.title}` : "Focus session", starts_at: String(session.started_at), ends_at: String(session.ended_at), source: "focus", source_record_id: String(session.id) });
  }
  for (const plan of plans.data ?? []) {
    const suggestion = plan.suggestion as { blocks?: Array<{ startsAt?: string; endsAt?: string; title?: string; kind?: string }> } | null;
    suggestion?.blocks?.forEach((block, index) => {
      if (!block.startsAt || !block.endsAt || block.kind === "meeting") return;
      items.push({ id: `plan:${plan.id}:${index}`, title: block.title ?? "Planned work", starts_at: block.startsAt, ends_at: block.endsAt, source: "daily_plan", source_record_id: String(plan.id) });
    });
  }
  return items;
}

async function unresolvedOverlaps(supabase: Client, userId: string) {
  const [items, acknowledgements] = await Promise.all([
    ownedScheduleItems(supabase, userId),
    supabase.from("action_audit_log").select("metadata").eq("user_id", userId).eq("action_type", "calendar_overlap_kept").order("created_at", { ascending: false }).limit(500),
  ]);
  if (acknowledgements.error) throw acknowledgements.error;
  const acknowledged = new Set((acknowledgements.data ?? []).map((row) => String((row.metadata as Record<string, unknown> | null)?.version_key ?? "")).filter(Boolean));
  return detectScheduleOverlaps(items).filter((conflict) => !acknowledged.has(conflict.versionKey));
}

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();
    const [overlaps, syncResult] = await Promise.all([
      unresolvedOverlaps(supabase, userId),
      supabase.from("calendar_event_sync_state").select("*,calendar_events(*)").eq("user_id", userId).not("conflict_type", "is", null).order("conflict_detected_at", { ascending: false }),
    ]);
    if (syncResult.error) throw syncResult.error;
    const syncConflicts = (syncResult.data ?? []).map((state) => {
      const local = state.calendar_events as Record<string, unknown>;
      const base = state.base_snapshot as CalendarSnapshot | null;
      const remote = state.remote_snapshot as CalendarSnapshot | null;
      const localSnapshot = canonicalizeCalendarEvent({ ...local, recurring_event_id: base?.recurring_event_id ?? remote?.recurring_event_id, original_start_time: base?.original_start_time ?? remote?.original_start_time });
      const comparison = base && remote ? compareCalendarSnapshots(base, localSnapshot, remote) : null;
      return {
        id: state.id,
        kind: "sync",
        conflict_type: calendarConflictDisplayType(String(state.conflict_type), Boolean(state.local_delete_intent)),
        stored_conflict_type: state.conflict_type,
        local_event: local,
        local_snapshot: localSnapshot,
        base_snapshot: base,
        remote_snapshot: remote,
        conflicting_fields: comparison?.conflictingFields ?? (remote ? [] : ["provider_deleted"]),
        provider_etag: state.last_synced_etag,
        provider_updated_at: state.last_synced_provider_updated_at,
        provider_deleted: state.provider_deleted,
        local_delete_intent: Boolean(state.local_delete_intent),
        conflict_detected_at: state.conflict_detected_at,
        recurrence_scope: recurrenceScope(remote ?? localSnapshot),
        recurrence_ambiguous: recurrenceIdentityIsAmbiguous(base, remote),
      };
    });
    return NextResponse.json({ conflicts: overlaps, syncConflicts }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, "Calendar conflicts could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const input = inputSchema.parse(await request.json());
    const { supabase, userId } = await requireUser();
    if (input.kind === "overlap") {
      const overlap = (await unresolvedOverlaps(supabase, userId)).find((item) => item.versionKey === input.versionKey);
      if (!overlap) return NextResponse.json({ error: "This overlap has already changed." }, { status: 409 });
      const saved = await supabase.from("action_audit_log").insert({ user_id: userId, actor: "user", action_type: "calendar_overlap_kept", entity_type: "calendar_event", entity_id: overlap.first.source_record_id ?? null, summary: `Kept overlapping schedule items: ${overlap.first.title} and ${overlap.second.title}`, status: "success", metadata: { version_key: overlap.versionKey, first_source: overlap.first.source, second_source: overlap.second.source } });
      if (saved.error) throw saved.error;
      return NextResponse.json({ status: "resolved", acknowledged: true });
    }
    const result = await resolveGoogleCalendarConflict(supabase, userId, input.conflictId, input.action);
    if (result.status === "stale_conflict") return NextResponse.json({ ...result, error: "This conflict changed while you were reviewing it." }, { status: 409 });
    if (result.status === "manual_review") return NextResponse.json({ ...result, error: "This recurring event needs manual review before it can be changed safely." }, { status: 409 });
    if (result.status === "already_resolved") return NextResponse.json({ ...result, error: "This conflict has already been resolved." }, { status: 409 });
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error, "Calendar conflict could not be resolved.");
  }
}

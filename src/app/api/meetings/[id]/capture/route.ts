import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { meetingExecutionSchema, meetingSuggestionSchema, suggestMeetingItems, validateSelectedMeetingItems } from "@/lib/meeting-capture";
import { requireUser } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

async function ownedMeetingContext(supabase: Supabase, userId: string, eventId: string) {
  const eventResult = await supabase.from("calendar_events").select("id,title,description,starts_at,ends_at,timezone,task_id").eq("id", eventId).eq("user_id", userId).is("deleted_at", null).maybeSingle();
  if (eventResult.error) throw eventResult.error;
  if (!eventResult.data) return null;

  let projectId: string | null = null;
  let clientId: string | null = null;
  if (eventResult.data.task_id) {
    const task = await supabase.from("tasks").select("project_id,client_id").eq("id", eventResult.data.task_id).eq("user_id", userId).is("deleted_at", null).maybeSingle();
    if (task.error) throw task.error;
    projectId = task.data?.project_id ?? null;
    clientId = task.data?.client_id ?? null;
  }
  if (projectId && !clientId) {
    const project = await supabase.from("projects").select("client_id").eq("id", projectId).eq("user_id", userId).is("deleted_at", null).maybeSingle();
    if (project.error) throw project.error;
    clientId = project.data?.client_id ?? null;
  }
  return { event: eventResult.data, projectId, clientId };
}

async function assertOwnedRelations(supabase: Supabase, userId: string, projectIds: string[], clientIds: string[]) {
  if (projectIds.length) {
    const result = await supabase.from("projects").select("id").eq("user_id", userId).is("deleted_at", null).in("id", projectIds);
    if (result.error) throw result.error;
    if ((result.data ?? []).length !== projectIds.length) throw new Error("A selected project is no longer available in your workspace.");
  }
  if (clientIds.length) {
    const result = await supabase.from("clients").select("id").eq("user_id", userId).is("deleted_at", null).in("id", clientIds);
    if (result.error) throw result.error;
    if ((result.data ?? []).length !== clientIds.length) throw new Error("A selected client is no longer available in your workspace.");
  }
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const eventId = z.uuid().parse((await params).id);
    const { supabase, userId } = await requireUser();
    const context = await ownedMeetingContext(supabase, userId, eventId);
    if (!context) return NextResponse.json({ error: "Meeting not found." }, { status: 404 });
    const [projects, clients, latestCapture] = await Promise.all([
      supabase.from("projects").select("id,name,client_id").eq("user_id", userId).is("deleted_at", null).order("name").limit(100),
      supabase.from("clients").select("id,name,company").eq("user_id", userId).is("deleted_at", null).order("name").limit(100),
      supabase.from("approval_items").select("id,status,payload,executed_at,error").eq("user_id", userId).eq("action_type", "create_multiple_meeting_actions").eq("entity_id", eventId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const failure = [projects, clients, latestCapture].find((result) => result.error);
    if (failure?.error) throw failure.error;
    const payload = latestCapture.data?.payload as Record<string, unknown> | undefined;
    return NextResponse.json({
      meeting: context.event,
      context: { projectId: context.projectId, clientId: context.clientId },
      projects: projects.data ?? [],
      clients: clients.data ?? [],
      capture: latestCapture.data ? { id: latestCapture.data.id, status: latestCapture.data.status, executedAt: latestCapture.data.executed_at, error: latestCapture.data.error, result: payload?.result ?? null } : null,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, "Meeting outcome could not be loaded.");
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const eventId = z.uuid().parse((await params).id);
    const input = z.discriminatedUnion("action", [meetingSuggestionSchema, meetingExecutionSchema]).parse(await request.json());
    const { supabase, userId } = await requireUser();
    const context = await ownedMeetingContext(supabase, userId, eventId);
    if (!context) return NextResponse.json({ error: "Meeting not found." }, { status: 404 });

    if (input.action === "suggest") return NextResponse.json({ items: suggestMeetingItems(input.rawNotes), parser: "deterministic", manualFallback: true });

    const selected = validateSelectedMeetingItems(input.items);
    if (!selected.length && !input.summary.trim()) return NextResponse.json({ error: "Choose at least one item or add a meeting summary." }, { status: 422 });
    const projectIds = [...new Set(selected.map((item) => item.input.project_id).filter(Boolean).map(String))];
    const clientIds = [...new Set(selected.map((item) => item.input.client_id).filter(Boolean).map(String))];
    await assertOwnedRelations(supabase, userId, projectIds, clientIds);

    const approvalPayload = { eventId, rawNotes: input.rawNotes || null, summary: input.summary || null, items: selected, projectId: context.projectId, clientId: context.clientId };
    const existing = await supabase.from("approval_items").select("id,status,payload").eq("user_id", userId).eq("action_type", "create_multiple_meeting_actions").eq("idempotency_key", input.idempotencyKey).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data?.status === "executed") return NextResponse.json({ result: (existing.data.payload as Record<string, unknown>).result, duplicate: true });

    let approvalId = existing.data?.id;
    if (approvalId) {
      const reset = await supabase.from("approval_items").update({ status: "pending", payload: approvalPayload, error: null }).eq("id", approvalId).eq("user_id", userId).in("status", ["pending", "failed"]).select("id").maybeSingle();
      if (reset.error) throw reset.error;
      if (!reset.data) return NextResponse.json({ error: "This meeting outcome is no longer available for execution." }, { status: 409 });
    } else {
      const inserted = await supabase.from("approval_items").insert({ user_id: userId, action_type: "create_multiple_meeting_actions", entity_type: "calendar_event", entity_id: eventId, title: `Capture outcomes: ${context.event.title}`, summary: input.summary || `${selected.length} confirmed meeting item${selected.length === 1 ? "" : "s"}.`, payload: approvalPayload, risk_level: "medium", idempotency_key: input.idempotencyKey, expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() }).select("id").single();
      if (inserted.error?.code === "23505") {
        const raced = await supabase.from("approval_items").select("id,status,payload").eq("user_id", userId).eq("action_type", "create_multiple_meeting_actions").eq("idempotency_key", input.idempotencyKey).single();
        if (raced.error) throw raced.error;
        if (raced.data.status === "executed") return NextResponse.json({ result: (raced.data.payload as Record<string, unknown>).result, duplicate: true });
        approvalId = raced.data.id;
      } else {
        if (inserted.error) throw inserted.error;
        approvalId = inserted.data.id;
      }
    }

    const executed = await supabase.rpc("execute_meeting_capture", { capture_approval_id: approvalId });
    if (executed.error) {
      await supabase.from("approval_items").update({ status: "failed", error: "The selected meeting records were not created." }).eq("id", approvalId).eq("user_id", userId).eq("status", "pending");
      throw executed.error;
    }
    return NextResponse.json({ result: executed.data, approvalId }, { status: 201 });
  } catch (error) {
    return apiError(error, "Meeting outcome could not be saved.");
  }
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { archiveRecord, createRecord, getRecord, updateRecord } from "@/lib/repository";
import { parseDomainInput } from "@/lib/domains";
import { pushGoogleEvent, deleteGoogleEvent } from "@/lib/integrations/google-calendar";
import { getIntelligence } from "@/lib/intelligence/server";
import { generateDailyPlan } from "@/lib/intelligence/planning";
import { planBlockConflicts, type ScheduleItem } from "@/lib/calendar-conflicts";

type Client = SupabaseClient<Record<string, unknown>>;
type Approval = Record<string, unknown> & { id: string; action_type: string; title: string; summary: string; payload: Record<string, unknown>; entity_id?: string | null; entity_type?: string | null; status: string; expires_at?: string | null };
export type ApprovalExecution = { status: "executed" | "needs_review" | "failed" | "expired" | "executing" | "unavailable"; item?: Approval; result?: Record<string, unknown>; message?: string };

const calendarPayload = z.object({ operation: z.enum(["create", "update", "delete"]), eventId: z.uuid().optional(), after: z.record(z.string(), z.unknown()).optional(), before: z.record(z.string(), z.unknown()).optional(), expectedUpdatedAt: z.string().optional(), expectedEtag: z.string().optional() }).passthrough();
const paymentPayload = z.object({ invoiceId: z.uuid(), amount: z.coerce.number().positive(), currency: z.string().trim().length(3), paymentDate: z.iso.date(), paymentMethod: z.string().max(120).nullable().optional(), reference: z.string().max(240).nullable().optional(), notes: z.string().max(5000).nullable().optional(), preparedOutstanding: z.coerce.number().nonnegative().optional() }).passthrough();
const planBlock = z.object({ startsAt: z.iso.datetime({ offset: true }), endsAt: z.iso.datetime({ offset: true }), title: z.string().min(1).max(240), kind: z.enum(["focus", "followup", "meeting", "fitness"]), minutes: z.number().nonnegative().optional(), label: z.string().max(200).optional(), taskId: z.uuid().optional() }).strict();
const planPayload = z.object({ planDate: z.iso.date(), selectedTaskIds: z.array(z.uuid()).max(3), blocks: z.array(planBlock).max(40).default([]), keptOverlapKeys: z.array(z.string()).max(40).default([]), expectedTaskUpdatedAt: z.record(z.string(), z.string()).optional(), plan: z.record(z.string(), z.unknown()).optional() }).passthrough();

export function calendarApprovalPreview(payload: Record<string, unknown>) {
  const parsed = calendarPayload.parse(payload); return { operation: parsed.operation, before: parsed.before ?? null, after: parsed.after ?? null };
}
export function paymentApprovalPreview(payload: Record<string, unknown>) { return paymentPayload.parse(payload); }
export function planApprovalPreview(payload: Record<string, unknown>) { return planPayload.parse(payload); }
export function approvalKind(actionType: string) { return actionType === "record_payment" ? "payment" : actionType === "accept_daily_plan" ? "plan" : actionType === "reschedule_calendar_event" || actionType === "calendar_change" ? "calendar" : "other"; }

async function audit(client: Client, userId: string, actionType: string, approval: Approval, status: string, metadata?: Record<string, unknown>) {
  const result = await client.from("action_audit_log").insert({ user_id: userId, actor: "user", action_type: actionType, entity_type: approval.entity_type ?? null, entity_id: approval.entity_id ?? null, summary: approval.title, status, metadata: metadata ?? {} } as never);
  if (result.error) throw result.error;
}

async function setState(client: Client, userId: string, approval: Approval, status: "executed" | "failed" | "needs_review", options: { error?: string | null; result?: Record<string, unknown> } = {}) {
  const payload = { ...approval.payload, ...(options.result ? { execution_result: options.result } : {}) };
  const result = await client.from("approval_items").update({ status, error: options.error ?? null, ...(status === "executed" ? { executed_at: new Date().toISOString() } : {}), payload } as never).eq("id", approval.id).eq("user_id", userId).eq("status", "executing").select("*").single();
  if (result.error) throw result.error;
  return result.data as Approval;
}

function equalExpected(before: Record<string, unknown> | undefined, current: Record<string, unknown>) {
  if (!before) return true;
  return ["title", "description", "starts_at", "ends_at", "all_day", "timezone", "recurrence_rule", "status"].every((field) => before[field] === undefined || before[field] === current[field]);
}

async function calendarConflict(client: Client, userId: string, eventId: string) {
  const result = await client.from("calendar_event_sync_state").select("conflict_type,provider_deleted").eq("user_id", userId).eq("calendar_event_id", eventId).not("conflict_type", "is", null).maybeSingle();
  if (result.error) throw result.error;
  return result.data;
}

async function executeCalendar(client: Client, userId: string, approval: Approval) {
  const payload = calendarPayload.parse(approval.payload);
  if (payload.operation === "create") {
    const parsed = parseDomainInput("calendar", payload.after ?? {}); if (!parsed.success) return { needsReview: false, message: parsed.error.issues[0]?.message ?? "The Calendar change is invalid." };
    const local = await createRecord(client, userId, "calendar", parsed.data as Record<string, unknown>);
    const synced = await pushGoogleEvent(client, userId, local);
    return { result: { route: "/calendar", eventId: synced.id, sync: synced.sync_result ?? null } };
  }
  const eventId = payload.eventId ?? approval.entity_id; if (!eventId) return { needsReview: false, message: "The Calendar event is missing." };
  const current = await getRecord(client, userId, "calendar", String(eventId)); if (!current) return { needsReview: true, message: "This Calendar event changed or is no longer available." };
  if (payload.expectedUpdatedAt && String(current.updated_at) !== payload.expectedUpdatedAt || payload.expectedEtag && String(current.google_etag ?? "") !== payload.expectedEtag || !equalExpected(payload.before, current)) return { needsReview: true, message: "This Calendar event changed since the approval was prepared." };
  if (await calendarConflict(client, userId, String(eventId))) return { needsReview: true, message: "This Calendar event needs conflict review before the approval can run.", route: "/calendar" };
  if (payload.operation === "delete") {
    const deleted = await deleteGoogleEvent(client, userId, current);
    if (deleted.status !== "deleted") return { needsReview: true, message: "Google Calendar changed before this event could be removed.", route: "/calendar" };
    const archived = await archiveRecord(client, userId, "calendar", String(eventId)); if (!archived) return { needsReview: true, message: "This Calendar event is no longer available." };
    return { result: { route: "/calendar", eventId, deleted: true } };
  }
  const parsed = parseDomainInput("calendar", payload.after ?? {}, true); if (!parsed.success) return { needsReview: false, message: parsed.error.issues[0]?.message ?? "The Calendar change is invalid." };
  const saved = await updateRecord(client, userId, "calendar", String(eventId), parsed.data as Record<string, unknown>); if (!saved) return { needsReview: true, message: "This Calendar event is no longer available." };
  const synced = await pushGoogleEvent(client, userId, saved);
  if ((synced.sync_result as { status?: string } | undefined)?.status === "conflict") return { needsReview: true, message: "Google Calendar changed while this approval was being applied.", route: "/calendar" };
  return { result: { route: "/calendar", eventId: synced.id, sync: synced.sync_result ?? null } };
}

async function executePayment(client: Client, userId: string, approval: Approval) {
  const payload = paymentPayload.parse(approval.payload);
  const invoice = await client.from("invoices").select("id,client_id,project_id,currency,amount_remaining,status").eq("id", payload.invoiceId).eq("user_id", userId).is("deleted_at", null).maybeSingle();
  if (invoice.error) throw invoice.error; if (!invoice.data) return { needsReview: true, message: "This invoice is no longer available." };
  const invoiceRow = invoice.data as unknown as { amount_remaining?: number; currency?: string };
  const remaining = Number(invoiceRow.amount_remaining ?? 0);
  if (payload.preparedOutstanding !== undefined && Number(payload.preparedOutstanding) !== remaining) return { needsReview: true, message: "Invoice balance changed since this approval was prepared." };
  if (String(invoiceRow.currency).toUpperCase() !== payload.currency.toUpperCase()) return { needsReview: true, message: "Invoice currency changed since this approval was prepared." };
  if (payload.amount > remaining) return { needsReview: true, message: "Payment exceeds the current invoice balance." };
  const payment = await client.rpc("record_invoice_payment", { payment_invoice_id: payload.invoiceId, payment_amount: payload.amount, payment_date_value: payload.paymentDate, payment_method_value: payload.paymentMethod ?? null, payment_reference: payload.reference ?? null, payment_notes: payload.notes ?? null } as never);
  if (payment.error) throw payment.error;
  return { result: { route: "/finance", payment: payment.data, invoiceId: payload.invoiceId } };
}

async function planSchedule(client: Client, userId: string, day: string) {
  const [events, focus, accepted] = await Promise.all([
    client.from("calendar_events").select("id,title,starts_at,ends_at,provider,timezone,all_day").eq("user_id", userId).is("deleted_at", null).neq("status", "cancelled").gte("ends_at", `${day}T00:00:00.000Z`).limit(100),
    client.from("focus_sessions").select("id,started_at,ended_at,tasks(title)").eq("user_id", userId).gte("started_at", `${day}T00:00:00.000Z`).not("ended_at", "is", null).limit(100),
    client.from("daily_plans").select("id,suggestion").eq("user_id", userId).eq("status", "accepted").gte("plan_date", day).limit(7),
  ]);
  const failed = [events, focus, accepted].find((entry) => entry.error); if (failed?.error) throw failed.error;
  const schedule: ScheduleItem[] = ((events.data ?? []) as unknown as Array<Record<string, unknown>>).map((event) => ({ id: String(event.id), title: String(event.title), starts_at: String(event.starts_at), ends_at: String(event.ends_at), source: event.provider === "google" ? "google" : "local", timezone: event.timezone as string | null | undefined, all_day: Boolean(event.all_day) }));
  for (const raw of focus.data ?? []) { const session = raw as unknown as Record<string, unknown>; const task = session.tasks as { title?: string } | null; schedule.push({ id: `focus:${session.id}`, title: task?.title ? `Focus — ${task.title}` : "Focus session", starts_at: String(session.started_at), ends_at: String(session.ended_at), source: "focus" }); }
  for (const raw of accepted.data ?? []) { const row = raw as unknown as Record<string, unknown>; const suggestion = row.suggestion as { blocks?: Array<{ startsAt?: string; endsAt?: string; title?: string; kind?: string }> } | null; suggestion?.blocks?.forEach((block, index) => { if (block.startsAt && block.endsAt && block.kind !== "meeting") schedule.push({ id: `plan:${row.id}:${index}`, title: block.title ?? "Planned work", starts_at: block.startsAt, ends_at: block.endsAt, source: "daily_plan" }); }); }
  return schedule;
}

async function executePlan(client: Client, userId: string, approval: Approval) {
  const payload = planPayload.parse(approval.payload); const { snapshot, overview } = await getIntelligence(client, userId);
  if (payload.planDate !== snapshot.today) return { needsReview: true, message: "Your day changed since this plan was prepared." };
  const available = new Set(overview.recommendations.filter((item) => item.entityType === "task").map((item) => item.entityId));
  if (payload.selectedTaskIds.some((id) => !available.has(id))) return { needsReview: true, message: "One of this plan's tasks changed or was completed." };
  const taskRows = await client.from("tasks").select("id,updated_at,status").eq("user_id", userId).in("id", payload.selectedTaskIds); if (taskRows.error) throw taskRows.error;
  const currentTasks = (taskRows.data ?? []) as unknown as Array<{ id: string; status: string; updated_at: string }>;
  if (currentTasks.length !== payload.selectedTaskIds.length || currentTasks.some((task) => ["completed", "cancelled"].includes(String(task.status)) || payload.expectedTaskUpdatedAt?.[String(task.id)] && payload.expectedTaskUpdatedAt[String(task.id)] !== String(task.updated_at))) return { needsReview: true, message: "Your day changed since this plan was prepared." };
  const plan = generateDailyPlan(snapshot, overview.recommendations); const blocks = payload.blocks.length ? payload.blocks : plan.blocks;
  const unresolved = planBlockConflicts(blocks, await planSchedule(client, userId, snapshot.today)).filter((conflict) => !payload.keptOverlapKeys.includes(conflict.versionKey));
  if (unresolved.length) return { needsReview: true, message: "This plan now conflicts with your Calendar.", route: "/plan", conflicts: unresolved };
  const acceptedPlan = payload.plan ?? { ...plan, blocks, wins: payload.selectedTaskIds.map((id) => overview.recommendations.find((item) => item.entityType === "task" && item.entityId === id)).filter(Boolean) };
  const result = await client.rpc("accept_daily_plan", { plan_date_value: snapshot.today, plan_payload: acceptedPlan, priority_task_ids: payload.selectedTaskIds } as never); if (result.error) throw result.error;
  return { result: { route: "/today", plan: result.data, taskIds: payload.selectedTaskIds } };
}

export async function executeApproval(client: Client, userId: string, approvalId: string): Promise<ApprovalExecution> {
  const claim = await client.rpc("claim_approval_execution", { approval_id: approvalId } as never); if (claim.error) throw claim.error;
  const claimed = claim.data as { status?: string; approval?: Approval }; const approval = claimed.approval;
  if (!approval) return { status: "unavailable", message: "This approval is no longer available." };
  if (claimed.status === "executed") return { status: "executed", item: approval, result: (approval.payload.execution_result as Record<string, unknown> | undefined) };
  if (claimed.status === "expired") return { status: "expired", item: approval, message: "Approval expired." };
  if (claimed.status !== "claimed") return { status: claimed.status === "executing" ? "executing" : "unavailable", item: approval, message: "This approval is no longer available." };
  await audit(client, userId, "approval_approved", approval, "success");
  await audit(client, userId, "approval_execution_started", approval, "success");
  try {
    const kind = approvalKind(approval.action_type);
    const outcome: { needsReview?: boolean; message?: string; result?: Record<string, unknown>; route?: string; conflicts?: unknown } = kind === "calendar" ? await executeCalendar(client, userId, approval) : kind === "payment" ? await executePayment(client, userId, approval) : kind === "plan" ? await executePlan(client, userId, approval) : { needsReview: false, message: "This approval type is not executable." };
    if (outcome.needsReview) { const item = await setState(client, userId, approval, "needs_review", { error: outcome.message, result: { route: outcome.route ?? null, conflicts: outcome.conflicts ?? null } }); await audit(client, userId, "approval_needs_review", approval, "needs_review"); return { status: "needs_review", item, message: outcome.message, result: outcome as Record<string, unknown> }; }
    if (!outcome.result) { const item = await setState(client, userId, approval, "failed", { error: outcome.message ?? "Approval could not be executed." }); await audit(client, userId, "approval_failed", approval, "failed"); return { status: "failed", item, message: outcome.message }; }
    const item = await setState(client, userId, approval, "executed", { result: outcome.result }); await audit(client, userId, "approval_executed", approval, "success", outcome.result); await audit(client, userId, kind === "calendar" ? "calendar_changed" : kind === "payment" ? "payment_recorded" : "daily_plan_applied", approval, "success", outcome.result); return { status: "executed", item, result: outcome.result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Approval could not be executed.";
    const item = await setState(client, userId, approval, "failed", { error: message }); await audit(client, userId, "approval_failed", approval, "failed"); return { status: "failed", item, message };
  }
}

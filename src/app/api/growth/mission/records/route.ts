import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

const recordSchema = z.object({ record_type: z.enum(["lead", "opportunity", "proposal", "payment", "task", "calendar_event", "followup"]), record_id: z.uuid() });
const sources = {
  lead: { table: "leads", fields: "id,name,company", removed: "archived_at" },
  opportunity: { table: "opportunities", fields: "id,title,stage", removed: "archived_at" },
  proposal: { table: "proposals", fields: "id,title,status", removed: "archived_at" },
  payment: { table: "payments", fields: "id,amount,currency,payment_date", removed: "deleted_at" },
  task: { table: "tasks", fields: "id,title,status", removed: "deleted_at" },
  calendar_event: { table: "calendar_events", fields: "id,title,starts_at,status", removed: "deleted_at" },
  followup: { table: "followups", fields: "id,title,due_at,status", removed: "deleted_at" },
} as const;
export async function GET() {
  try {
    const { supabase, userId } = await requireUser();
    const [leads, opportunities, proposals, payments, tasks, events, followups, links] = await Promise.all([
      supabase.from("leads").select(sources.lead.fields).eq("user_id", userId).is("archived_at", null).order("created_at", { ascending: false }).limit(200),
      supabase.from("opportunities").select(sources.opportunity.fields).eq("user_id", userId).is("archived_at", null).order("created_at", { ascending: false }).limit(200),
      supabase.from("proposals").select(sources.proposal.fields).eq("user_id", userId).is("archived_at", null).order("created_at", { ascending: false }).limit(200),
      supabase.from("payments").select(sources.payment.fields).eq("user_id", userId).is("deleted_at", null).order("payment_date", { ascending: false }).limit(200),
      supabase.from("tasks").select(sources.task.fields).eq("user_id", userId).is("deleted_at", null).order("created_at", { ascending: false }).limit(200),
      supabase.from("calendar_events").select(sources.calendar_event.fields).eq("user_id", userId).is("deleted_at", null).order("starts_at", { ascending: false }).limit(200),
      supabase.from("followups").select(sources.followup.fields).eq("user_id", userId).is("deleted_at", null).order("created_at", { ascending: false }).limit(200),
      supabase.from("revenue_mission_records").select("record_type,record_id").eq("user_id", userId),
    ]);
    for (const result of [leads, opportunities, proposals, payments, tasks, events, followups, links]) if (result.error) throw result.error;
    return NextResponse.json({
      records: [
        ...(leads.data ?? []).map(row => ({ type: "lead", id: row.id, label: row.company ? `${row.name} · ${row.company}` : row.name })),
        ...(opportunities.data ?? []).map(row => ({ type: "opportunity", id: row.id, label: row.title })),
        ...(proposals.data ?? []).map(row => ({ type: "proposal", id: row.id, label: row.title })),
        ...(payments.data ?? []).map(row => ({ type: "payment", id: row.id, label: `${row.amount} ${row.currency} · ${row.payment_date}` })),
        ...(tasks.data ?? []).map(row => ({ type: "task", id: row.id, label: `${row.title} · ${row.status}` })),
        ...(events.data ?? []).map(row => ({ type: "calendar_event", id: row.id, label: `${row.title} · ${row.starts_at.slice(0,10)}` })),
        ...(followups.data ?? []).map(row => ({ type: "followup", id: row.id, label: `${row.title} · ${row.status}` })),
      ], links: links.data ?? [] });
  } catch (error) { return apiError(error, "Mission records could not be loaded."); }
}
export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const parsed = recordSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Choose a valid record." }, { status: 400 });
    const { record_type, record_id } = parsed.data;
    const source = sources[record_type];
    const record = await supabase.from(source.table).select("id").eq("id", record_id).eq("user_id", userId).is(source.removed, null).maybeSingle();
    if (record.error) throw record.error;
    if (!record.data) return NextResponse.json({ error: "Record not found." }, { status: 404 });
    const { error } = await supabase.from("revenue_mission_records").upsert({ user_id: userId, record_type, record_id }, { onConflict: "user_id,record_type,record_id" });
    if (error) throw error;
    return NextResponse.json({ linked: true });
  } catch (error) { return apiError(error, "Record could not be linked."); }
}
export async function DELETE(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const parsed = recordSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Choose a valid record." }, { status: 400 });
    const { error } = await supabase.from("revenue_mission_records").delete().eq("user_id", userId).eq("record_type", parsed.data.record_type).eq("record_id", parsed.data.record_id);
    if (error) throw error;
    return NextResponse.json({ linked: false });
  } catch (error) { return apiError(error, "Record could not be unlinked."); }
}

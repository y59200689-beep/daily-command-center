import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { approvalKind, executeApproval } from "@/lib/approval-execution";
import { sendApprovedGmailDraft } from "@/lib/integrations/gmail";
import { requireUser } from "@/lib/supabase/server";

const decisionSchema = z.object({ id: z.uuid(), decision: z.enum(["approved", "rejected"]), send: z.boolean().optional() }).strict();
const gmailPayload = z.object({ to: z.string().email(), subject: z.string().min(1).max(998), body: z.string().min(1).max(10_000), threadId: z.string().optional() });
const paymentEdit = z.object({ amount: z.coerce.number().positive().optional(), paymentDate: z.iso.date().optional(), paymentMethod: z.string().trim().max(120).nullable().optional(), reference: z.string().trim().max(240).nullable().optional(), notes: z.string().max(5000).nullable().optional() }).strict();
const editSchema = z.object({ id: z.uuid(), title: z.string().min(1).max(240).optional(), summary: z.string().min(1).max(2000).optional(), payload: z.unknown().optional() }).strict();

async function audit(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], userId: string, actionType: string, item: { title: string; entity_type?: string | null; entity_id?: string | null }, status = "success") {
  const result = await supabase.from("action_audit_log").insert({ user_id: userId, actor: "user", action_type: actionType, entity_type: item.entity_type ?? null, entity_id: item.entity_id ?? null, summary: item.title, status });
  if (result.error) throw result.error;
}

export async function GET() {
  try { const { supabase, userId } = await requireUser(); const { data, error } = await supabase.from("approval_items").select("*").eq("user_id", userId).in("status", ["pending", "approved", "executing", "needs_review", "failed", "expired"]).order("created_at", { ascending: false }); if (error) throw error; return NextResponse.json({ items: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } }); } catch (error) { return apiError(error, "Approvals could not be loaded."); }
}

export async function POST(request: Request) {
  try {
    const input = decisionSchema.parse(await request.json()); const { supabase, userId } = await requireUser();
    const { data: existing, error } = await supabase.from("approval_items").select("*").eq("id", input.id).eq("user_id", userId).maybeSingle(); if (error) throw error;
    if (!existing) return NextResponse.json({ error: "Approval is no longer available." }, { status: 409 });
    if (input.decision === "rejected") {
      const rejected = await supabase.from("approval_items").update({ status: "rejected", rejected_at: new Date().toISOString(), error: null }).eq("id", input.id).eq("user_id", userId).in("status", ["pending", "approved", "needs_review"]).select("*").maybeSingle();
      if (rejected.error) throw rejected.error; if (!rejected.data) return NextResponse.json({ error: "Approval is no longer available." }, { status: 409 }); await audit(supabase, userId, "approval_rejected", rejected.data); return NextResponse.json({ item: rejected.data });
    }
    if (existing.action_type === "send_email" && input.send) return NextResponse.json({ item: await sendApprovedGmailDraft(supabase, userId, input.id, gmailPayload.parse(existing.payload)) });
    if (["calendar", "payment", "plan"].includes(approvalKind(String(existing.action_type)))) { const execution = await executeApproval(supabase, userId, input.id); return NextResponse.json(execution, { status: execution.status === "unavailable" ? 409 : 200 }); }
    const approved = await supabase.from("approval_items").update({ status: "approved", approved_at: new Date().toISOString() }).eq("id", input.id).eq("user_id", userId).eq("status", "pending").select("*").maybeSingle();
    if (approved.error) throw approved.error; if (!approved.data) return NextResponse.json({ error: "Approval is no longer available." }, { status: 409 }); await audit(supabase, userId, "approval_approved", approved.data); return NextResponse.json({ item: approved.data });
  } catch (error) { return apiError(error, "Approval could not be updated."); }
}

export async function PATCH(request: Request) {
  try {
    const input = editSchema.parse(await request.json()); const { supabase, userId } = await requireUser(); const { data: existing, error } = await supabase.from("approval_items").select("*").eq("id", input.id).eq("user_id", userId).in("status", ["pending", "needs_review"]).maybeSingle();
    if (error) throw error; if (!existing) return NextResponse.json({ error: "Only pending approvals can be edited." }, { status: 409 });
    let payload = existing.payload as Record<string, unknown>;
    if (input.payload !== undefined) { if (existing.action_type === "send_email") payload = gmailPayload.parse(input.payload); else if (existing.action_type === "record_payment") payload = { ...payload, ...paymentEdit.parse(input.payload) }; else return NextResponse.json({ error: "This approval cannot be edited here." }, { status: 409 }); }
    const updated = await supabase.from("approval_items").update({ ...(input.title ? { title: input.title } : {}), ...(input.summary ? { summary: input.summary } : {}), payload, status: "pending", error: null }).eq("id", input.id).eq("user_id", userId).in("status", ["pending", "needs_review"]).select("*").maybeSingle();
    if (updated.error) throw updated.error; if (!updated.data) return NextResponse.json({ error: "Only pending approvals can be edited." }, { status: 409 }); return NextResponse.json({ item: updated.data });
  } catch (error) { return apiError(error, "Approval could not be edited."); }
}

import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { effectiveInvoiceStatus } from "@/lib/v2";
import { requireUser } from "@/lib/supabase/server";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, userId } = await requireUser();
    const client = await supabase.from("clients").select("*").eq("id", id).eq("user_id", userId).is("deleted_at", null).maybeSingle();
    if (client.error) throw client.error;
    if (!client.data) return NextResponse.json({ error: "Client not found." }, { status: 404 });

    const queries = await Promise.all([
      supabase.from("projects").select("*").eq("user_id", userId).eq("client_id", id).is("deleted_at", null),
      supabase.from("tasks").select("*").eq("user_id", userId).eq("client_id", id).is("deleted_at", null),
      supabase.from("followups").select("*").eq("user_id", userId).eq("client_id", id).is("deleted_at", null),
      supabase.from("waiting_items").select("*").eq("user_id", userId).eq("client_id", id).is("deleted_at", null),
      supabase.from("notes").select("*").eq("user_id", userId).eq("client_id", id).is("deleted_at", null),
      supabase.from("content_items").select("*").eq("user_id", userId).eq("client_id", id).is("deleted_at", null),
      supabase.from("invoices").select("*").eq("user_id", userId).eq("client_id", id).is("deleted_at", null),
      supabase.from("payments").select("*").eq("user_id", userId).eq("client_id", id).is("deleted_at", null),
      supabase.from("external_references").select("*").eq("user_id", userId).eq("entity_type", "client").eq("entity_id", id),
    ]);
    const failed = queries.find((item) => item.error);
    if (failed?.error) throw failed.error;
    const [projects, tasks, followups, waiting, notes, content, invoices, payments, files] = queries.map((item) => item.data ?? []);
    const today = new Date().toISOString().slice(0, 10);
    const enriched = invoices.map((item) => ({ ...item, effective_status: effectiveInvoiceStatus(item, today) }));
    const defaultInvoices=enriched.filter((item)=>String(item.currency??"MAD")==="MAD");const defaultPayments=payments.filter((item)=>String(item.currency??"MAD")==="MAD");
    const invoiced = defaultInvoices.reduce((sum, item) => sum + Number(item.total_amount ?? item.amount ?? 0), 0);
    const received = defaultPayments.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
    const overdue = defaultInvoices.filter((item) => item.effective_status === "overdue").reduce((sum, item) => sum + Number(item.amount_remaining ?? 0), 0);
    const delays = enriched.filter((item) => item.paid_at && item.due_date).map((item) => Math.max(0, Math.floor((new Date(String(item.paid_at)).getTime() - new Date(`${item.due_date}T00:00:00Z`).getTime()) / 86400000)));
    const openFollowups = followups.filter((item) => item.status === "open").sort((a, b) => String(a.due_at ?? "").localeCompare(String(b.due_at ?? "")));
    const timeline = [...followups, ...waiting, ...notes, ...content, ...enriched, ...payments].sort((a, b) => String(b.updated_at ?? b.created_at ?? b.payment_date ?? "").localeCompare(String(a.updated_at ?? a.created_at ?? a.payment_date ?? ""))).slice(0, 50);

    return NextResponse.json({
      client: client.data,
      related: { projects, tasks, followups, waiting, notes, content, invoices: enriched, payments, files, timeline },
      finance: { invoiced, received, outstanding: Math.max(invoiced - received, 0), overdue, averagePaymentDelay: delays.length ? delays.reduce((a, b) => a + b, 0) / delays.length : null },
      relationship: {
        activeProjects: projects.filter((item) => item.status === "active").length,
        lastContactAt: client.data.last_contact_at ?? null,
        nextFollowupAt: openFollowups[0]?.due_at ?? client.data.next_follow_up_at ?? null,
      },
    });
  } catch (error) {
    return apiError(error, "Client workspace could not be loaded.");
  }
}

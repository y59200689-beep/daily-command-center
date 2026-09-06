import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { profitability, scopeDelivery, trackedProjectSeconds } from "@/lib/business";
import { requireUser } from "@/lib/supabase/server";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; const { supabase, userId } = await requireUser();
    const { data: project, error: projectError } = await supabase.from("projects").select("id,name,client_id,value_amount,currency,proposal_id").eq("id", id).eq("user_id", userId).is("deleted_at", null).maybeSingle();
    if (projectError) throw projectError; if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const [scope, changes, tasks, directFocus, expenses, invoices, payments, settings] = await Promise.all([
      supabase.from("scope_items").select("*").eq("project_id", id).eq("user_id", userId).order("created_at"),
      supabase.from("scope_change_requests").select("*").eq("project_id", id).eq("user_id", userId).order("requested_at", { ascending: false }),
      supabase.from("tasks").select("id,title,status,scope_item_id,scope_status,estimated_minutes").eq("project_id", id).eq("user_id", userId).is("deleted_at", null),
      supabase.from("focus_sessions").select("id,project_id,task_id,duration_seconds,started_at").eq("user_id", userId).eq("project_id", id),
      supabase.from("expenses").select("id,amount,currency,service_id,expense_date").eq("project_id", id).eq("user_id", userId).is("deleted_at", null),
      supabase.from("invoices").select("id,total_amount,amount_remaining,currency,status").eq("project_id", id).eq("user_id", userId).is("deleted_at", null),
      supabase.from("payments").select("id,amount,currency").eq("project_id", id).eq("user_id", userId).is("deleted_at", null),
      supabase.from("business_settings").select("internal_hourly_cost").eq("user_id", userId).maybeSingle(),
    ]);
    const failures = [scope, changes, tasks, directFocus, expenses, invoices, payments, settings].find((query) => query.error); if (failures?.error) throw failures.error;
    const taskIds = (tasks.data ?? []).map((task) => task.id); const taskFocus = taskIds.length ? await supabase.from("focus_sessions").select("id,project_id,task_id,duration_seconds,started_at").eq("user_id", userId).in("task_id", taskIds) : { data: [], error: null };
    if (taskFocus.error) throw taskFocus.error;
    const focus = [...(directFocus.data ?? []), ...(taskFocus.data ?? [])]; const currency = String(project.currency ?? "MAD");
    const currencyExpenses = (expenses.data ?? []).filter((expense) => String(expense.currency ?? "MAD") === currency);
    const currencyInvoices = (invoices.data ?? []).filter((invoice) => String(invoice.currency ?? "MAD") === currency);
    const currencyPayments = (payments.data ?? []).filter((payment) => String(payment.currency ?? "MAD") === currency);
    const trackedSeconds = trackedProjectSeconds(id, focus, tasks.data ?? []);
    const directExpenses = currencyExpenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
    const received = currencyPayments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
    const invoiced = currencyInvoices.reduce((sum, invoice) => sum + Number(invoice.total_amount ?? 0), 0);
    const outstanding = currencyInvoices.reduce((sum, invoice) => sum + Number(invoice.amount_remaining ?? 0), 0);
    const metrics = profitability({ revenue: project.value_amount == null ? null : Number(project.value_amount), expenses: directExpenses, trackedSeconds, internalHourlyCost: settings.data?.internal_hourly_cost == null ? null : Number(settings.data.internal_hourly_cost) });
    const scopeProgress = scopeDelivery(scope.data ?? [], tasks.data ?? [], focus);
    return NextResponse.json({ project, scope: scope.data ?? [], changes: changes.data ?? [], tasks: tasks.data ?? [], metrics: { ...metrics, received, invoiced, outstanding, directExpenses, currency }, scopeProgress });
  } catch (error) { return apiError(error, "Project business data could not be loaded."); }
}

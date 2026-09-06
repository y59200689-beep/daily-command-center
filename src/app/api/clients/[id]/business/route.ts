import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { clientLifecycle, profitability, trackedProjectSeconds } from "@/lib/business";
import { requireUser } from "@/lib/supabase/server";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; const { supabase, userId } = await requireUser();
    const { data: client, error: clientError } = await supabase.from("clients").select("id,name,last_contact_at").eq("id", id).eq("user_id", userId).is("deleted_at", null).maybeSingle();
    if (clientError) throw clientError; if (!client) return NextResponse.json({ error: "Client not found." }, { status: 404 });
    const [projects, opportunities, proposals, invoices, payments, expenses, settings] = await Promise.all([
      supabase.from("projects").select("id,name,status,value_amount,currency").eq("client_id", id).eq("user_id", userId).is("deleted_at", null),
      supabase.from("opportunities").select("id,title,stage,estimated_value,currency,next_action,next_action_date").eq("client_id", id).eq("user_id", userId).is("archived_at", null).order("updated_at", { ascending: false }),
      supabase.from("proposals").select("id,title,status,total,currency,valid_until").eq("client_id", id).eq("user_id", userId).is("archived_at", null).order("updated_at", { ascending: false }),
      supabase.from("invoices").select("id,total_amount,amount_remaining,currency,due_date,paid_at,status").eq("client_id", id).eq("user_id", userId).is("deleted_at", null),
      supabase.from("payments").select("id,amount,currency,payment_date").eq("client_id", id).eq("user_id", userId).is("deleted_at", null),
      supabase.from("expenses").select("id,amount,currency,project_id").eq("client_id", id).eq("user_id", userId).is("deleted_at", null),
      supabase.from("business_settings").select("internal_hourly_cost").eq("user_id", userId).maybeSingle(),
    ]);
    const failed = [projects, opportunities, proposals, invoices, payments, expenses, settings].find((item) => item.error); if (failed?.error) throw failed.error;
    const projectIds = (projects.data ?? []).map((project) => project.id); const [tasks, directFocus] = await Promise.all([
      projectIds.length ? supabase.from("tasks").select("id,project_id").eq("user_id", userId).in("project_id", projectIds).is("deleted_at", null) : Promise.resolve({ data: [], error: null }),
      projectIds.length ? supabase.from("focus_sessions").select("id,project_id,task_id,duration_seconds").eq("user_id", userId).in("project_id", projectIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (tasks.error || directFocus.error) throw tasks.error ?? directFocus.error;
    const taskIds = (tasks.data ?? []).map((task) => task.id); const taskFocus = taskIds.length ? await supabase.from("focus_sessions").select("id,project_id,task_id,duration_seconds").eq("user_id", userId).in("task_id", taskIds) : { data: [], error: null };
    if (taskFocus.error) throw taskFocus.error;
    const focus = [...(directFocus.data ?? []), ...(taskFocus.data ?? [])]; const currencyGroups: Record<string, Record<string, unknown>> = {};
    for (const project of projects.data ?? []) { const currency = String(project.currency ?? "MAD"); const group = currencyGroups[currency] ??= { received: 0, outstanding: 0, directExpenses: 0, trackedSeconds: 0, agreedValue: 0 }; const projectTasks = (tasks.data ?? []).filter((task) => task.project_id === project.id); group.trackedSeconds = Number(group.trackedSeconds) + trackedProjectSeconds(project.id, focus, projectTasks); group.agreedValue = Number(group.agreedValue) + Number(project.value_amount ?? 0); }
    for (const payment of payments.data ?? []) { const group = currencyGroups[String(payment.currency ?? "MAD")] ??= { received: 0, outstanding: 0, directExpenses: 0, trackedSeconds: 0, agreedValue: 0 }; group.received = Number(group.received) + Number(payment.amount ?? 0); }
    for (const invoice of invoices.data ?? []) { const group = currencyGroups[String(invoice.currency ?? "MAD")] ??= { received: 0, outstanding: 0, directExpenses: 0, trackedSeconds: 0, agreedValue: 0 }; group.outstanding = Number(group.outstanding) + Number(invoice.amount_remaining ?? 0); }
    for (const expense of expenses.data ?? []) { const group = currencyGroups[String(expense.currency ?? "MAD")] ??= { received: 0, outstanding: 0, directExpenses: 0, trackedSeconds: 0, agreedValue: 0 }; group.directExpenses = Number(group.directExpenses) + Number(expense.amount ?? 0); }
    const profitabilityByCurrency = Object.fromEntries(Object.entries(currencyGroups).map(([currency, group]) => [currency, profitability({ revenue: Number(group.agreedValue) || null, expenses: Number(group.directExpenses), trackedSeconds: Number(group.trackedSeconds), internalHourlyCost: settings.data?.internal_hourly_cost == null ? null : Number(settings.data.internal_hourly_cost) })]));
    const firstGroup = Object.values(currencyGroups)[0] as Record<string, unknown> | undefined; const lifecycle = clientLifecycle({ received: Number(firstGroup?.received ?? 0), activeProjects: (projects.data ?? []).filter((project) => project.status === "active").length, openOpportunities: (opportunities.data ?? []).filter((opportunity) => !["won", "lost"].includes(String(opportunity.stage))).length, lastContactAt: client.last_contact_at });
    return NextResponse.json({ client, projects: projects.data ?? [], opportunities: opportunities.data ?? [], proposals: proposals.data ?? [], lifecycle, currencies: currencyGroups, profitability: profitabilityByCurrency });
  } catch (error) { return apiError(error, "Client business data could not be loaded."); }
}

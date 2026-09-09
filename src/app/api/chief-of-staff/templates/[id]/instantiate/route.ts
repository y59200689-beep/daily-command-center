import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";

const TEMPLATE_MAP: Record<string, { title: string; domain: string; steps: Array<{ title: string; action_type: string }> }> = {
  tpl_client_payment: {
    title: "Client Payment Follow-up",
    domain: "finance",
    steps: [
      { title: "Review unpaid invoice ledger", action_type: "review_invoice" },
      { title: "Draft polite payment reminder email", action_type: "send_email" },
      { title: "Schedule follow-up check in 3 days", action_type: "create_followup" },
    ],
  },
  tpl_client_renewal: {
    title: "Client Renewal Preparation",
    domain: "success",
    steps: [
      { title: "Review client success plan outcomes", action_type: "review_outcomes" },
      { title: "Draft renewal proposition email", action_type: "send_email" },
      { title: "Create executive calendar meeting", action_type: "create_calendar_event" },
    ],
  },
  tpl_supplier_reorder: {
    title: "Supplier Reorder Preparation",
    domain: "commerce",
    steps: [
      { title: "Audit low stock inventory levels", action_type: "audit_stock" },
      { title: "Prepare supplier order draft", action_type: "create_supplier_order_draft" },
      { title: "Notify warehouse manager", action_type: "create_task" },
    ],
  },
  tpl_incident_followup: {
    title: "Operational Incident Follow-up",
    domain: "operations",
    steps: [
      { title: "Document root cause and impact", action_type: "create_incident_review" },
      { title: "Assign SOP revision task", action_type: "create_task" },
    ],
  },
  tpl_executive_followthrough: {
    title: "Executive Review Follow-through",
    domain: "executive",
    steps: [
      { title: "Break priority into discrete tasks", action_type: "create_task" },
      { title: "Schedule mid-week progress review", action_type: "create_followup" },
    ],
  },
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, userId } = await requireUser();
    const { id } = await context.params;

    const tpl = TEMPLATE_MAP[id];
    if (!tpl) {
      return NextResponse.json({ error: "Template not found." }, { status: 404 });
    }

    // Insert plan into action_plans
    const { data: plan, error: planError } = await supabase
      .from("action_plans")
      .insert({
        user_id: userId,
        title: tpl.title,
        source_domain: tpl.domain,
        status: "pending_approval",
      })
      .select("*")
      .single();

    if (planError) throw planError;

    const stepRows = tpl.steps.map((s, idx) => ({
      user_id: userId,
      plan_id: plan.id,
      position: idx,
      title: s.title,
      action_type: s.action_type,
      requires_approval: s.action_type === "send_email" || s.action_type === "create_calendar_event",
      status: "pending",
    }));

    await supabase.from("action_plan_steps").insert(stepRows);

    return NextResponse.json({ success: true, plan });
  } catch (error) {
    return apiError(error, "Failed to instantiate template.");
  }
}

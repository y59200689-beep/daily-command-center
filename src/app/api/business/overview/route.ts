import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { dateWithinHorizon, forecastRange, groupedRevenueForecast, type ForecastHorizon } from "@/lib/business";
import { requireUser } from "@/lib/supabase/server";

const horizons = new Set<ForecastHorizon>(["this_month", "next_month", "quarter"]);
export async function GET(request: NextRequest) {
  try {
    const requested = request.nextUrl.searchParams.get("horizon") ?? "this_month";
    const horizon: ForecastHorizon = horizons.has(requested as ForecastHorizon) ? requested as ForecastHorizon : "this_month";
    const { supabase, userId } = await requireUser();
    const [invoices, payments, opportunities, proposals, projects] = await Promise.all([
      supabase.from("invoices").select("id,total_amount,amount_remaining,currency,status,due_date,issue_date,client_id").eq("user_id", userId).is("deleted_at", null),
      supabase.from("payments").select("id,amount,currency,payment_date,client_id").eq("user_id", userId).is("deleted_at", null),
      supabase.from("opportunities").select("id,title,stage,estimated_value,currency,probability,expected_close_date,next_action,next_action_date,updated_at,client_id").eq("user_id", userId).is("archived_at", null),
      supabase.from("proposals").select("id,title,status,total,currency,valid_until,accepted_at,updated_at,opportunity_id,client_id").eq("user_id", userId).is("archived_at", null),
      supabase.from("projects").select("id,name,value_amount,currency,status,client_id,updated_at").eq("user_id", userId).is("deleted_at", null).limit(50),
    ]);
    const failure = [invoices, payments, opportunities, proposals, projects].find((query) => query.error); if (failure?.error) throw failure.error;
    const range = forecastRange(horizon); const inRange = (value: string | null | undefined) => dateWithinHorizon(value, range);
    const acceptedOpportunityIds = new Set((proposals.data ?? []).filter((proposal) => proposal.status === "accepted").map((proposal) => proposal.opportunity_id).filter(Boolean));
    const forecast = groupedRevenueForecast({
      invoices: (invoices.data ?? []).filter((invoice) => inRange(invoice.due_date ?? invoice.issue_date)),
      payments: (payments.data ?? []).filter((payment) => inRange(payment.payment_date)),
      proposals: (proposals.data ?? []).filter((proposal) => proposal.status === "accepted" && inRange(proposal.accepted_at ?? proposal.updated_at)),
      opportunities: (opportunities.data ?? []).filter((opportunity) => !acceptedOpportunityIds.has(opportunity.id) && (!opportunity.expected_close_date || inRange(opportunity.expected_close_date))),
    });
    const now = Date.now();
    const risks = [
      ...(proposals.data ?? []).filter((proposal) => proposal.status === "sent" && proposal.valid_until && new Date(proposal.valid_until).getTime() - now < 7 * 86400000).map((proposal) => ({ type: "proposal_expiring", title: proposal.title, detail: "Proposal expires within seven days.", route: `/proposals?proposal=${proposal.id}` })),
      ...(opportunities.data ?? []).filter((opportunity) => !["won", "lost"].includes(String(opportunity.stage)) && !opportunity.next_action).map((opportunity) => ({ type: "opportunity_followup", title: opportunity.title, detail: "No next sales action is scheduled.", route: `/pipeline?opportunity=${opportunity.id}` })),
      ...(invoices.data ?? []).filter((invoice) => Number(invoice.amount_remaining) > 0 && invoice.due_date && new Date(invoice.due_date).getTime() < now).map((invoice) => ({ type: "overdue_invoice", title: "Overdue invoice", detail: `${invoice.amount_remaining} ${invoice.currency} remains outstanding.`, route: `/invoices/${invoice.id}` })),
    ].slice(0, 6);
    return NextResponse.json({ horizon, range: { start: range.start.toISOString(), end: range.end.toISOString() }, forecast, risks, opportunities: opportunities.data ?? [], proposals: proposals.data ?? [], projects: projects.data ?? [] });
  } catch (error) { return apiError(error, "Business overview could not be loaded."); }
}

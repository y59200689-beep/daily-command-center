import { dateWithinHorizon, forecastRange, stageProbability, type ForecastHorizon, type OpportunityStage } from "@/lib/business";

export type BusinessRecord = Record<string, unknown> & { id: string; created_at?: string; updated_at?: string };
export type BusinessOverviewData = {
  horizon: ForecastHorizon;
  forecast: { currencies: Record<string, { received: number; outstanding: number; committed: number; weightedPipeline: number; potential: number }> };
  risks: Array<{ type: string; title: string; detail: string; route: string }>;
  opportunities: BusinessRecord[]; proposals: BusinessRecord[]; projects: BusinessRecord[];
};
export const salesStageGroups = [
  { id: "new", label: "Leads", stages: ["new"] },
  { id: "qualified", label: "Qualified", stages: ["qualified", "meeting"] },
  { id: "proposal", label: "Proposal", stages: ["proposal"] },
  { id: "negotiation", label: "Negotiation", stages: ["negotiation"] },
  { id: "won", label: "Won", stages: ["won"] },
] as const;
export function recordCurrency(row: BusinessRecord) { return String(row.currency || "MAD"); }
export function isOpenOpportunity(row: BusinessRecord) { return !["won", "lost"].includes(String(row.stage)); }
export function weightedOpportunity(row: BusinessRecord) {
  return Number(row.estimated_value ?? 0) * Number(row.probability ?? stageProbability[row.stage as OpportunityStage] ?? 0) / 100;
}
export function businessSummary(records: Record<string, BusinessRecord[]>, currency: string) {
  const leads = (records.leads ?? []).filter(row => !["converted", "unqualified", "lost"].includes(String(row.status)));
  const active = (records.opportunities ?? []).filter(isOpenOpportunity);
  return {
    leads, active,
    weighted: active.filter(row => recordCurrency(row) === currency).reduce((sum, row) => sum + weightedOpportunity(row), 0),
    committed: (records.proposals ?? []).filter(row => row.status === "accepted" && recordCurrency(row) === currency).reduce((sum, row) => sum + Number(row.total ?? 0), 0),
  };
}
export function pipelineStages(opportunities: BusinessRecord[], currency: string, metric: "total" | "weighted" | "count") {
  const rows = opportunities.filter(row => recordCurrency(row) === currency);
  const groups = salesStageGroups.map(group => {
    const matches = rows.filter(row => (group.stages as readonly string[]).includes(String(row.stage)));
    return { ...group, rows: matches, count: matches.length, value: metric === "count" ? matches.length : matches.reduce((sum, row) => sum + (metric === "weighted" ? weightedOpportunity(row) : Number(row.estimated_value ?? 0)), 0) };
  });
  const total = groups.reduce((sum, group) => sum + group.value, 0);
  return groups.map(group => ({ ...group, percent: total ? Math.round(group.value / total * 100) : 0 }));
}
export function commercialPeriodRows(rows: BusinessRecord[], period: "this_month" | "quarter" | "all", now = new Date()) {
  const range = period === "all" ? null : forecastRange(period, now);
  return rows.filter(row => !range || dateWithinHorizon(row.updated_at ?? row.created_at, range));
}
export function commercialState(opportunities: BusinessRecord[], proposals: BusinessRecord[], period: "this_month" | "quarter" | "all", now = new Date()) {
  const rows = commercialPeriodRows(opportunities, period, now);
  const won = rows.filter(row => row.stage === "won").length;
  const lost = rows.filter(row => row.stage === "lost").length;
  return { pending: commercialPeriodRows(proposals, period, now).filter(row => row.status === "sent").length, negotiation: rows.filter(row => row.stage === "negotiation").length, won, closed: won + lost, winRate: won + lost ? Math.round(won / (won + lost) * 100) : null };
}

/** Undated opportunities stay visible separately; no invented weekly attribution. */
export function forecastSeries(opportunities: BusinessRecord[], proposals: BusinessRecord[], currency: string, horizon: ForecastHorizon, now = new Date()) {
  const range = forecastRange(horizon, now);
  const count = horizon === "quarter" ? 3 : Math.ceil(new Date(range.end.getTime() - 1).getDate() / 7);
  const buckets = Array.from({ length: count }, (_, index) => {
    const start = horizon === "quarter" ? new Date(range.start.getFullYear(), range.start.getMonth() + index, 1) : new Date(range.start.getFullYear(), range.start.getMonth(), 1 + index * 7);
    const end = horizon === "quarter" ? new Date(start.getFullYear(), start.getMonth() + 1, 1) : new Date(Math.min(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7).getTime(), range.end.getTime()));
    return { label: horizon === "quarter" ? start.toLocaleDateString("en", { month: "short" }) : `W${index + 1}`, dates: `${start.toLocaleDateString("en", { month: "short", day: "numeric" })}–${new Date(end.getTime() - 1).getDate()}`, start, end, committed: 0, potential: 0 };
  });
  const accepted = proposals.filter(row => row.status === "accepted");
  const acceptedIds = new Set(accepted.map(row => row.opportunity_id).filter(Boolean));
  for (const proposal of accepted.filter(row => recordCurrency(row) === currency)) {
    const bucket = buckets.find(item => dateWithinHorizon(String(proposal.accepted_at ?? proposal.updated_at ?? ""), item));
    if (bucket) bucket.committed += Number(proposal.total ?? 0);
  }
  let unscheduled = 0;
  for (const opportunity of opportunities.filter(row => isOpenOpportunity(row) && recordCurrency(row) === currency && !acceptedIds.has(row.id))) {
    if (!opportunity.expected_close_date) { unscheduled += weightedOpportunity(opportunity); continue; }
    const bucket = buckets.find(item => dateWithinHorizon(String(opportunity.expected_close_date), item));
    if (bucket) bucket.potential += weightedOpportunity(opportunity);
  }
  return { buckets, unscheduled, committed: buckets.reduce((sum, bucket) => sum + bucket.committed, 0), potential: buckets.reduce((sum, bucket) => sum + bucket.potential, 0) };
}

import type { BusinessRecord } from "./business-dashboard";
export type GrowthRow = BusinessRecord;
export type GrowthSnapshot = { opportunities: GrowthRow[]; invoices: GrowthRow[]; payments: GrowthRow[]; proposals: GrowthRow[]; proposalItems: GrowthRow[]; clients: GrowthRow[]; services: GrowthRow[] };
export const emptyGrowthSnapshot: GrowthSnapshot = { opportunities: [], invoices: [], payments: [], proposals: [], proposalItems: [], clients: [], services: [] };
export const growthStages = [
  { id: "proposal", label: "Proposal", stages: ["proposal"], color: "#9e7aff" },
  { id: "negotiation", label: "Negotiation", stages: ["negotiation"], color: "#ffb57b" },
  { id: "qualified", label: "Qualified", stages: ["qualified", "meeting"], color: "#7fb4ff" },
  { id: "new", label: "Discovery", stages: ["new", "discovery"], color: "#7fe0b1" },
  { id: "won", label: "Won", stages: ["won"], color: "#b9a1f7" },
];
const code = (row: GrowthRow) => String(row.currency || "MAD");
const value = (row: GrowthRow, key: string) => Number(row[key] ?? 0);
export function growthTotals(snapshot: GrowthSnapshot, currency: string, now = new Date()) {
  const month = now.toISOString().slice(0, 7);
  const opportunities = snapshot.opportunities.filter(row => code(row) === currency);
  return {
    openPipeline: opportunities.filter(row => !["won", "lost"].includes(String(row.stage))).reduce((sum, row) => sum + value(row, "estimated_value"), 0),
    wonThisMonth: opportunities.filter(row => row.stage === "won" && String(row.won_at ?? "").startsWith(month)).reduce((sum, row) => sum + value(row, "estimated_value"), 0),
    invoicedTotal: snapshot.invoices.filter(row => code(row) === currency && !["draft", "cancelled", "void"].includes(String(row.status))).reduce((sum, row) => sum + value(row, "total_amount"), 0),
    collectedTotal: snapshot.payments.filter(row => code(row) === currency).reduce((sum, row) => sum + value(row, "amount"), 0),
  };
}
export function growthStageSeries(rows: GrowthRow[], currency: string, period: "all" | "this_month", now = new Date()) {
  const month = now.toISOString().slice(0, 7);
  const matches = rows.filter(row => code(row) === currency && (period === "all" || String(row.updated_at ?? row.created_at ?? "").startsWith(month)));
  const series = growthStages.map(stage => ({ ...stage, rows: matches.filter(row => stage.stages.includes(String(row.stage))), value: matches.filter(row => stage.stages.includes(String(row.stage))).reduce((sum, row) => sum + value(row, "estimated_value"), 0) }));
  const total = series.reduce((sum, row) => sum + row.value, 0);
  return { total, series: series.map(row => ({ ...row, share: total ? Math.round(row.value / total * 100) : 0 })) };
}
/** Each accepted service line contributes once, in its proposal's currency and acceptance month. */
export function serviceRevenueSeries(snapshot: GrowthSnapshot, currency: string, months: number, now = new Date()) {
  const buckets = Array.from({ length: months }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - months + 1 + index, 1);
    return { month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`, label: date.toLocaleDateString("en", { month: "short" }), value: 0 };
  });
  const proposals = new Map(snapshot.proposals.filter(row => row.status === "accepted" && code(row) === currency).map(row => [row.id, row]));
  const serviceIds = new Set(snapshot.services.map(row => row.id));
  const clients = new Set<string>(); const services = new Set<string>(); const accepted = new Set<string>();
  for (const item of snapshot.proposalItems) {
    if (!serviceIds.has(String(item.service_id))) continue;
    const proposal = proposals.get(String(item.proposal_id));
    if (!proposal) continue;
    const bucket = buckets.find(row => row.month === String(proposal.accepted_at ?? proposal.updated_at ?? "").slice(0, 7));
    if (!bucket) continue;
    bucket.value += value(item, "total"); services.add(String(item.service_id)); accepted.add(proposal.id);
    if (proposal.client_id) clients.add(String(proposal.client_id));
  }
  return { buckets, revenue: buckets.reduce((sum, row) => sum + row.value, 0), clients: clients.size, services: services.size, accepted: accepted.size };
}

import { z } from "zod";

const blank = (value: unknown) => typeof value === "string" && value.trim() === "" ? null : value;
const optionalText = (maximum = 5000) => z.preprocess(blank, z.string().trim().max(maximum).nullable().optional());
const optionalUuid = z.preprocess(blank, z.uuid().nullable().optional());
const optionalMoney = z.preprocess(blank, z.coerce.number().finite().nonnegative().nullable().optional());
const optionalDate = z.preprocess(blank, z.iso.date().nullable().optional());
export const businessCurrency = z.string().trim().length(3).transform((value) => value.toUpperCase()).default("MAD");

export const leadSchema = z.object({
  name: z.string().trim().min(1).max(240), company: optionalText(240), email: z.preprocess(blank, z.email().nullable().optional()), phone: optionalText(80),
  source: z.enum(["referral", "instagram", "website", "email", "whatsapp_manual", "networking", "existing_client", "other"]).default("other"),
  status: z.enum(["new", "contacted", "qualified", "unqualified", "converted", "lost"]).default("new"), potential_value: optionalMoney, currency: businessCurrency,
  notes: optionalText(10000), last_contact_at: z.preprocess(blank, z.iso.datetime({ offset: true }).nullable().optional()), next_follow_up_at: z.preprocess(blank, z.iso.datetime({ offset: true }).nullable().optional()),
});

export const serviceSchema = z.object({
  name: z.string().trim().min(1).max(240), description: optionalText(10000), category: optionalText(120), default_price: optionalMoney, currency: businessCurrency,
  pricing_type: z.enum(["fixed", "hourly", "monthly", "custom"]).default("custom"), estimated_hours: z.preprocess(blank, z.coerce.number().finite().positive().nullable().optional()), active: z.boolean().default(true),
});

export const opportunityStages = ["new", "qualified", "meeting", "proposal", "negotiation", "won", "lost"] as const;
export type OpportunityStage = (typeof opportunityStages)[number];
export const opportunitySchema = z.object({
  lead_id: optionalUuid, client_id: optionalUuid, title: z.string().trim().min(1).max(240), stage: z.enum(opportunityStages).default("new"), estimated_value: optionalMoney,
  currency: businessCurrency, probability: z.preprocess(blank, z.coerce.number().int().min(0).max(100).nullable().optional()), expected_close_date: optionalDate,
  source: optionalText(120), project_type: optionalText(120), next_action: optionalText(1000), next_action_date: optionalDate,
  lost_reason: z.preprocess(blank, z.enum(["price", "no_response", "competitor", "timing", "budget", "not_a_fit", "other"]).nullable().optional()),
});

export const proposalItemSchema = z.object({
  id: z.uuid().optional(), service_id: optionalUuid, position: z.coerce.number().int().min(0).default(0), title: z.string().trim().min(1).max(240), description: optionalText(5000),
  quantity: z.coerce.number().finite().positive().default(1), unit_price: z.coerce.number().finite().nonnegative().default(0), estimated_hours: z.preprocess(blank, z.coerce.number().finite().positive().nullable().optional()),
});
export const proposalSchema = z.object({
  opportunity_id: optionalUuid, lead_id: optionalUuid, client_id: optionalUuid, title: z.string().trim().min(1).max(240), proposal_number: optionalText(120),
  status: z.enum(["draft", "sent", "accepted", "rejected", "expired"]).default("draft"), currency: businessCurrency, discount_amount: z.coerce.number().finite().nonnegative().default(0), tax_amount: z.coerce.number().finite().nonnegative().default(0),
  valid_until: optionalDate, timeline: optionalText(4000), notes: optionalText(10000), terms: optionalText(20000), items: z.array(proposalItemSchema).max(100).default([]),
});

export const scopeItemSchema = z.object({
  project_id: z.uuid(), proposal_item_id: optionalUuid, service_id: optionalUuid, title: z.string().trim().min(1).max(240), description: optionalText(5000), quantity: z.coerce.number().finite().positive().default(1),
  agreed_value: optionalMoney, estimated_hours: z.preprocess(blank, z.coerce.number().finite().positive().nullable().optional()), status: z.enum(["not_started", "in_progress", "delivered", "removed"]).default("not_started"), included: z.boolean().default(true),
});
export const scopeChangeSchema = z.object({ project_id: z.uuid(), scope_item_id: optionalUuid, title: z.string().trim().min(1).max(240), description: z.string().trim().min(1).max(5000), estimated_value: optionalMoney, estimated_hours: z.preprocess(blank, z.coerce.number().finite().positive().nullable().optional()), currency: businessCurrency, status: z.enum(["proposed", "approved", "rejected", "completed"]).default("proposed"), approved: z.boolean().nullable().optional(), notes: optionalText(5000) });
export const businessSettingsSchema = z.object({ default_currency: businessCurrency, internal_hourly_cost: optionalMoney, default_proposal_validity_days: z.preprocess(blank, z.coerce.number().int().min(1).max(365).nullable().optional()), default_tax_rate: z.preprocess(blank, z.coerce.number().finite().min(0).max(100).nullable().optional()), business_name: optionalText(240), proposal_number_prefix: optionalText(30) });

export const businessResourceSchemas = { leads: leadSchema, services: serviceSchema, opportunities: opportunitySchema, proposals: proposalSchema, "scope-items": scopeItemSchema, "scope-changes": scopeChangeSchema, settings: businessSettingsSchema } as const;
export type BusinessResource = keyof typeof businessResourceSchemas;
export function isBusinessResource(value: string): value is BusinessResource { return value in businessResourceSchemas; }
export const businessResourceTables: Record<Exclude<BusinessResource, "settings">, string> = { leads: "leads", services: "services", opportunities: "opportunities", proposals: "proposals", "scope-items": "scope_items", "scope-changes": "scope_change_requests" };

export function proposalTotals(items: Array<{ quantity: number; unit_price: number }>, discount = 0, tax = 0) {
  const subtotal = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price), 0);
  const total = Math.max(0, subtotal - Number(discount) + Number(tax));
  return { subtotal, total, itemTotals: items.map((item) => Number(item.quantity) * Number(item.unit_price)) };
}

export const stageProbability: Record<OpportunityStage, number> = { new: 10, qualified: 25, meeting: 40, proposal: 60, negotiation: 75, won: 100, lost: 0 };
export function effectiveProbability(opportunity: { stage: OpportunityStage; probability?: number | null }) { return opportunity.probability ?? stageProbability[opportunity.stage]; }
export function opportunityAgeDays(history: Array<{ changed_at: string }>, now = new Date()) { const latest = history.slice().sort((a, b) => b.changed_at.localeCompare(a.changed_at))[0]?.changed_at; return Math.max(0, Math.floor((now.getTime() - new Date(latest ?? now).getTime()) / 86400000)); }

type MoneyRow = { currency?: string | null; amount?: number | string | null; total?: number | string | null; total_amount?: number | string | null; amount_remaining?: number | string | null; status?: string | null; paid_at?: string | null; issue_date?: string | null; due_date?: string | null };
type OpportunityRow = { currency?: string | null; estimated_value?: number | string | null; stage: OpportunityStage; probability?: number | null; expected_close_date?: string | null };
export function groupedRevenueForecast({ invoices, payments, opportunities, proposals, now = new Date() }: { invoices: MoneyRow[]; payments: MoneyRow[]; opportunities: OpportunityRow[]; proposals: MoneyRow[]; now?: Date }) {
  const result: Record<string, { received: number; outstanding: number; committed: number; weightedPipeline: number; potential: number; excludedOpportunities: number }> = {};
  const bucket = (currency: string) => result[currency] ??= { received: 0, outstanding: 0, committed: 0, weightedPipeline: 0, potential: 0, excludedOpportunities: 0 };
  for (const payment of payments) bucket(String(payment.currency ?? "MAD")).received += Number(payment.amount ?? 0);
  for (const invoice of invoices) if (!["paid", "cancelled"].includes(String(invoice.status))) bucket(String(invoice.currency ?? "MAD")).outstanding += Number(invoice.amount_remaining ?? Math.max(0, Number(invoice.total_amount ?? paymentAmount(invoice))));
  for (const proposal of proposals) if (String(proposal.status) === "accepted") bucket(String(proposal.currency ?? "MAD")).committed += Number(proposal.total ?? proposal.total_amount ?? proposal.amount ?? 0);
  for (const opportunity of opportunities) {
    if (["won", "lost"].includes(opportunity.stage)) continue;
    const value = opportunity.estimated_value == null ? null : Number(opportunity.estimated_value);
    if (value == null) { bucket(String(opportunity.currency ?? "MAD")).excludedOpportunities += 1; continue; }
    const valueBucket = bucket(String(opportunity.currency ?? "MAD"));
    valueBucket.weightedPipeline += value * effectiveProbability(opportunity) / 100;
  }
  for (const value of Object.values(result)) value.potential = value.received + value.outstanding + value.committed + value.weightedPipeline;
  return { asOf: now.toISOString(), currencies: result };
}
export type ForecastHorizon = "this_month" | "next_month" | "quarter";
export function forecastRange(horizon: ForecastHorizon, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  if (horizon === "next_month") { start.setMonth(start.getMonth() + 1); const end = new Date(start.getFullYear(), start.getMonth() + 1, 1); return { start, end }; }
  if (horizon === "quarter") { const quarterStart = Math.floor(now.getMonth() / 3) * 3; start.setMonth(quarterStart); return { start, end: new Date(start.getFullYear(), start.getMonth() + 3, 1) }; }
  return { start, end: new Date(start.getFullYear(), start.getMonth() + 1, 1) };
}
export function dateWithinHorizon(value: string | null | undefined, range: { start: Date; end: Date }) {
  if (!value) return false; const date = new Date(value); return !Number.isNaN(date.getTime()) && date >= range.start && date < range.end;
}
function paymentAmount(row: MoneyRow) { return Number(row.amount ?? 0); }

export function profitability({ revenue, expenses, trackedSeconds, internalHourlyCost }: { revenue: number | null; expenses: number; trackedSeconds: number | null; internalHourlyCost: number | null }) {
  const trackedHours = trackedSeconds == null ? null : trackedSeconds / 3600;
  const effectiveRevenuePerHour = revenue != null && trackedHours && trackedHours > 0 ? revenue / trackedHours : null;
  const timeCost = trackedHours != null && internalHourlyCost != null ? trackedHours * internalHourlyCost : null;
  const cashProfit = revenue == null ? null : revenue - expenses;
  const estimatedProfit = revenue != null && timeCost != null ? revenue - expenses - timeCost : null;
  return { revenue, expenses, trackedHours, effectiveRevenuePerHour, timeCost, cashProfit, estimatedProfit, timeCoverage: trackedHours == null ? "unavailable" : "based_on_tracked_time" };
}

type FocusRow = { id: string; project_id?: string | null; task_id?: string | null; duration_seconds?: number | string | null; ended_at?: string | null };
type TaskScopeRow = { id: string; scope_item_id?: string | null; scope_status?: "in_scope" | "out_of_scope" | "unclear" | null };
export function trackedProjectSeconds(projectId: string, focus: FocusRow[], tasks: TaskScopeRow[]) {
  const taskIds = new Set(tasks.map((task) => task.id));
  const seen = new Set<string>();
  return focus.reduce((seconds, session) => {
    if (seen.has(session.id) || (session.project_id !== projectId && !taskIds.has(String(session.task_id ?? "")))) return seconds;
    seen.add(session.id); return seconds + Number(session.duration_seconds ?? 0);
  }, 0);
}
export function scopeDelivery(scope: Array<{ status?: string | null; estimated_hours?: number | string | null }>, tasks: TaskScopeRow[], focus: FocusRow[]) {
  const active = scope.filter((item) => item.status !== "removed");
  const scopeIds = new Set(active.map((item) => String((item as { id?: string }).id ?? "")));
  const byScope = new Map<string, number>();
  const taskScope = new Map(tasks.map((task) => [task.id, task.scope_item_id ?? null]));
  for (const session of focus) { const scopeId = session.task_id ? taskScope.get(session.task_id) : null; if (scopeId && scopeIds.has(scopeId)) byScope.set(scopeId, (byScope.get(scopeId) ?? 0) + Number(session.duration_seconds ?? 0)); }
  const delivered = active.filter((item) => item.status === "delivered").length;
  const overHours = active.filter((item) => { const hours = Number(item.estimated_hours ?? 0); return hours > 0 && (byScope.get(String((item as { id?: string }).id ?? "")) ?? 0) / 3600 > hours; }).map((item) => String((item as { id?: string }).id ?? ""));
  const outOfScopeSeconds = focus.filter((session) => session.task_id && tasks.find((task) => task.id === session.task_id)?.scope_status === "out_of_scope").reduce((sum, session) => sum + Number(session.duration_seconds ?? 0), 0);
  return { activeCount: active.length, deliveredCount: delivered, deliveredRatio: active.length ? delivered / active.length : null, trackedSecondsByScope: Object.fromEntries(byScope), exceededScopeIds: overHours, outOfScopeSeconds };
}
export function clientLifecycle({ received, activeProjects, openOpportunities, lastContactAt, now = new Date() }: { received: number; activeProjects: number; openOpportunities: number; lastContactAt?: string | null; now?: Date }) {
  if (activeProjects > 0) return "active" as const;
  if (!received && !openOpportunities) return "prospect" as const;
  if (openOpportunities > 0) return "past_client" as const;
  if (lastContactAt && (now.getTime() - new Date(lastContactAt).getTime()) > 90 * 86400000) return "dormant" as const;
  return "past_client" as const;
}
export function isReactivationCandidate({ received, activeProjects, openOpportunities, lastContactAt, unresolvedBalance, lastCompletedAt, now = new Date() }: { received: number; activeProjects: number; openOpportunities: number; lastContactAt?: string | null; unresolvedBalance: number; lastCompletedAt?: string | null; now?: Date }) {
  if (received <= 0 || activeProjects > 0 || openOpportunities > 0 || unresolvedBalance > 0 || !lastCompletedAt) return false;
  const quietSince = Math.max(new Date(lastCompletedAt).getTime(), lastContactAt ? new Date(lastContactAt).getTime() : 0);
  return Number.isFinite(quietSince) && now.getTime() - quietSince >= 75 * 86400000;
}
export function pricingHistory(rows: Array<{ amount?: number | string | null; trackedSeconds?: number | string | null; status?: string | null }>) {
  const won = rows.filter((row) => row.status === "won" || row.status === "accepted").map((row) => Number(row.amount ?? 0)).filter((amount) => amount > 0).sort((a, b) => a - b);
  const tracked = rows.map((row) => Number(row.trackedSeconds ?? 0)).filter((seconds) => seconds > 0).sort((a, b) => a - b);
  const median = (values: number[]) => !values.length ? null : values.length % 2 ? values[(values.length - 1) / 2] : (values[values.length / 2 - 1] + values[values.length / 2]) / 2;
  return { sampleSize: won.length, limitedData: won.length < 3, saleRange: won.length ? { min: won[0], max: won[won.length - 1] } : null, medianSale: median(won), averageSale: won.length ? won.reduce((sum, value) => sum + value, 0) / won.length : null, medianTrackedHours: median(tracked.map((seconds) => seconds / 3600)) };
}

export function weeklyBusinessMetrics(input: { leadsCreated: number; opportunitiesCreated: number; opportunitiesAdvanced: number; proposalsSent: number; dealsWon: number; dealsLost: number; trackedSeconds: number; scopeCreep: number; profitabilityWarnings: number; reactivationCandidates: number }) {
  return { ...input, trackedHours: input.trackedSeconds / 3600 };
}

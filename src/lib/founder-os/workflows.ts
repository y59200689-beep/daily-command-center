import { z } from "zod";
const text = z.string().trim().max(10000).default("");
const metric = z.number().finite().nullable().default(null);
export const decisionOption = z.object({ label: z.string().trim().min(1).max(240), description: text, benefits: text, risks: text, estimated_impact: text, selected: z.boolean().default(false) }).strict();
export const decisionWorkflow = z.object({
  options: z.array(decisionOption).max(20).default([]), operational_exposure: text, expected_value: metric,
  review: z.object({ actual_outcome: z.string().trim().min(5).max(10000), actual_metric: metric, what_was_correct: text, what_was_wrong: text, what_changed: text, lesson: text, disposition: z.enum(["remain", "change", "reverse", "followup"]), reviewed_on: z.iso.date() }).strict().nullable().default(null),
}).strict().refine(v => v.options.filter(o => o.selected).length <= 1, "Select at most one option.");
export const postmortemSchema = z.object({
  summary: text, occurred_on: z.union([z.iso.date(), z.literal("")]).default(""), duration_minutes: z.number().nonnegative().nullable().default(null),
  customers_affected: text, revenue_impact: text, operational_impact: text, work_blocked: text,
  immediate_cause: text, contributing_factors: text, underlying_cause: text,
  detection: text, expected_detection: text, monitoring_gap: text,
  resolution: text, temporary_mitigation: text, permanent_correction: text,
  prevention: text, prevention_owner: text, prevention_due: z.union([z.iso.date(), z.literal("")]).default(""),
  lesson: text, recurrence_risk: text, followup_on: z.union([z.iso.date(), z.literal("")]).default(""),
  status: z.enum(["draft", "completed"]).default("draft"),
}).strict().superRefine((v, ctx) => { if (v.status === "completed") for (const field of ["summary", "underlying_cause", "resolution", "prevention", "lesson"] as const) if (!v[field].trim()) ctx.addIssue({ code: "custom", path: [field], message: `Complete ${field.replaceAll("_", " ")} before completing the postmortem.` }); });
export function decisionReviewStatus(row: Record<string, unknown>, today: string) {
  if (["archived", "reversed", "validated", "superseded"].includes(String(row.status))) return String(row.status);
  if (row.review_date && String(row.review_date).slice(0, 10) <= today) return "review_due";
  if (["proposed", "under_review"].includes(String(row.status))) return "needs_decision";
  return "decided";
}
export function reviewVariance(expected: number | null, actual: number | null) { return expected === null || actual === null ? null : actual - expected; }
export const strategySources = { task: "tasks", project: "projects", decision: "decisions", risk: "operating_risks" } as const;
export const strategyTargets = { goal: ["goals", "title"], commitment: ["strategic_commitments", "title"], milestone: ["strategic_milestones", "title"], kpi: ["kpi_definitions", "name"] } as const;

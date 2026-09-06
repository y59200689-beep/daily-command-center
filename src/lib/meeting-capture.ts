import { z } from "zod";
import { parseDomainInput, type PersistedDomain } from "@/lib/domains";

export const meetingItemTypes = ["task", "decision", "followup", "waiting", "note"] as const;
export type MeetingItemType = (typeof meetingItemTypes)[number];

const blankToNull = (value: unknown) => typeof value === "string" && value.trim() === "" ? null : value;
const optionalText = (maximum = 10_000) => z.preprocess(blankToNull, z.string().trim().max(maximum).nullable().optional());
const optionalUuid = z.preprocess(blankToNull, z.uuid().nullable().optional());
const optionalDate = z.preprocess(blankToNull, z.iso.date().nullable().optional());
const optionalDateTime = z.preprocess(blankToNull, z.iso.datetime({ offset: true }).nullable().optional());

export const meetingCaptureItemSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.enum(meetingItemTypes),
  included: z.boolean().default(true),
  source: z.enum(["suggested", "manual"]).default("manual"),
  evidence: optionalText(500),
  title: z.string().trim().min(1).max(240),
  description: optionalText(),
  priority: z.enum(["none", "low", "medium", "high", "urgent"]).nullable().optional(),
  due_date: optionalDate,
  context: optionalText(),
  outcome: optionalText(),
  review_date: optionalDate,
  due_at: optionalDateTime,
  notes: optionalText(),
  waiting_on: optionalText(500),
  expected_by: optionalDateTime,
  content: optionalText(20_000),
  category: optionalText(80),
  project_id: optionalUuid,
  client_id: optionalUuid,
});

export type MeetingCaptureItem = z.infer<typeof meetingCaptureItemSchema>;

export const meetingExecutionSchema = z.object({
  action: z.literal("execute"),
  summary: z.string().trim().max(10_000).default(""),
  rawNotes: z.string().trim().max(20_000).default(""),
  idempotencyKey: z.uuid(),
  items: z.array(meetingCaptureItemSchema).max(30),
});

export const meetingSuggestionSchema = z.object({
  action: z.literal("suggest"),
  summary: z.string().trim().max(10_000).default(""),
  rawNotes: z.string().trim().min(1).max(20_000),
});

const prefixRules: Array<{ type: MeetingItemType; pattern: RegExp }> = [
  { type: "task", pattern: /^(?:task|action|to[ -]?do)\s*[:\-–]\s*/i },
  { type: "decision", pattern: /^(?:decision|decided|approved)\s*[:\-–]\s*/i },
  { type: "followup", pattern: /^(?:follow[ -]?up)\s*[:\-–]\s*/i },
  { type: "waiting", pattern: /^(?:waiting(?:\s+on)?|wait(?:ing)?\s+for)\s*[:\-–]\s*/i },
  { type: "note", pattern: /^(?:note)\s*[:\-–]\s*/i },
];

function suggestedItem(type: MeetingItemType, title: string, evidence: string, index: number): MeetingCaptureItem {
  const base: MeetingCaptureItem = { id: `suggested-${index}`, type, included: true, source: "suggested", evidence, title };
  if (type === "decision") return { ...base, outcome: title };
  if (type === "note") return { ...base, content: evidence, category: "meeting" };
  return base;
}

/** Deterministic fallback parser. It only structures explicitly labelled statements. */
export function suggestMeetingItems(rawNotes: string): MeetingCaptureItem[] {
  const lines = rawNotes.split(/\r?\n|(?<=[.!?])\s+/).map((line) => line.replace(/^[-*•]\s*/, "").trim()).filter(Boolean);
  const suggestions: MeetingCaptureItem[] = [];
  for (const line of lines) {
    const rule = prefixRules.find(({ pattern }) => pattern.test(line));
    if (!rule) continue;
    const title = line.replace(rule.pattern, "").trim().replace(/[.!]$/, "");
    if (!title) continue;
    suggestions.push(suggestedItem(rule.type, title.slice(0, 240), line.slice(0, 500), suggestions.length + 1));
  }
  return suggestions.slice(0, 30);
}

export function meetingItemDomain(item: MeetingCaptureItem): PersistedDomain {
  return item.type === "task" ? "tasks" : item.type === "decision" ? "decisions" : item.type === "followup" ? "followups" : item.type === "waiting" ? "waiting" : "notes";
}

export function prepareMeetingRecord(item: MeetingCaptureItem, today = new Date().toISOString().slice(0, 10)) {
  const common = { project_id: item.project_id ?? null, client_id: item.client_id ?? null };
  if (item.type === "task") return { title: item.title, description: item.description ?? null, priority: item.priority ?? "none", due_date: item.due_date ?? null, status: "planned", ...common };
  if (item.type === "decision") return { title: item.title, decision: item.outcome ?? "", reasoning: item.context ?? null, decision_date: today, review_date: item.review_date ?? null, impact: "medium", confidence: "medium", status: "active", ...common };
  if (item.type === "followup") return { title: item.title, due_at: item.due_at ?? null, notes: item.notes ?? null, status: "open", ...common };
  if (item.type === "waiting") return { title: item.title, contact: item.waiting_on ?? null, expected_by: item.expected_by ?? null, notes: item.notes ?? null, status: "waiting", ...common };
  return { title: item.title, content: item.content ?? "", category: item.category ?? "meeting", ...common };
}

export function validateSelectedMeetingItems(items: MeetingCaptureItem[], today?: string) {
  return items.filter((item) => item.included).map((item) => {
    const domain = meetingItemDomain(item);
    const input = prepareMeetingRecord(item, today);
    const parsed = parseDomainInput(domain, input);
    if (!parsed.success) throw parsed.error;
    return { captureItemId: item.id, type: item.type, domain, input: parsed.data as Record<string, unknown> };
  });
}

export function meetingItemCounts(items: MeetingCaptureItem[]) {
  return items.filter((item) => item.included).reduce<Record<MeetingItemType, number>>((counts, item) => ({ ...counts, [item.type]: counts[item.type] + 1 }), { task: 0, decision: 0, followup: 0, waiting: 0, note: 0 });
}

export function createdRecordRoute(type: MeetingItemType, id: string) {
  const segment = type === "task" ? "tasks" : type === "decision" ? "decisions" : type === "followup" ? "followups" : type === "waiting" ? "waiting" : "notes";
  return `/${segment}/${id}`;
}

import { z } from "zod";
import { normalizeOptionalNumberInput } from "@/lib/numeric-input";

export const domainKeys = ["tasks", "inbox", "projects", "clients", "followups", "waiting", "notes", "goals", "ideas", "decisions", "prompts", "invoices", "payments", "expenses", "subscriptions", "campaigns", "finance", "content", "fitness", "fitness-targets", "notification-preferences", "calendar"] as const;
export type PersistedDomain = (typeof domainKeys)[number];

const normalizeBlankToNull = (value: unknown) => typeof value === "string" && value.trim() === "" ? null : value;
const normalizeBlankToUndefined = (value: unknown) => value == null || typeof value === "string" && value.trim() === "" ? undefined : value;

export const optionalNullableText = (maximum = 5000) => z.preprocess(
  normalizeBlankToNull,
  z.string().trim().max(maximum).optional().nullable(),
);
export const optionalNullableUuid = z.preprocess(
  normalizeBlankToNull,
  z.uuid().optional().nullable(),
);
export const optionalNullableNumber = (schema: z.ZodNumber) => z.preprocess(
  normalizeOptionalNumberInput,
  schema.optional().nullable(),
);

const defaultedText = (fallback: string, maximum: number) => z.preprocess(
  normalizeBlankToUndefined,
  z.string().trim().max(maximum).default(fallback),
);
const defaultedNoteContent = z.preprocess(
  (value) => value == null ? "" : value,
  z.string().max(20000).default(""),
);
const optionalText = optionalNullableText();
const optionalUuid = optionalNullableUuid;
const date = z.preprocess(normalizeBlankToNull, z.iso.date().optional().nullable());
const dateTime = z.preprocess(normalizeBlankToNull, z.iso.datetime({ offset: true }).optional().nullable());
const currency = z.string().trim().length(3).transform((value) => value.toUpperCase()).default("MAD");
const money = z.coerce.number().finite().nonnegative();
const optionalInteger = (minimum: number, maximum: number) => optionalNullableNumber(z.number().int().min(minimum).max(maximum));

const schemas = {
  tasks: z.object({ title: z.string().trim().min(1).max(240), description: optionalText, status: z.enum(["inbox","planned","in_progress","waiting","blocked","completed","cancelled"]).default("inbox"), priority: z.enum(["none","low","medium","high","urgent"]).default("none"), project_id: optionalUuid, client_id: optionalUuid, goal_id: optionalUuid, due_date: date, estimated_minutes: optionalInteger(1, 1440), completed_at: dateTime, daily_position: optionalInteger(1, 3) }),
  inbox: z.object({ raw_text: z.string().trim().min(1).max(2000), detected_type: z.string().trim().max(40).default("inbox"), confidence: z.coerce.number().min(0).max(1).default(0), status: z.enum(["unprocessed","processed","archived"]).default("unprocessed") }),
  projects: z.object({ name: z.string().trim().min(1).max(240), description: optionalText, status: z.enum(["idea","planning","active","paused","completed","archived"]).default("active"), client_id: optionalUuid, goal_id: optionalUuid, target_date: date, progress: z.coerce.number().min(0).max(100).default(0), value_amount: optionalNullableNumber(z.number().finite().nonnegative()), currency, color: optionalNullableText(30) }),
  clients: z.object({ name: z.string().trim().min(1).max(240), company: optionalText, email: z.email().optional().nullable().or(z.literal("")), phone: optionalText, status: z.string().trim().max(40).default("active"), notes: optionalText, next_follow_up_at: dateTime }),
  followups: z.object({ title: z.string().trim().min(1).max(240), client_id: optionalUuid, project_id: optionalUuid, due_at: dateTime, status: z.string().trim().max(40).default("open"), notes: optionalText }),
  waiting: z.object({ title: z.string().trim().min(1).max(240), client_id: optionalUuid, project_id: optionalUuid, contact: optionalText, expected_by: dateTime, status: z.string().trim().max(40).default("waiting"), notes: optionalText }),
  notes: z.object({ title: z.string().trim().min(1).max(240), content: defaultedNoteContent, category: defaultedText("note", 80), project_id: optionalUuid, client_id: optionalUuid }),
  goals: z.object({ title: z.string().trim().min(1).max(240), description: optionalText, period: z.enum(["quarter","month","week"]).default("quarter"), target_date: date, status: z.string().trim().max(40).default("active"), progress: z.coerce.number().min(0).max(100).default(0) }),
  ideas: z.object({ title: z.string().trim().min(1).max(240), description: optionalText, category: optionalText, project_id: optionalUuid, potential: z.enum(["low","medium","high","huge"]).optional().nullable(), status: z.string().trim().max(40).default("captured") }),
  decisions: z.object({ title: z.string().trim().min(1).max(240), decision: z.string().trim().min(1).max(10000), reasoning: optionalText, project_id: optionalUuid, client_id: optionalUuid, impact: z.enum(["low","medium","high","critical"]).default("medium"), confidence: z.enum(["low","medium","high"]).default("medium"), status: z.enum(["active","review_due","superseded","reversed","archived"]).default("active"), decision_date: date, review_date: date, superseded_by_decision_id: optionalUuid }),
  prompts: z.object({ title: z.string().trim().min(1).max(240), prompt_text: z.string().trim().min(1).max(20000), description: optionalText, category: z.enum(["Coding","Marketing","Design","Image Generation","Business","Research","Writing","Other"]).default("Other"), favorite: z.boolean().default(false), rating: optionalInteger(1, 5), client_id: optionalUuid, project_id: optionalUuid, campaign_id: optionalUuid, content_item_id: optionalUuid }),
  invoices: z.object({ invoice_number: optionalNullableText(120), title: z.string().trim().min(1).max(240), description: optionalText, currency, subtotal: money, tax_amount: money.default(0), discount_amount: money.default(0), status: z.enum(["draft","sent","partial","paid","overdue","cancelled"]).default("draft"), issue_date: date, due_date: date, client_id: optionalUuid, project_id: optionalUuid, notes: optionalText, external_reference: optionalText }),
  payments: z.object({ invoice_id: z.uuid(), amount: z.coerce.number().finite().positive(), currency, payment_date: z.iso.date(), payment_method: optionalText, reference: optionalText, notes: optionalText }),
  expenses: z.object({ project_id: optionalUuid, client_id: optionalUuid, category: z.enum(["Software","Hosting","Advertising","Design","Travel","Equipment","Contractors","Other"]), vendor: optionalText, description: z.string().trim().min(1).max(1000), amount: money, currency, expense_date: z.iso.date(), recurring: z.boolean().default(false), subscription_id: optionalUuid, receipt_url: z.url().optional().nullable().or(z.literal("")), notes: optionalText }),
  subscriptions: z.object({ name: z.string().trim().min(1).max(240), provider: optionalText, amount: money, currency, billing_cycle: z.enum(["monthly","quarterly","yearly","custom"]), next_billing_date: date, project_id: optionalUuid, category: optionalText, status: z.enum(["active","paused","cancelled"]).default("active"), notes: optionalText }),
  campaigns: z.object({ name: z.string().trim().min(1).max(240), client_id: z.uuid(), project_id: optionalUuid, objective: optionalText, start_date: date, end_date: date, status: z.enum(["planning","active","paused","completed","archived"]).default("planning"), description: optionalText }),
  finance: z.object({ type: z.enum(["income","expense","subscription"]).default("expense"), amount: z.coerce.number().nonnegative(), currency: z.string().trim().length(3).default("MAD"), occurred_on: z.iso.date(), status: z.string().trim().max(40).default("recorded"), client_id: optionalUuid, project_id: optionalUuid, notes: optionalText }),
  content: z.object({ title: z.string().trim().min(1).max(240), client_id: optionalUuid, project_id: optionalUuid, campaign_id: optionalUuid, prompt_id: optionalUuid, platform: z.preprocess(normalizeBlankToNull, z.enum(["Instagram","Facebook","TikTok","LinkedIn","YouTube","Website","Email","Other"]).optional().nullable()), format: optionalText, status: z.enum(["idea","brief","copy","designing","review","approved","scheduled","published","archived"]).default("idea"), priority: z.enum(["none","low","medium","high","urgent"]).default("none"), hook: optionalText, caption: optionalText, creative_brief: optionalText, creative_direction: optionalText, cta: optionalText, publish_date: dateTime, scheduled_at: dateTime, published_at: dateTime, due_date: date, approval_status: z.enum(["not_required","pending","changes_requested","approved"]).default("not_required"), approval_notes: optionalText, approved_by_name: optionalNullableText(240), performance_notes: optionalText }),
  fitness: z.object({ activity_type: z.enum(["Running","Gym","Walking","Swimming","Hiking","Cycling","Other"]), date: z.iso.date(), duration_minutes: optionalNullableNumber(z.number().int().positive()), distance_km: optionalNullableNumber(z.number().finite().nonnegative()), calories: optionalNullableNumber(z.number().int().nonnegative()), source: defaultedText("manual", 60), external_id: optionalText, notes: optionalText, effort: z.preprocess(normalizeBlankToNull, z.enum(["easy","moderate","hard"]).optional().nullable()) }),
  "fitness-targets": z.object({ activity_type: z.enum(["Running","Gym","Walking","Swimming","Hiking","Cycling","Other"]), target_type: z.enum(["sessions","distance_km","duration_minutes"]), target_value: z.coerce.number().positive(), period: z.enum(["week","month"]).default("week"), active: z.boolean().default(true) }),
  "notification-preferences": z.object({ category:z.enum(["finance","content","decisions","fitness","projects","waiting"]),enabled:z.boolean().default(true),minimum_severity:z.enum(["low","medium","high","critical"]).default("medium") }),
  calendar: z.object({ title: z.string().trim().min(1).max(240), description: optionalText, starts_at: z.iso.datetime({ offset: true }), ends_at: z.iso.datetime({ offset: true }), all_day: z.boolean().default(false), timezone: z.string().trim().min(1).default("Africa/Casablanca"), recurrence_rule: optionalText, status: z.string().trim().max(40).default("confirmed") }),
} satisfies Record<PersistedDomain, z.ZodType>;

export type DomainRecord = Record<string, unknown> & { id: string };

export const domainConfig: Record<PersistedDomain, { table: string; schema: z.ZodType; titleField: string; secondary: string; tertiary: string; sort: string }> = {
  tasks: { table: "tasks", schema: schemas.tasks, titleField: "title", secondary: "status", tertiary: "due_date", sort: "created_at" },
  inbox: { table: "inbox_items", schema: schemas.inbox, titleField: "raw_text", secondary: "detected_type", tertiary: "created_at", sort: "created_at" },
  projects: { table: "projects", schema: schemas.projects, titleField: "name", secondary: "status", tertiary: "progress", sort: "updated_at" },
  clients: { table: "clients", schema: schemas.clients, titleField: "name", secondary: "company", tertiary: "next_follow_up_at", sort: "updated_at" },
  followups: { table: "followups", schema: schemas.followups, titleField: "title", secondary: "status", tertiary: "due_at", sort: "due_at" },
  waiting: { table: "waiting_items", schema: schemas.waiting, titleField: "title", secondary: "contact", tertiary: "expected_by", sort: "created_at" },
  notes: { table: "notes", schema: schemas.notes, titleField: "title", secondary: "category", tertiary: "updated_at", sort: "updated_at" },
  goals: { table: "goals", schema: schemas.goals, titleField: "title", secondary: "period", tertiary: "progress", sort: "updated_at" },
  ideas: { table: "ideas", schema: schemas.ideas, titleField: "title", secondary: "potential", tertiary: "status", sort: "updated_at" },
  decisions: { table: "decisions", schema: schemas.decisions, titleField: "title", secondary: "decision", tertiary: "decision_date", sort: "decision_date" },
  prompts: { table: "prompts", schema: schemas.prompts, titleField: "title", secondary: "category", tertiary: "usage_count", sort: "updated_at" },
  invoices: { table: "invoices", schema: schemas.invoices, titleField: "invoice_number", secondary: "status", tertiary: "amount_remaining", sort: "created_at" },
  payments: { table: "payments", schema: schemas.payments, titleField: "reference", secondary: "payment_method", tertiary: "amount", sort: "payment_date" },
  expenses: { table: "expenses", schema: schemas.expenses, titleField: "description", secondary: "category", tertiary: "amount", sort: "expense_date" },
  subscriptions: { table: "subscriptions", schema: schemas.subscriptions, titleField: "name", secondary: "status", tertiary: "next_billing_date", sort: "next_billing_date" },
  campaigns: { table: "campaigns", schema: schemas.campaigns, titleField: "name", secondary: "status", tertiary: "end_date", sort: "updated_at" },
  finance: { table: "finance_transactions", schema: schemas.finance, titleField: "notes", secondary: "status", tertiary: "amount", sort: "occurred_on" },
  content: { table: "content_items", schema: schemas.content, titleField: "title", secondary: "status", tertiary: "publish_date", sort: "updated_at" },
  fitness: { table: "fitness_activities", schema: schemas.fitness, titleField: "activity_type", secondary: "duration_minutes", tertiary: "date", sort: "date" },
  "fitness-targets": { table: "fitness_targets", schema: schemas["fitness-targets"], titleField: "activity_type", secondary: "target_type", tertiary: "target_value", sort: "updated_at" },
  "notification-preferences": { table:"notification_preferences",schema:schemas["notification-preferences"],titleField:"category",secondary:"minimum_severity",tertiary:"enabled",sort:"updated_at" },
  calendar: { table: "calendar_events", schema: schemas.calendar, titleField: "title", secondary: "starts_at", tertiary: "timezone", sort: "starts_at" },
};

export function isPersistedDomain(value: string): value is PersistedDomain { return domainKeys.includes(value as PersistedDomain); }

export function parseDomainInput(domain: PersistedDomain, value: unknown, partial = false) {
  const schema = domainConfig[domain].schema;
  return partial && schema instanceof z.ZodObject ? schema.partial().safeParse(value) : schema.safeParse(value);
}

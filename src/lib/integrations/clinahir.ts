import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { leadSchema } from "@/lib/business";

const optionalText = (max: number) => z.preprocess(value => typeof value === "string" ? value.trim() || undefined : value === null ? undefined : value, z.string().max(max).optional());
export const clinahirLeadSchema = z.object({
  externalId: z.string().trim().min(1).max(200),
  companyName: optionalText(240), contactName: optionalText(240),
  email: optionalText(254).pipe(z.email().transform(value => value.toLowerCase()).optional()),
  phone: optionalText(80), city: optionalText(120), message: optionalText(10000),
  formType: optionalText(120), landingPage: optionalText(2048),
  utmSource: optionalText(240), utmMedium: optionalText(240), utmCampaign: optionalText(240),
  submittedAt: optionalText(80).pipe(z.iso.datetime({ offset: true }).optional()),
}).refine(value => Boolean(value.companyName || value.contactName || value.email || value.phone), {
  message: "Provide a company name, contact name, email, or phone number.",
});
export type ClinahirLead = z.infer<typeof clinahirLeadSchema>;
export function hasClinahirAuthorization(header: string | null, secret: string): boolean {
  const match = header?.match(/^Bearer ([^\s]+)$/i);
  if (!match || header!.length > 4096) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(match[1]), digest(secret));
}
export function mapClinahirLead(payload: ClinahirLead, userId: string) {
  const fields = leadSchema.parse({
    name: payload.contactName || payload.companyName || payload.email?.slice(0, 240) || payload.phone,
    company: payload.companyName ?? null, email: payload.email ?? null,
    phone: payload.phone?.replace(/\s+/g, " ") ?? null, city: payload.city ?? null,
    notes: payload.message ?? null, source: "clinahir", status: "new", currency: "USD",
  });
  return { ...fields, user_id: userId, external_id: payload.externalId, source_detail: "website",
    metadata: Object.fromEntries(Object.entries({
      utm_source: payload.utmSource, utm_medium: payload.utmMedium, utm_campaign: payload.utmCampaign,
      landing_page: payload.landingPage, form_type: payload.formType, submitted_at: payload.submittedAt,
    }).filter(([, value]) => value !== undefined)),
  };
}
export type ClinahirLeadInsert = ReturnType<typeof mapClinahirLead>;
export interface ClinahirLeadStore {
  find(userId: string, externalId: string): Promise<string | null>;
  insert(values: ClinahirLeadInsert): Promise<string>;
}
type Event = "created" | "duplicate" | "unauthorized" | "invalid_payload" | "configuration_error" | "database_error";
type Dependencies = {
  config: () => { secret?: string; userId?: string };
  store: () => ClinahirLeadStore;
  log: (event: Event, details?: { leadId?: string; code?: string }) => void;
};
const json = (body: object, status: number) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
async function readPayload(request: Request): Promise<unknown> {
  if (!request.body) throw new Error("Empty body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 32768) { await reader.cancel(); throw new Error("Payload too large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export function createClinahirLeadHandler(deps: Dependencies) {
  return async (request: Request): Promise<Response> => {
    const { secret, userId } = deps.config();
    if (!secret || secret.length < 32) {
      deps.log("configuration_error"); return json({ error: "Clinahir integration is not configured." }, 500);
    }
    if (!hasClinahirAuthorization(request.headers.get("authorization"), secret)) {
      deps.log("unauthorized"); return json({ error: "Invalid or missing Clinahir authorization." }, 401);
    }
    if (!z.uuid().safeParse(userId).success) {
      deps.log("configuration_error"); return json({ error: "Clinahir destination workspace is not configured." }, 500);
    }
    let payload: ClinahirLead;
    try {
      payload = clinahirLeadSchema.parse(await readPayload(request));
    } catch {
      deps.log("invalid_payload");
      return json({ error: "Invalid lead payload. Supply externalId and at least one company, contact, email, or phone; check field lengths, email and submittedAt." }, 400);
    }
    try {
      const store = deps.store();
      const existing = await store.find(userId!, payload.externalId);
      if (existing) { deps.log("duplicate", { leadId: existing }); return json({ success: true, created: false, duplicate: true, leadId: existing }, 200); }
      try {
        const leadId = await store.insert(mapClinahirLead(payload, userId!));
        deps.log("created", { leadId }); return json({ success: true, created: true, leadId }, 201);
      } catch (error) {
        // The unique index arbitrates concurrent retries, including archived records.
        if (error && typeof error === "object" && "code" in error && error.code === "23505") {
          const leadId = await store.find(userId!, payload.externalId);
          if (leadId) { deps.log("duplicate", { leadId }); return json({ success: true, created: false, duplicate: true, leadId }, 200); }
        }
        throw error;
      }
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : undefined;
      deps.log("database_error", { code }); return json({ error: "Clinahir lead could not be saved. Retry with the same externalId." }, 500);
    }
  };
}

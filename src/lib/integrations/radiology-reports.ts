import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const webUrl = z.url().refine(value => { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password; }, "Use an HTTP(S) URL without credentials.");
export const radiologyReportSchema = z.object({
  externalId: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(240),
  periodStart: z.iso.date(),
  periodEnd: z.iso.date(),
  contentMarkdown: z.string().min(1).max(200000).refine(value => Boolean(value.trim()), "Content cannot be blank."),
  sources: z.array(z.object({
    title: z.string().trim().min(1).max(500),
    url: webUrl,
    publishedAt: z.union([z.iso.date(), z.iso.datetime({ offset: true })]).nullish(),
  }).strict()).max(100).default([]),
}).strict().refine(value => value.periodEnd >= value.periodStart, "periodEnd must be on or after periodStart.");
export type RadiologyReport = z.infer<typeof radiologyReportSchema>;
export function mapRadiologyReport(payload: RadiologyReport, userId: string) {
  return {
    user_id: userId, report_type: "weekly_executive", scope: "business",
    period_start: payload.periodStart, period_end: payload.periodEnd,
    title: payload.title, summary: "Weekly radiology digital-growth briefing",
    sections: [{ title: "Briefing", content: payload.contentMarkdown, format: "markdown" }],
    immutable_data: { contentMarkdown: payload.contentMarkdown, sources: payload.sources },
    integration_source: "radiology-growth", external_id: payload.externalId,
  };
}
export type RadiologyReportStore = { find(userId: string, externalId: string): Promise<string | null>; insert(values: ReturnType<typeof mapRadiologyReport>): Promise<string> };
type Dependencies = {
  config: () => { secret?: string; userId?: string };
  store: () => RadiologyReportStore;
  log: (event: string, details?: { reportId?: string; code?: string }) => void;
};
const json = (body: object, status: number) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export function hasReportAuthorization(header: string | null, secret: string) {
  if (!header || header.length > 4096) return false;
  const match = header.match(/^Bearer ([^\s]+)$/i);
  if (!match) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(match[1]), digest(secret));
}
async function readPayload(request: Request) {
  if (!request.body) throw new Error("Empty payload");
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 1048576) { await reader.cancel(); throw new Error("Payload exceeds 1 MB"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export function createRadiologyReportHandler(deps: Dependencies) {
  return async (request: Request): Promise<Response> => {
    const { secret, userId } = deps.config();
    if (!secret || secret.length < 32) { deps.log("configuration_error"); return json({ error: "Radiology reports integration is not configured." }, 500); }
    if (!hasReportAuthorization(request.headers.get("authorization"), secret)) { deps.log("unauthorized"); return json({ error: "Invalid or missing bearer authorization." }, 401); }
    if (!z.uuid().safeParse(userId).success) { deps.log("configuration_error"); return json({ error: "Report destination account is not configured." }, 500); }
    let payload: RadiologyReport;
    try { payload = radiologyReportSchema.parse(await readPayload(request)); }
    catch { deps.log("invalid_payload"); return json({ error: "Invalid report payload. Provide externalId, title, periodStart/periodEnd (YYYY-MM-DD), contentMarkdown and valid HTTP(S) sources. Check date order and field lengths." }, 400); }
    const duplicate = (reportId: string) => { deps.log("duplicate", { reportId }); return json({ success: true, created: false, duplicate: true, reportId }, 200); };
    try {
      const saved = await saveRadiologyReport(payload, userId!, deps.store());
      if (!saved.created) return duplicate(saved.reportId);
      deps.log("created", { reportId: saved.reportId }); return json({ success: true, created: true, reportId: saved.reportId }, 201);
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : undefined;
      deps.log("database_error", { code }); return json({ error: "Report could not be saved. Retry with the same externalId." }, 500);
    }
  };
}

export async function saveRadiologyReport(payload: RadiologyReport, userId: string, store: RadiologyReportStore) {
 const existing = await store.find(userId, payload.externalId);
 if (existing) return { reportId: existing, created: false };
 try { return { reportId: await store.insert(mapRadiologyReport(payload,userId)), created: true }; }
 catch(error) { if (error && typeof error === "object" && "code" in error && error.code === "23505") {const id=await store.find(userId,payload.externalId);if(id)return {reportId:id,created:false};}throw error; }
}

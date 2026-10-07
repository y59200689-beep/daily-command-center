import { test } from "node:test";
import assert from "node:assert/strict";
import { createRadiologyReportHandler, mapRadiologyReport, radiologyReportSchema } from "../src/lib/integrations/radiology-reports";
const secret = "test-only-private-token-at-least-32-characters";
const userId = "91843333-ded0-4f44-b52e-9423e5810cda";
const payload = { externalId: "week-1", title: "Radiology growth", periodStart: "2026-10-01", periodEnd: "2026-10-07", contentMarkdown: "# Weekly briefing\n\n**Growth** and [source](https://example.com).", sources: [{ title: "Source", url: "https://example.com", publishedAt: "2026-10-03" }] };
function setup() {
  const records = new Map<string, string>(); const inserted: unknown[] = [];
  const handler = createRadiologyReportHandler({ config: () => ({ secret, userId }), log: () => {}, store: () => ({ find: async (owner, id) => records.get(`${owner}:${id}`) ?? null, insert: async value => { inserted.push(value); const id = "report-1"; records.set(`${value.user_id}:${value.external_id}`, id); return id; } }) });
  return { handler, inserted };
}
const request = (body: unknown = payload, token = secret) => new Request("https://example.com/api/integrations/radiology-growth/reports", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
test("authorized report is stored in existing Reports model with Markdown and sources", async () => { const { handler, inserted } = setup(); const res = await handler(request()); assert.equal(res.status, 201); assert.deepEqual(await res.json(), { success: true, created: true, reportId: "report-1" }); assert.deepEqual(inserted[0], mapRadiologyReport(radiologyReportSchema.parse(payload), userId)); });
test("invalid bearer does not touch storage", async () => { const {handler, inserted} = setup(); assert.equal((await handler(request(payload, "wrong"))).status, 401); assert.equal(inserted.length, 0); });
test("bad payload, unsafe source, date order and missing body are rejected", async () => { const {handler} = setup(); for (const body of [{}, {...payload, periodEnd:"2026-09-01"}, {...payload, sources:[{title:"Bad",url:"javascript:alert(1)"}]}]) assert.equal((await handler(request(body))).status,400); assert.equal((await handler(new Request("https://example.com",{method:"POST",headers:{Authorization:`Bearer ${secret}`},body:"{"}))).status,400); });
test("retries return the original report without another insert", async () => { const {handler,inserted} = setup(); await handler(request()); const res=await handler(request()); assert.equal(res.status,200); assert.deepEqual(await res.json(),{success:true,created:false,duplicate:true,reportId:"report-1"}); assert.equal(inserted.length,1); });
test("concurrent unique conflict is handled as successful duplicate", async () => { let reads=0; const handler=createRadiologyReportHandler({config:()=>({secret,userId}),log:()=>{},store:()=>({find:async()=>++reads===1?null:"existing",insert:async()=>{throw {code:"23505"};}})}); assert.equal((await handler(request())).status,200); });
test("configuration and DB failure return safe errors", async () => { for(const config of [{}, {secret,userId:"bad"}, {secret,userId}]) { const handler=createRadiologyReportHandler({config:()=>config, log:()=>{},store:()=>{throw new Error("private detail");}}); const res=await handler(request()); assert.equal(res.status,500); assert.ok(!(await res.text()).includes("private detail")); }});

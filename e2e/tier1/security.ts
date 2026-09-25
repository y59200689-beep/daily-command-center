import { expect, request, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { provisionPeer, cleanupPeer } from "../../scripts/e2e/peer.mjs";
import { getE2ETarget } from "../../scripts/e2e/target.mjs";
import { identity, label, normalClient, evidence } from "./workflows";
import { snapshotRegistry } from "../../scripts/e2e/registry.mjs";
export async function isolation(page: Page) {
 const a = await normalClient(); const target = getE2ETarget();
 try {
  const { client: b, metadata } = await provisionPeer();
  const project = await b.from("projects").insert({ user_id: metadata.userId, name: `TIER1_E2E_${metadata.runId}_foreign_project` }).select("id").single();
  expect(project.error).toBeNull(); const id = project.data!.id; snapshotRegistry(metadata);
  const own = await a.from("projects").insert({ user_id: identity().userId, name: label("owned_project") }).select("id,user_id").single();
  expect(own.error).toBeNull(); snapshotRegistry();
  const visible = await a.from("projects").select("id,user_id"); expect(visible.error).toBeNull();
  expect(visible.data!.every(row => row.user_id === identity().userId)).toBeTruthy();
  const read = await a.from("projects").select("id").eq("id", id); expect(read.error).toBeNull(); expect(read.data).toEqual([]);
  const update = await a.from("projects").update({ name: "Forbidden synthetic change" }).eq("id", id).select("id"); expect(update.data ?? []).toEqual([]);
  const link = await a.from("quality_incidents").insert({ user_id: identity().userId, title: label("rejected_foreign_link"), description: "Controlled owner isolation check", project_id: id });
  expect(link.error).not.toBeNull();
  const anon = createClient(target.url, target.anonKey, { auth: { persistSession: false } });
  const anonymous = await anon.from("projects").select("id").eq("id", own.data!.id); expect(anonymous.data ?? []).toEqual([]);
  const rpc = await anon.rpc("search_founder_records", { search_query: "TIER1_E2E" }); expect(rpc.error?.code).toBe("42501");
  const context = await page.context().browser()!.newContext({ storageState: { cookies: [], origins: [] } });
  const denied = await context.request.get("http://127.0.0.1:3100/api/operating/decisions"); expect(denied.status()).toBe(401); await context.close();
  const foreign = await page.request.get(`/api/entities/projects/${id}`); expect([403,404]).toContain(foreign.status());
  const unchanged = await b.from("projects").select("name").eq("id", id).single(); expect(unchanged.data?.name).toBe(`TIER1_E2E_${metadata.runId}_foreign_project`);
  evidence("live RLS A/B/anonymous", "PASS");
 } finally { await cleanupPeer(); }
}
export async function clientSecretCheck(page: Page) {
 const target = getE2ETarget();
 const requests: string[] = []; page.on("request", req => requests.push(JSON.stringify({ url: req.url(), headers: req.headers(), body: req.postData() })));
 await page.goto("/state"); await expect(page.getByRole("heading", { name: "Founder State", exact: true })).toBeVisible();
 const sources = await page.locator("script[src]").evaluateAll(nodes => nodes.map(n => (n as HTMLScriptElement).src));
 const assets = await request.newContext({ storageState: { cookies: [], origins: [] } });
 try {
  const bundles = await Promise.all(sources.map(async source => {
   const response = await assets.get(source, { timeout: 90_000 });
   expect(response.ok(), `Client asset request failed: ${new URL(source).pathname} (${response.status()})`).toBe(true);
   return response.text();
  }));
  expect(bundles.some(text => text.includes(target.serviceKey)), "Privileged credential detected in client script").toBe(false);
 } finally { await assets.dispose(); }
 expect((await page.content()).includes(target.serviceKey), "Privileged credential detected in HTML").toBe(false);
 expect(requests.some(r => r.includes(target.serviceKey)), "Privileged credential detected in browser request").toBe(false);
 evidence("client credential isolation", "PASS");
}

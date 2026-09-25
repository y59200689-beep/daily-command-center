import { createClient } from "@supabase/supabase-js";
import { randomUUID, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, unlinkSync, readdirSync } from "node:fs";
import { getE2ETarget } from "./target.mjs";
import { cleanupOwnedRows } from "./cleanup-owned-rows.mjs";
import { snapshotRegistry } from "./registry.mjs";
const registryRoot = ".playwright-auth";
const registryPath = runId => `${registryRoot}/peer-meta-${runId}.json`;
function registeredPaths() {
 try {
  return readdirSync(registryRoot).filter(name => name === "peer-meta.json" || /^peer-meta-[0-9a-f-]{36}\.json$/.test(name)).map(name => `${registryRoot}/${name}`);
 } catch (error) { if (error.code === "ENOENT") return []; throw error; }
}
export async function provisionPeer() {
 const target = getE2ETarget();
 const runId = randomUUID(), userId = randomUUID(), email = `tier1-e2e-${runId}@example.com`;
 const metadata = { runId, userId, email, projectId: target.projectId };
 const path = registryPath(runId);
 writeFileSync(path, JSON.stringify(metadata), { mode: 0o600, flag: "wx" });
 const admin = createClient(target.url, target.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
 const password = randomBytes(36).toString("base64url") + "!a7";
 const { data, error } = await admin.auth.admin.createUser({ id: userId, email, password, email_confirm: true, user_metadata: { e2e_run_id: runId, e2e_scope: target.target === "remote-test" ? "remote-tier1" : "local-tier1" } });
 if (error || data.user?.id !== userId) throw new Error("Peer provisioning failed; registry retained");
 const client = createClient(target.url, target.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
 const login = await client.auth.signInWithPassword({ email, password });
 if (login.error) throw new Error("Peer normal authentication failed; registry retained");
 return { client, metadata };
}
export async function cleanupPeer() {
 const target = getE2ETarget();
 for (const path of registeredPaths()) {
  const metadata = JSON.parse(readFileSync(path, "utf8"));
  if (!/^[0-9a-f-]{36}$/.test(metadata.userId) || metadata.projectId !== target.projectId) throw new Error("Peer cleanup registry does not match the allowlisted project; registry retained.");
  snapshotRegistry(metadata);
  await cleanupOwnedRows(metadata);
  const admin = createClient(target.url, target.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const deleted = await admin.auth.admin.deleteUser(metadata.userId);
  if (deleted.error && deleted.error.status !== 404) throw new Error(`Peer cleanup failed: ${metadata.userId}`);
  const check = await admin.auth.admin.getUserById(metadata.userId);
  if (check.data.user || (check.error && check.error.status !== 404)) throw new Error(`Peer cleanup unverified: ${metadata.userId}`);
  unlinkSync(path);
  console.log(`Synthetic peer cleanup verified: ${metadata.userId}`);
 }
}

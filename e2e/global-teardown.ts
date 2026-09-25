import { cleanupPeer } from "../scripts/e2e/peer.mjs";
import { snapshotRegistry } from "../scripts/e2e/registry.mjs";
import { createClient } from "@supabase/supabase-js";
import { readFile, rm, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getE2ETarget } from "../scripts/e2e/target.mjs";
import { cleanupOwnedRows } from "../scripts/e2e/cleanup-owned-rows.mjs";

export default async function globalTeardown() {
  const root = resolve(process.cwd(), ".playwright-auth");
  const metadataPath = resolve(root, "user-meta.json");
  let metadata: { userId: string; email: string; runId: string };
  try { metadata = JSON.parse(await readFile(metadataPath, "utf8")) as typeof metadata; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; return; }

  const local = getE2ETarget();
  const admin = createClient(local.url, local.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  await cleanupPeer();
  snapshotRegistry();
  await cleanupOwnedRows(metadata);
  const { error } = await admin.auth.admin.deleteUser(metadata.userId);
  if (error && !/not found|user not found/i.test(error.message)) {
    throw new Error(`Failed to remove E2E user ${metadata.userId}; ensure local Supabase is running, then run the test:e2e:cleanup script.`);
  }
  const { data: remaining, error: lookupError } = await admin.auth.admin.getUserById(metadata.userId);
  if (remaining.user || (lookupError && lookupError.status !== 404)) throw new Error(`Could not confirm E2E Auth cleanup for ${metadata.userId}. Registry retained.`);
  await mkdir("test-results", { recursive: true });
  await writeFile("test-results/cleanup.json", JSON.stringify({ ...metadata, remainingAuthUsers: 0, remainingOwnedRows: 0, registry: await readFile(resolve(root, "resources.jsonl"), "utf8"), evidence: await readFile(resolve(root, "evidence.jsonl"), "utf8").catch(() => "") }, null, 2));
  await rm(root, { recursive: true, force: true });
}

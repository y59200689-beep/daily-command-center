import { cleanupPeer } from "./peer.mjs";
import { snapshotRegistry } from "./registry.mjs";
import { createClient } from "@supabase/supabase-js";
import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { getE2ETarget } from "./target.mjs";
import { cleanupOwnedRows } from "./cleanup-owned-rows.mjs";

process.env.FOUNDER_E2E_LOCAL = "1";
process.env.NODE_ENV = "test";
const root = resolve(".playwright-auth");
const path = resolve(root, "user-meta.json");
let metadata;
try { metadata = JSON.parse(await readFile(path, "utf8")); }
catch (error) { if (error.code !== "ENOENT") throw error; console.log("No pending E2E identity cleanup."); process.exit(0); }

const local = getE2ETarget();
const admin = createClient(local.url, local.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
await cleanupPeer();
  snapshotRegistry();
  await cleanupOwnedRows(metadata);
const { error } = await admin.auth.admin.deleteUser(metadata.userId);
if (error && !/not found|user not found/i.test(error.message)) throw new Error(`E2E cleanup failed: ${error.message}`);
const { data: remaining, error: lookupError } = await admin.auth.admin.getUserById(metadata.userId);
if (remaining.user || (lookupError && lookupError.status !== 404)) throw new Error(`Could not confirm E2E Auth cleanup for ${metadata.userId}. Registry retained.`);
await rm(root, { recursive: true, force: true });
console.log("E2E identity removed and cleanup verified.");

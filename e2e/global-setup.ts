import { createClient } from "@supabase/supabase-js";
import { chromium, type FullConfig } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getE2ETarget } from "../scripts/e2e/target.mjs";
import { queryMetadata, snapshotRegistry } from "../scripts/e2e/registry.mjs";
import { cleanupOwnedRows } from "../scripts/e2e/cleanup-owned-rows.mjs";

const authDir = resolve(process.cwd(), ".playwright-auth");
const statePath = resolve(authDir, "user.json");
const metadataPath = resolve(authDir, "user-meta.json");

export default async function globalSetup(config: FullConfig) {
  const local = getE2ETarget();
  const admin = createClient(local.url, local.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  // Also protect direct Playwright invocation, which bypasses the package runner.
  if (local.target === "remote-test") queryMetadata("select 1 as cleanup_access_preflight");
  const runId = randomUUID();
  const email = `tier1-e2e-${runId}@example.com`;
  const password = `E2e-${randomBytes(32).toString("base64url")}!a7`;
  const userId = randomUUID();
  const identity = { userId, email, runId, projectId: local.projectId };
  // Reserve the exact Auth ID durably before the first mutation. Never overwrite a pending run.
  await mkdir(authDir, { recursive: true, mode: 0o700 });
  await writeFile(metadataPath, JSON.stringify(identity), { mode: 0o600, flag: "wx" });
  const { data, error } = await admin.auth.admin.createUser({
    id: userId,
    email,
    password,
    email_confirm: true,
    user_metadata: { e2e_run_id: runId, e2e_scope: local.target === "remote-test" ? "remote-tier1" : "local-tier1" },
  });
  if (error || !data.user || data.user.id !== userId) throw new Error("Could not provision the registered E2E identity. Registry retained; run test:e2e:cleanup before retrying.");

  try {
    snapshotRegistry();
    const browser = await chromium.launch();
    try {
      const context = await browser.newContext({ baseURL: String(config.projects[0].use.baseURL) });
      const page = await context.newPage();
      await page.goto("/login");
      await page.getByLabel("Email", { exact: true }).fill(email);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Sign in" }).click();
      await page.waitForURL("**/today", { timeout: 20_000 });
      await context.storageState({ path: statePath });
      await context.close();
    } finally {
      await browser.close();
    }
  } catch (cause) {
    try {
      snapshotRegistry();
      await cleanupOwnedRows(identity);
      const { error: deleteError } = await admin.auth.admin.deleteUser(data.user.id);
      if (deleteError) throw deleteError;
      const { data: remaining, error: lookupError } = await admin.auth.admin.getUserById(userId);
      if (remaining.user || (lookupError && lookupError.status !== 404)) throw new Error("Cannot verify cleanup; registry retained");
      const { rm } = await import("node:fs/promises");
      await rm(authDir, { recursive: true, force: true });
    } catch (cleanupError) {
      throw new Error(`Browser password login failed and cleanup also failed. Preserve the identity metadata and run test:e2e:cleanup. Setup: ${String(cause)}; cleanup: ${String(cleanupError)}`);
    }
    throw new Error(`E2E user was removed after normal browser password login failed. ${String(cause)}`);
  }
}

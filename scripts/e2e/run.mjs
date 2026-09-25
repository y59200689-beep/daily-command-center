import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { getE2ETarget } from "./target.mjs";
import { queryMetadata } from "./registry.mjs";
process.env.NODE_ENV = "test";
process.env.FOUNDER_E2E_LOCAL = "1";
const target = getE2ETarget();
if (target.target === "remote-test") queryMetadata("select 1 as cleanup_access_preflight");

const runner = resolve("node_modules/.bin/playwright");
const result = spawnSync(runner, ["test", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, FOUNDER_E2E_LOCAL: "1", NODE_ENV: "test" },
});
if (existsSync(".playwright-auth/user-meta.json")) {
  const cleanup = spawnSync(process.execPath, ["scripts/e2e/cleanup.mjs"], { stdio: "inherit", env: process.env });
  if (cleanup.status !== 0) {
    console.error("E2E cleanup incomplete. Retained .playwright-auth registry identifies remaining resources; retry test:e2e:cleanup.");
    process.exit(1);
  }
}
if (result.error) {
  console.error(`Could not start Playwright: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);

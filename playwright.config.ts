import { defineConfig, devices } from "@playwright/test";
import { getE2ETarget } from "./scripts/e2e/target.mjs";

const local = getE2ETarget();
const baseURL = "http://127.0.0.1:3100";
const storageState = ".playwright-auth/user.json";
const prebuilt = process.env.E2E_SERVER_MODE === "production";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  expect: { timeout: 60000 },
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL,
    storageState,
    trace: "off",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      testMatch: "**/desktop.spec.ts",
      use: { ...devices["Desktop Chrome"], storageState },
    },
    {
      name: "mobile-iphone",
      testMatch: "**/mobile.spec.ts",
      use: { ...devices["iPhone 13"], browserName: "chromium", storageState },
    },
    {
      name: "mobile-android",
      testMatch: "**/mobile.spec.ts",
      use: { ...devices["Pixel 7"], browserName: "chromium", storageState },
    },
  ],
  webServer: {
    command: prebuilt ? "pnpm exec next start --hostname 127.0.0.1 --port 3100" : "pnpm exec next dev --webpack --hostname 127.0.0.1 --port 3100",
    url: `${baseURL}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NODE_ENV: prebuilt ? "production" : "development",
      NEXT_PUBLIC_SUPABASE_URL: local.url,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.anonKey,
      SUPABASE_URL: local.url,
      SUPABASE_SECRET_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      E2E_REMOTE_SERVICE_KEY: "",
      SUPABASE_ACCESS_TOKEN: "",
      E2E_REMOTE_ALLOW: "",
    },
  },
});

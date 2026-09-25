import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { snapshotRegistry } from "../../scripts/e2e/registry.mjs";
const runLabel = () => `TIER1_E2E_${JSON.parse(readFileSync(".playwright-auth/user-meta.json", "utf8")).runId}`;
test.beforeEach(({ page }) => { page.setDefaultTimeout(60000); page.setDefaultNavigationTimeout(60000); });
test.afterEach(() => snapshotRegistry());

test("normal synthetic session and A/B/anonymous isolation", async ({ page }) => { test.setTimeout(180_000); await isolation(page); await clientSecretCheck(page); });

test("authenticated desktop Tier 1 surfaces render without auth or API errors", async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(`page: ${error.message}`));
  page.on("console", message => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
  page.on("response", response => {
    if (response.url().includes("/api/") && response.status() >= 400) errors.push(`API ${response.status()}: ${response.url()}`);
  });

  const routes = [
    ["/state", "Founder State"],
    ["/today", "Your daily brief"],
    ["/decisions", "Decision Journal"],
    ["/issues", "Critical issues"],
    ["/waiting", "Waiting"],
    ["/dependencies", "Dependencies"],
    ["/risks/register", "Risk register"],
    ["/review/weekly", "Weekly Executive Review"],
    ["/executive", "Executive Console"],
    ["/changes", "What changed"],
  ] as const;

  for (const [route, heading] of routes) {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(`${route.replaceAll("/", "\\/")}$`));
    await expect(page.getByRole("heading", { name: new RegExp(heading, "i") }).first()).toBeVisible();
  }
  await page.goto("/today");
  await expect(page.locator(".project-mini em").filter({ hasText: /\d+%/ })).toHaveCount(0);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("Decision Journal create, review, lesson proposal, and refresh persist through the UI", async ({ page }) => {
  test.setTimeout(180_000);
  const timings = new Map<string, number>();
  page.on("request", r => { if (r.url().includes("/api/")) timings.set(r.url(), Date.now()); });
  page.on("response", r => { if (r.url().includes("/api/")) console.log("Decision API", r.status(), new URL(r.url()).pathname, Date.now() - (timings.get(r.url()) ?? Date.now()), "ms"); });
  const title = `${runLabel()}_${Date.now()}_decision`;
  const today = new Date().toISOString().slice(0, 10);
  await page.goto("/decisions");
  await page.getByRole("button", { name: "Add record" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Decision title").fill(title);
  await dialog.getByLabel("What is being decided?").fill("Choose a controlled E2E validation path.");
  await dialog.getByLabel("Status").selectOption("decided");
  await dialog.getByLabel("Impact").selectOption("high");
  await dialog.getByLabel("Confidence").selectOption("high");
  await dialog.getByLabel("Reversibility").selectOption("reversible");
  await dialog.getByLabel("Rationale").fill("Local E2E fixture only.");
  await dialog.getByLabel("Assumptions").fill("The local-only stack is isolated.");
  await dialog.getByLabel("Expected outcome").fill("A controlled browser suite can authenticate safely.");
  await dialog.getByLabel("Expected metric").fill("successful browser workflow");
  await dialog.getByLabel("Review date").fill(today);
  await dialog.getByRole("button", { name: "Save record" }).click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();

  await page.getByRole("link", { name: /Options, relationships & outcome review/ }).click();
  await expect(page.getByRole("heading", { name: "Decision review" })).toBeVisible();
  await page.getByText("Options & decision", { exact: true }).click();
  await page.getByRole("button", { name: "Add option" }).click();
  const option = page.locator("fieldset").last();
  await option.getByLabel("label", { exact: true }).fill("Use isolated local E2E");
  await option.getByLabel("Selected", { exact: true }).check();
  await page.getByLabel("Expected metric value", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Review Decision" }).click();
  await page.getByRole("textbox", { name: "actual outcome", exact: true }).fill("The local browser workflow authenticated and persisted safely.");
  await page.getByLabel("Actual metric value", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Save review" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Review saved" })).toBeVisible();
  await page.getByText("Save as Operating Lesson", { exact: true }).click();
  await page.locator("details").filter({ has: page.locator("summary", { hasText: /^Save as Operating Lesson$/ }) }).getByRole("textbox", { name: "Lesson", exact: true }).fill("Keep browser fixtures on an isolated local Supabase stack.");
  await page.getByRole("button", { name: "Propose lesson" }).click();
  await expect(page.getByText("Proposed lesson is ready for review in Operating Memory.")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("textbox", { name: "actual outcome", exact: true })).toHaveValue("The local browser workflow authenticated and persisted safely.");
  await page.getByText("Options & decision", { exact: true }).click();
  await expect(page.getByLabel("Selected", { exact: true })).toBeChecked();
});

test("issue resolution, structured postmortem, lesson proposal, and follow-up persist", async ({ page }) => {
  const title = `${runLabel()}_${Date.now()}_issue`;
  await page.goto("/issues");
  await page.getByRole("button", { name: "Add record" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Issue", { exact: false }).fill(title);
  await dialog.getByLabel("What happened?", { exact: false }).fill("A controlled test issue verifies the postmortem path.");
  await dialog.getByLabel("Reported severity", { exact: false }).selectOption("critical");
  await dialog.getByRole("combobox", { name: /^Impact(?: [*])?$/ }).selectOption("high");
  await dialog.getByLabel("Urgency", { exact: false }).selectOption("immediate");
  await dialog.getByRole("button", { name: "Save record" }).click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Resolution & postmortem →" }).click();
  await expect(page.getByRole("heading", { name: new RegExp(`Postmortem: ${title}`) })).toBeVisible();
  await page.getByText("Incident summary", { exact: true }).click();
  await page.getByRole("textbox", { name: "summary", exact: true }).fill("Local E2E synthetic incident.");
  await page.getByText("Root cause", { exact: true }).click();
  await page.getByRole("textbox", { name: "underlying cause", exact: true }).fill("The controlled fixture had no real operational impact.");
  await page.getByText("Detection", { exact: true }).click();
  await page.getByRole("textbox", { name: "detection", exact: true }).fill("Detected by the test assertion.");
  await page.getByText("Resolution", { exact: true }).click();
  await page.getByRole("textbox", { name: "resolution", exact: true }).fill("Removed by local test-user cleanup.");
  await page.getByText("Prevention", { exact: true }).click();
  await page.getByRole("textbox", { name: "prevention", exact: true }).fill("Keep fixtures in the isolated local Supabase project.");
  await page.locator("summary").filter({ hasText: /^Learning$/ }).click();
  await page.locator("details").filter({ hasText: "Learning" }).getByRole("textbox", { name: "lesson", exact: true }).fill("Use a disposable local identity for browser workflow verification.");
  await page.getByRole("combobox", { name: "Postmortem status", exact: true }).selectOption("completed");
  await page.getByRole("button", { name: "Save review" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Review saved" })).toBeVisible();
  await page.getByRole("button", { name: "Create preventive task" }).click();
  await expect(page.getByRole("status").filter({ hasText: "task created or already linked" })).toBeVisible();
  await page.reload();
  await page.getByText("Root cause", { exact: true }).click();
  await expect(page.getByRole("textbox", { name: "underlying cause", exact: true })).toHaveValue("The controlled fixture had no real operational impact.");
});

import { propagationWorkflow, dependenciesAndCapture } from "./workflows";
import { isolation, clientSecretCheck } from "./security";
test("desktop cross-domain propagation, bottleneck, changes and weekly review", async ({ page }) => {
 test.setTimeout(600000); await propagationWorkflow(page, false);
});
test("desktop named dependencies and unified capture conversions", async ({ page }) => {
 test.setTimeout(300000); await dependenciesAndCapture(page);
});
test("post-workflow RLS and client credential regression", async ({ page }) => { test.setTimeout(180_000); await isolation(page); await clientSecretCheck(page); });

import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { snapshotRegistry } from "../../scripts/e2e/registry.mjs";
const runLabel = () => `TIER1_E2E_${JSON.parse(readFileSync(".playwright-auth/user-meta.json", "utf8")).runId}`;
test.beforeEach(({ page }) => { page.setDefaultTimeout(60000); page.setDefaultNavigationTimeout(60000); });
test.afterEach(() => snapshotRegistry());

test("Tier 1 mobile pages fit the device viewport and keep core information usable", async ({ page }) => {
  const failures: string[] = [];
  page.on("pageerror", error => failures.push(error.message));
  page.on("console", message => { if (message.type() === "error") failures.push(message.text()); });
  const routes = [
    ["/today", /Your daily brief/i],
    ["/state", /Founder State/i],
    ["/decisions", /Decision Journal/i],
    ["/issues", /Critical issues/i],
    ["/waiting", /Waiting/i],
    ["/dependencies", /Dependencies/i],
    ["/risks/register", /Risk register/i],
    ["/executive", /Executive Console/i],
    ["/review/weekly", /Weekly Executive Review/i],
    ["/changes", /What changed/i],
  ] as const;

  for (const [route, heading] of routes) {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(`${route.replaceAll("/", "\\/")}$`));
    await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
    const width = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
    expect(width.content, `${route} overflows ${width.viewport}px viewport`).toBeLessThanOrEqual(width.viewport + 1);
  }
  expect(failures, failures.join("\n")).toEqual([]);
});

test("mobile can create and refresh a waiting-on-me commitment", async ({ page }, testInfo) => {
  const title = `${runLabel()}_${testInfo.project.name}_${Date.now()}_commitment`;
  await page.goto("/commitments");
  await page.getByRole("button", { name: "Add record" }).click();
  const dialog = page.getByRole("dialog");
  const box = await dialog.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);

  await dialog.getByLabel("Promise", { exact: false }).fill(title);
  await dialog.getByLabel("Who", { exact: false }).fill("Local E2E test counterpart");
  await dialog.getByLabel("Direction", { exact: false }).selectOption("owed_by_me");
  await dialog.getByLabel("Importance", { exact: false }).selectOption("high");
  await dialog.getByLabel("Due date", { exact: false }).fill(new Date().toISOString().slice(0, 10));
  await dialog.getByRole("button", { name: "Save record" }).click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await expect(page.getByText("You owe", { exact: false }).first()).toBeVisible();
  const width = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  expect(width.content).toBeLessThanOrEqual(width.viewport + 1);
});

import { propagationWorkflow, dependenciesAndCapture } from "./workflows";
test("mobile full create edit review propagation and refresh", async ({ page }) => {
 test.setTimeout(600000); await propagationWorkflow(page, true);
});
test("mobile entity selector, dependencies and capture", async ({ page }) => {
 test.setTimeout(300000); await dependenciesAndCapture(page);
});

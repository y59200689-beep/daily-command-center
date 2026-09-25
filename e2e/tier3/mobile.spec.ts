import { test } from "@playwright/test";
import { snapshotRegistry } from "../../scripts/e2e/registry.mjs";
import {
  founderEnergyWorkflow,
  forecastWorkflow,
  communicationWorkflow,
  tier3SynthesisWorkflow,
} from "./workflows";

test.afterEach(() => snapshotRegistry());

test("Phase 3 Mobile founder daily energy state workflow", async ({ page }) => {
  test.setTimeout(300000);
  await founderEnergyWorkflow(page);
});

test("Phase 3 Mobile forecast workflow", async ({ page }) => {
  test.setTimeout(300000);
  await forecastWorkflow(page);
});

test("Phase 3 Mobile communication extractor workflow", async ({ page }) => {
  test.setTimeout(300000);
  await communicationWorkflow(page);
});

test("Phase 3 Mobile executive and chief of staff synthesis", async ({ page }) => {
  test.setTimeout(300000);
  await tier3SynthesisWorkflow(page);
});

import { test } from "@playwright/test";
import { snapshotRegistry } from "../../scripts/e2e/registry.mjs";
import { tier3Isolation } from "./security";
import { clientSecretCheck } from "../tier1/security";
import {
  experimentWorkflow,
  forecastWorkflow,
  communicationWorkflow,
  assetWorkflow,
  founderEnergyWorkflow,
  contentWorkflow,
  tier3SynthesisWorkflow,
  tier3CrossDomainPropagation,
  tier1And2RegressionSmoke,
} from "./workflows";

test.afterEach(() => snapshotRegistry());

test("Phase 3 Isolated DB / RLS verification and security boundary", async () => {
  test.setTimeout(180000);
  await tier3Isolation();
});

test("Phase 3 client credential boundary check", async ({ page }) => {
  test.setTimeout(120000);
  await clientSecretCheck(page);
});

test("Phase 3 experiment lifecycle workflow", async ({ page }) => {
  test.setTimeout(300000);
  await experimentWorkflow(page);
});

test("Phase 3 forecast prediction and resolution workflow", async ({ page }) => {
  test.setTimeout(300000);
  await forecastWorkflow(page);
});

test("Phase 3 communication extractor workflow", async ({ page }) => {
  test.setTimeout(300000);
  await communicationWorkflow(page);
});

test("Phase 3 asset intelligence metadata workflow", async ({ page }) => {
  test.setTimeout(300000);
  await assetWorkflow(page);
});

test("Phase 3 daily energy checkin and persistence", async ({ page }) => {
  test.setTimeout(300000);
  await founderEnergyWorkflow(page);
});

test("Phase 3 content item workflow", async ({ page }) => {
  test.setTimeout(300000);
  await contentWorkflow(page);
});

test("Phase 3 executive and chief of staff synthesis", async ({ page }) => {
  test.setTimeout(300000);
  await tier3SynthesisWorkflow(page);
});

test("Phase 3 cross-domain intelligence propagation", async ({ page }) => {
  test.setTimeout(300000);
  await tier3CrossDomainPropagation(page);
});

test("Tier 1 and Tier 2 regression smoke", async ({ page }) => {
  test.setTimeout(300000);
  await tier1And2RegressionSmoke(page);
});

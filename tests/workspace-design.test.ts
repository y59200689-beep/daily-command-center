import assert from "node:assert/strict";
import test from "node:test";
import { usesPremiumWorkspace } from "../src/lib/workspace-design";

test("premium workspace covers requested families and nested workflows", () => {
  for (const path of ["/infrastructure/access", "/commitments", "/relationships", "/dependencies", "/issues/record", "/assets", "/experiments", "/business-pulse/kpis", "/fitness/plans", "/fitness/recovery", "/life/wealth", "/travel/mobility", "/forecasts", "/operations/runs/record", "/knowledge/collections/record", "/learning/lessons/record", "/chief-of-staff/plans/record", "/executive/brief/daily", "/founder/products", "/state/review", "/automations", "/approvals", "/communication", "/memory", "/meeting/record/capture", "/settings/integrations", "/settings/notifications", "/settings/business"]) assert.equal(usesPremiumWorkspace(path), true, path);
});
test("premium workspace respects route boundaries and existing dashboard themes", () => {
  for (const path of ["/today", "/tasks", "/leads", "/fitness", "/growth/mission", "/operations-other", "/knowledgebase", "/settings/business-extra"]) assert.equal(usesPremiumWorkspace(path), false, path);
});

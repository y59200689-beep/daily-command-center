import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { businessSettingsSchema, clientLifecycle, dateWithinHorizon, forecastRange, groupedRevenueForecast, isReactivationCandidate, opportunitySchema, pricingHistory, proposalSchema, proposalTotals, profitability, scopeDelivery, trackedProjectSeconds, weeklyBusinessMetrics } from "../src/lib/business";

test("V5 proposal totals retain line-item arithmetic without rounding hidden values", () => {
  assert.deepEqual(proposalTotals([{ quantity: 2, unit_price: 150 }, { quantity: 1.5, unit_price: 40 }], 10, 20), { subtotal: 360, total: 370, itemTotals: [300, 60] });
});

test("V5 forecast keeps currencies separate and distinguishes committed from weighted pipeline", () => {
  const forecast = groupedRevenueForecast({
    invoices: [{ currency: "MAD", total_amount: 1000, amount_remaining: 400, status: "sent" }], payments: [{ currency: "MAD", amount: 600 }],
    proposals: [{ currency: "MAD", total: 500, status: "accepted" }], opportunities: [{ currency: "MAD", estimated_value: 1000, stage: "proposal", probability: 60 }],
  });
  assert.deepEqual(forecast.currencies.MAD, { received: 600, outstanding: 400, committed: 500, weightedPipeline: 600, potential: 2100, excludedOpportunities: 0 });
});

test("V5 schemas reject invalid commercial values and keep optional values nullable", () => {
  assert.equal(opportunitySchema.safeParse({ title: "Opportunity", stage: "new", probability: 101 }).success, false);
  const proposal = proposalSchema.parse({ title: "Proposal", items: [] });
  assert.equal(proposal.currency, "MAD"); assert.deepEqual(proposal.items, []);
  assert.equal(businessSettingsSchema.safeParse({ default_currency: "MAD", default_tax_rate: 101 }).success, false);
});

test("V5 migration is additive, owner-scoped, and includes the business operational tables", async () => {
  const source = await readFile(new URL("../supabase/migrations/20260906103059_v5_business_operating_system.sql", import.meta.url), "utf8");
  for (const table of ["leads", "services", "opportunities", "opportunity_stage_history", "proposals", "proposal_items", "scope_items", "scope_change_requests", "business_settings"]) assert.match(source, new RegExp(`create table ${table}`));
  assert.match(source, /enable row level security/); assert.match(source, /auth\.uid\(\)\)=user_id/); assert.match(source, /attachments_entity_type_check/);
});

test("V5 business API owner-scopes reads and validates linked entities on the server", async () => {
  const source = await readFile(new URL("../src/app/api/business/[resource]/route.ts", import.meta.url), "utf8");
  assert.match(source, /requireUser\(\)/); assert.match(source, /\.eq\("user_id", userId\)/); assert.match(source, /validateLinks\(supabase, userId/); assert.match(source, /proposal_versions/);
});

test("V5 business UI keeps a human-readable pipeline and line-item proposal builder", async () => {
  const source = await readFile(new URL("../src/features/business/business-workspace.tsx", import.meta.url), "utf8");
  for (const expected of ["Weighted pipeline", "Next sales actions", "Line items", "Add line", "Move", "New opportunity"]) assert.match(source, new RegExp(expected));
  const styles = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.match(styles, /\.business-pipeline/); assert.match(styles, /\.proposal-line/);
});

test("V5 conversion is server-owned, idempotent, and creates delivery only from a won opportunity", async () => {
  const [migration, route, ui] = await Promise.all([
    readFile(new URL("../supabase/migrations/20260906103059_v5_business_operating_system.sql", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/business/opportunities/[id]/convert/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/features/business/business-workspace.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(migration, /convert_won_opportunity/); assert.match(migration, /Only a won opportunity can be converted/); assert.match(migration, /projects_owner_opportunity_idx/);
  assert.match(route, /requireUser\(\)/); assert.match(route, /\.eq\("user_id", userId\)/); assert.match(route, /rpc\("convert_won_opportunity"/);
  assert.match(ui, /Create project/); assert.match(ui, /already_converted/);
});

test("V5 relationship triggers reject cross-owner links before persistence", async () => {
  const source = await readFile(new URL("../supabase/migrations/20260906103059_v5_business_operating_system.sql", import.meta.url), "utf8");
  for (const trigger of ["projects_v5_owned_links", "tasks_v5_owned_links", "expenses_v5_owned_links", "calendar_events_v5_owned_links", "email_threads_v5_owned_links"]) assert.match(source, new RegExp(trigger));
});

test("V5 private attachments recognize only the new business entities allowed by the migration", async () => {
  const source = await readFile(new URL("../src/lib/attachments.ts", import.meta.url), "utf8");
  for (const type of ["lead", "opportunity", "proposal"]) assert.match(source, new RegExp(`${type}: \{ table:`));
});

test("V5 scope delivery reports delivered work, exceeded estimates, and explicit out-of-scope time", () => {
  const scope = [{ id: "scope-1", status: "delivered", estimated_hours: 1 }, { id: "scope-2", status: "in_progress", estimated_hours: 1 }];
  const tasks = [{ id: "task-1", scope_item_id: "scope-1", scope_status: "in_scope" as const }, { id: "task-2", scope_item_id: null, scope_status: "out_of_scope" as const }];
  const result = scopeDelivery(scope, tasks, [{ id: "focus-1", task_id: "task-1", duration_seconds: 5400 }, { id: "focus-2", task_id: "task-2", duration_seconds: 1800 }]);
  assert.equal(result.deliveredCount, 1); assert.deepEqual(result.exceededScopeIds, ["scope-1"]); assert.equal(result.outOfScopeSeconds, 1800);
});

test("V5 tracked project time includes direct and task-linked sessions once", () => {
  const tasks = [{ id: "task-1", scope_status: "in_scope" as const }];
  assert.equal(trackedProjectSeconds("project-1", [{ id: "one", project_id: "project-1", duration_seconds: 600 }, { id: "one", task_id: "task-1", duration_seconds: 600 }, { id: "two", task_id: "task-1", duration_seconds: 900 }], tasks), 1500);
});

test("V5 profitability does not fabricate a time cost when hourly cost is absent", () => {
  const result = profitability({ revenue: 1000, expenses: 100, trackedSeconds: 7200, internalHourlyCost: null });
  assert.equal(result.timeCost, null); assert.equal(result.estimatedProfit, null); assert.equal(result.effectiveRevenuePerHour, 500);
});

test("V5 client lifecycle remains a cautious derived label", () => {
  assert.equal(clientLifecycle({ received: 0, activeProjects: 0, openOpportunities: 0 }), "prospect");
  assert.equal(clientLifecycle({ received: 1000, activeProjects: 1, openOpportunities: 0 }), "active");
  assert.equal(clientLifecycle({ received: 1000, activeProjects: 0, openOpportunities: 0, lastContactAt: "2025-01-01T00:00:00.000Z", now: new Date("2026-01-01T00:00:00.000Z") }), "dormant");
});

test("V5 pricing history labels small internal samples as limited", () => {
  const result = pricingHistory([{ amount: 1000, trackedSeconds: 3600, status: "won" }, { amount: 1400, trackedSeconds: 7200, status: "accepted" }]);
  assert.equal(result.limitedData, true); assert.equal(result.medianSale, 1200); assert.equal(result.medianTrackedHours, 1.5);
});

test("V5 forecast horizons preserve calendar ranges without pretending condition-based dates", () => {
  const now = new Date("2026-09-06T10:00:00.000Z"); const month = forecastRange("this_month", now); const next = forecastRange("next_month", now);
  assert.equal(dateWithinHorizon("2026-09-30T12:00:00.000Z", month), true); assert.equal(dateWithinHorizon("2026-10-01T00:00:00.000Z", month), false); assert.equal(next.start.getMonth(), 9);
});

test("V5 proposal-to-scope import is owner-scoped and idempotent in the project endpoint", async () => {
  const source = await readFile(new URL("../src/app/api/projects/[id]/business/import-proposal/route.ts", import.meta.url), "utf8");
  assert.match(source, /requireUser\(\)/); assert.match(source, /eq\("user_id", userId\)/); assert.match(source, /existingIds/); assert.match(source, /Only an accepted proposal/);
});

test("V5 project business UI imports accepted scope and classifies task scope explicitly", async () => {
  const source = await readFile(new URL("../src/features/business/project-business.tsx", import.meta.url), "utf8");
  for (const expected of ["Import accepted proposal", "Out of scope", "Scope changes", "Estimated profit"]) assert.match(source, new RegExp(expected));
});

test("V5 client detail includes a business intelligence tab without replacing its existing client detail", async () => {
  const source = await readFile(new URL("../src/features/domains/detail-page.tsx", import.meta.url), "utf8");
  assert.match(source, /ClientBusiness/); assert.match(source, /\["projects","business","tasks"/);
});

test("V5 business dashboard uses server-owned multi-currency forecast and deterministic attention", async () => {
  const source = await readFile(new URL("../src/app/api/business/overview/route.ts", import.meta.url), "utf8");
  assert.match(source, /groupedRevenueForecast/); assert.match(source, /acceptedOpportunityIds/); assert.match(source, /overdue_invoice/); assert.match(source, /requireUser\(\)/);
});

test("V5 business settings are a usable private form rather than a raw configuration payload", async () => {
  const source = await readFile(new URL("../src/app/(workspace)/settings/business/page.tsx", import.meta.url), "utf8");
  for (const expected of ["Internal hourly cost", "Default proposal validity", "Save settings"]) assert.match(source, new RegExp(expected));
});

test("V5 assistant business tools are owner-scoped and keep writes confirmation-gated", async () => {
  const source = await readFile(new URL("../src/lib/ai-tools.ts", import.meta.url), "utf8");
  for (const expected of ["get_pipeline_summary", "get_revenue_forecast", "get_scope_status", "create_scope_change"]) assert.match(source, new RegExp(expected));
  assert.match(source, /writeGuard\(input\.confirmed\)/);
});

test("V5 mobile business presentation avoids a horizontal kanban requirement", async () => {
  const source = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.match(source, /\.business-pipeline\{grid-template-columns:1fr;overflow:visible/); assert.match(source, /\.proposal-line\{grid-template-columns:1fr 1fr/);
});

test("V5 service analytics are owner-scoped, retain currencies, and disclose tracked-time coverage", async () => {
  const [route, ui] = await Promise.all([readFile(new URL("../src/app/api/services/[id]/analytics/route.ts", import.meta.url), "utf8"), readFile(new URL("../src/features/business/service-analytics.tsx", import.meta.url), "utf8")]);
  assert.match(route, /eq\("user_id", userId\)/); assert.match(route, /pricingHistory/); assert.match(route, /trackedProjectSeconds/);
  for (const label of ["Historical pricing", "Sale range", "Median sale", "Recent proposals", "Recent projects", "Limited data"]) assert.match(ui, new RegExp(label));
});

test("V5 reactivation is conservative about active, open, recent, and unpaid relationships", () => {
  const base = { received: 1000, activeProjects: 0, openOpportunities: 0, unresolvedBalance: 0, lastCompletedAt: "2026-01-01T00:00:00.000Z", now: new Date("2026-05-01T00:00:00.000Z") };
  assert.equal(isReactivationCandidate(base), true);
  assert.equal(isReactivationCandidate({ ...base, activeProjects: 1 }), false);
  assert.equal(isReactivationCandidate({ ...base, openOpportunities: 1 }), false);
  assert.equal(isReactivationCandidate({ ...base, unresolvedBalance: 1 }), false);
  assert.equal(isReactivationCandidate({ ...base, lastContactAt: "2026-04-15T00:00:00.000Z" }), false);
});

test("V5 reactivation actions remain owner-scoped and create a deliberately sparse existing-client opportunity", async () => {
  const source = await readFile(new URL("../src/app/api/business/reactivation/route.ts", import.meta.url), "utf8");
  assert.match(source, /requireUser\(\)/); assert.match(source, /source:"existing_client"/); assert.match(source, /create_opportunity/); assert.match(source, /dismiss/); assert.match(source, /snooze/); assert.doesNotMatch(source, /estimated_value:/);
});

test("V5 reactivation cards are present in both business and client contexts with touch-safe actions", async () => {
  const [component, client, workspace] = await Promise.all([readFile(new URL("../src/features/business/reactivation-candidates.tsx", import.meta.url), "utf8"), readFile(new URL("../src/features/business/client-business.tsx", import.meta.url), "utf8"), readFile(new URL("../src/features/business/business-workspace.tsx", import.meta.url), "utf8")]);
  for (const label of ["Potential reactivation", "Create opportunity", "Snooze", "Dismiss"]) assert.match(component, new RegExp(label));
  assert.match(client, /ReactivationCandidates/); assert.match(workspace, /ReactivationCandidates/);
});

test("V5 Today uses a bounded, action-oriented business signal set", async () => {
  const [route, ui] = await Promise.all([readFile(new URL("../src/app/api/today/route.ts", import.meta.url), "utf8"), readFile(new URL("../src/features/today/today-dashboard.tsx", import.meta.url), "utf8")]);
  assert.match(route, /businessSignals/); assert.match(route, /slice\(0,3\)/); assert.match(route, /Opportunity needs follow-up/); assert.match(route, /Proposal expires soon/); assert.match(route, /Approved scope change/);
  assert.match(ui, /Worth protecting/); assert.match(ui, /businessSignals/);
});

test("V5 weekly review builds business metrics through the existing review route", async () => {
  const [route, ui] = await Promise.all([readFile(new URL("../src/app/api/intelligence/review/weekly/route.ts", import.meta.url), "utf8"), readFile(new URL("../src/features/intelligence/intelligence-pages.tsx", import.meta.url), "utf8")]);
  assert.match(route, /withBusinessReview/); assert.match(route, /weeklyBusinessMetrics/); assert.match(route, /opportunity_stage_history/); assert.match(ui, /Scope changes approved/); assert.match(ui, /Tracked project hours/);
  assert.equal(weeklyBusinessMetrics({ leadsCreated: 1, opportunitiesCreated: 2, opportunitiesAdvanced: 3, proposalsSent: 4, dealsWon: 1, dealsLost: 1, trackedSeconds: 5400, scopeCreep: 2, profitabilityWarnings: 0, reactivationCandidates: 0 }).trackedHours, 1.5);
});

test("V5 Gmail relationship flow includes owner-scoped lead and opportunity links without a second reply model", async () => {
  const [api, communication, context] = await Promise.all([readFile(new URL("../src/app/api/email-threads/[id]/route.ts", import.meta.url), "utf8"), readFile(new URL("../src/app/api/communication/route.ts", import.meta.url), "utf8"), readFile(new URL("../src/app/api/business/communication/[entity]/[id]/route.ts", import.meta.url), "utf8")]);
  assert.match(api, /linked_lead_id/); assert.match(api, /linked_opportunity_id/); assert.match(api, /eq\("user_id",userId\)/);
  assert.match(communication, /suggested_lead/); assert.match(communication, /opportunities/);
  assert.match(context, /entitySchema/); assert.match(context, /linked_opportunity_id/); assert.match(context, /requireUser\(\)/);
});

test("V5 business communication surfaces compact lead and opportunity context", async () => {
  const [component, detail] = await Promise.all([readFile(new URL("../src/features/business/business-communication.tsx", import.meta.url), "utf8"), readFile(new URL("../src/features/domains/detail-page.tsx", import.meta.url), "utf8")]);
  for (const label of ["Communication", "Last contact", "Reply needed", "Find communication"]) assert.match(component, new RegExp(label));
  assert.match(detail, /BusinessCommunication/);
});

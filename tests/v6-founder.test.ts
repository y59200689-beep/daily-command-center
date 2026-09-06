import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { commerceSummary, founderAttention, growthFunnel, inventoryRisk, supportSummary, unitEconomics } from "../src/lib/founder";
import { deploymentSourceHealth, normalizeVercelDeployment } from "../src/lib/founder-sources";

test("V6 commerce keeps currencies separate and excludes canceled or failed orders from revenue", () => {
  const result = commerceSummary([{ id: "a", status: "delivered", currency: "MAD", total_amount: 200, created_at: "2026-09-01" }, { id: "b", status: "canceled", currency: "MAD", total_amount: 100, created_at: "2026-09-01" }, { id: "c", status: "confirmed", currency: "EUR", total_amount: 20, created_at: "2026-09-01" }]);
  assert.deepEqual(result.revenue, { MAD: 200, EUR: 20 }); assert.equal(result.orderCount, 2); assert.equal(result.cancellationRate, 1 / 3);
});
test("V6 inventory distinguishes missing data, low stock, stockout, and a bounded stockout estimate", () => {
  assert.equal(inventoryRisk({}, null).state, "unavailable"); assert.equal(inventoryRisk({ available_stock: 0 }, 2).state, "out_of_stock"); assert.equal(inventoryRisk({ available_stock: 4, reorder_level: 5 }, 1).state, "low_stock"); assert.equal(inventoryRisk({ available_stock: 8 }, 1).daysOfStock, 8);
});
test("V6 unit economics never fabricates COGS or a margin", () => {
  assert.equal(unitEconomics({ id: "a", status: "delivered", currency: "MAD", total_amount: 100, created_at: "x" }, [{ product_name: "P", quantity: 1, unit_price: 100, unit_cost: null }]).grossMargin, null);
  assert.equal(unitEconomics({ id: "a", status: "delivered", currency: "MAD", total_amount: 100, created_at: "x", shipping_cost: 10 }, [{ product_name: "P", quantity: 1, unit_price: 100, unit_cost: 40 }]).contributionMargin, 50);
});
test("V6 founder attention prioritizes real production and inventory risks", () => {
  const queue = founderAttention({ incidents: [{ id: "i", title: "Checkout unavailable", severity: "critical" }], deployments: [{ id: "d", environment: "production", status: "failed" }], inventory: [{ id: "p", name: "Serum", state: "out_of_stock" }], supportOpen: 7 });
  assert.equal(queue[0].key, "incident:i"); assert.ok(queue.some((item) => item.key === "deployment:d"));
});
test("V6 migration is additive and owner-scopes the company, commerce, product, supplier, release, incident, roadmap, and AI records", async () => {
  const source = await readFile(new URL("../supabase/migrations/20260906130000_v6_founder_operating_system.sql", import.meta.url), "utf8");
  for (const table of ["companies", "commerce_orders", "product_catalog_refs", "inventory_snapshots", "supplier_records", "deployment_records", "product_roadmap_items", "incidents", "ai_usage_records"]) assert.match(source, new RegExp(`create table if not exists ${table}`));
  assert.match(source, /enable row level security/); assert.match(source, /auth\.uid\(\)\)=user_id/);
});
test("V6 founder routes use server authenticated owner-scoped company records", async () => {
  const [dashboard, records] = await Promise.all([readFile(new URL("../src/app/api/founder/route.ts", import.meta.url), "utf8"), readFile(new URL("../src/app/api/founder/[resource]/route.ts", import.meta.url), "utf8")]);
  for (const source of [dashboard, records]) { assert.match(source, /requireUser\(\)/); assert.match(source, /eq\("user_id", userId\)/); }
  assert.match(records, /ownedCompany/); assert.match(records, /supplier_records/); assert.match(records, /product_roadmap_items/);
});
test("V6 founder dashboard gives source-unavailable states rather than production-looking demo values", async () => {
  const source = await readFile(new URL("../src/features/founder/founder-dashboard.tsx", import.meta.url), "utf8");
  for (const label of ["Commerce source not connected", "Inventory sync has not run yet", "Deployment source not connected", "Next founder action"]) assert.match(source, new RegExp(label));
  assert.match(source, /"roadmap" \| "incidents"/); assert.match(source, /Roadmap item/); assert.match(source, /Add supplier/);
});
test("V6 growth funnel preserves missing stages and computes only deterministic conversions", () => {
  const funnel = growthFunnel({ sessions: 1000, product_views: 500, add_to_cart: 100, checkout_started: 50, orders_confirmed: 30 });
  assert.equal(funnel?.overallConversion, 0.03); assert.equal(funnel?.checkoutToOrderRate, 0.6);
  assert.equal(growthFunnel({ sessions: 100, product_views: null })?.productViewRate, null);
});
test("V6 product management uses authenticated company ownership and records manual snapshots", async () => {
  const source = await readFile(new URL("../src/app/api/founder/products/route.ts", import.meta.url), "utf8");
  assert.match(source, /requireUser\(\)/); assert.match(source, /eq\("user_id", userId\)/); assert.match(source, /source: "manual"/); assert.match(source, /product_catalog_refs/); assert.match(source, /inventory_snapshots/);
});
test("V6 founder search only appends locally owned operational records", async () => {
  const source = await readFile(new URL("../src/app/api/search/route.ts", import.meta.url), "utf8");
  for (const table of ["product_catalog_refs", "supplier_records", "supplier_orders", "product_roadmap_items", "incidents", "support_cases"]) assert.match(source, new RegExp(table));
  assert.match(source, /eq\("user_id", userId\)/);
});
test("V6 dashboard renders funnel, marketing, AI, and product operations without fabricated values", async () => {
  const source = await readFile(new URL("../src/features/founder/founder-dashboard.tsx", import.meta.url), "utf8");
  for (const label of ["Growth funnel", "Marketing attribution", "AI usage", "Manage products", "Analytics source has not supplied a funnel snapshot yet", "Attribution data has not been imported"]) assert.match(source, new RegExp(label));
});
test("V6 deployment adapter accepts Vercel-shaped deployment input without exposing provider payloads", () => {
  const deployment = normalizeVercelDeployment({ id: "d1", target: "production", state: "READY", meta: { githubCommitRef: "main", githubCommitSha: "abc" }, ready: 1_788_000_000_000, url: "example.vercel.app" });
  assert.equal(deployment.environment, "production"); assert.equal(deployment.status, "ready"); assert.equal(deployment.commitSha, "abc");
});
test("V6 founder development aggregates only owner-scoped GitHub repository references", async () => {
  const source = await readFile(new URL("../src/app/api/founder/route.ts", import.meta.url), "utf8");
  assert.match(source, /provider", "github"/); assert.match(source, /entity_type", "repository"/); assert.match(source, /openPullRequests/);
});
test("V6 support metrics require a meaningful sample before claiming a repeated issue", () => {
  const now = new Date("2026-09-06T12:00:00Z");
  assert.equal(supportSummary([{ category: "delivery", status: "open", created_at: "2026-09-05T10:00:00Z" }], now).topCategory, null);
  const result = supportSummary(["2026-09-05", "2026-09-04", "2026-09-03"].map((created_at) => ({ category: "delivery", status: "resolved", created_at: `${created_at}T10:00:00Z`, resolved_at: `${created_at}T12:00:00Z` })), now);
  assert.deepEqual(result.topCategory, { category: "delivery", count: 3 }); assert.equal(result.averageResolutionHours, 2);
});
test("V6 founder assistant tools are read-only by default and confirmation-gate operational drafts", async () => {
  const source = await readFile(new URL("../src/lib/ai-tools.ts", import.meta.url), "utf8");
  for (const name of ["get_company_health", "get_growth_funnel", "get_development_health", "get_ai_usage", "get_founder_attention_queue", "create_roadmap_item", "create_incident", "create_supplier_order_draft"]) assert.match(source, new RegExp(name));
  assert.match(source, /writeGuard\(confirmed\)/); assert.match(source, /eq\("user_id",ctx\.userId\)/);
});
test("V6 supplier order migration keeps product lines, supplier ownership, and creation atomic", async () => {
  const source = await readFile(new URL("../supabase/migrations/20260906140000_v6_supplier_order_items.sql", import.meta.url), "utf8");
  assert.match(source, /supplier_order_items/); assert.match(source, /enable row level security/); assert.match(source, /create_supplier_order_with_items/); assert.match(source, /Supplier not available/);
});
test("V6 supplier order UI explains non-automatic stock handling and refreshes after creation", async () => {
  const source = await readFile(new URL("../src/features/founder/supplier-orders.tsx", import.meta.url), "utf8");
  assert.match(source, /only action that changes inventory/); assert.match(source, /await load\(\)/); assert.match(source, /Create draft/);
});
test("V6 Today founder signals are owner-scoped and capped to urgent production conditions", async () => {
  const [route, dashboard] = await Promise.all([readFile(new URL("../src/app/api/today/route.ts", import.meta.url), "utf8"), readFile(new URL("../src/features/today/today-dashboard.tsx", import.meta.url), "utf8")]);
  assert.match(route, /founderSignals/); assert.match(route, /slice\(0,2\)/); assert.match(route, /eq\("user_id",userId\)/); assert.match(dashboard, /Founder attention/);
});
test("V6 weekly review extends the existing review with bounded company commerce, reliability, and AI metrics", async () => {
  const [route, page] = await Promise.all([readFile(new URL("../src/app/api/intelligence/review/weekly/route.ts", import.meta.url), "utf8"), readFile(new URL("../src/features/intelligence/intelligence-pages.tsx", import.meta.url), "utf8")]);
  assert.match(route, /withFounderReview/); assert.match(route, /company_funnel_snapshots/); assert.match(route, /ai_usage_records/); assert.match(page, /Para Officinal/);
});
test("V6 GitHub sync persists bounded normalized issue and pull-request detail", async () => {
  const [migration, sync, route] = await Promise.all([readFile(new URL("../supabase/migrations/20260906150000_v6_github_work_items_and_receiving.sql", import.meta.url), "utf8"), readFile(new URL("../src/lib/integrations/sync.ts", import.meta.url), "utf8"), readFile(new URL("../src/app/api/founder/development/route.ts", import.meta.url), "utf8")]);
  assert.match(migration, /github_work_items/); assert.match(migration, /auth\.uid\(\).*user_id/); assert.match(sync, /\/issues\?state=all/); assert.match(sync, /\/pulls\?state=all/); assert.match(route, /related/);
});
test("V6 development UI distinguishes synchronized state from unavailable review data and opens GitHub safely", async () => {
  const source = await readFile(new URL("../src/features/founder/founder-development.tsx", import.meta.url), "utf8");
  assert.match(source, /Review state remains unavailable/); assert.match(source, /target="_blank"/); assert.match(source, /linked/);
});
test("V6 supplier receipts use an owner-scoped idempotency record and only update stock through explicit confirmation", async () => {
  const [migration, route, ui] = await Promise.all([readFile(new URL("../supabase/migrations/20260906150000_v6_github_work_items_and_receiving.sql", import.meta.url), "utf8"), readFile(new URL("../src/app/api/founder/supplier-orders/[id]/route.ts", import.meta.url), "utf8"), readFile(new URL("../src/features/founder/supplier-orders.tsx", import.meta.url), "utf8")]);
  assert.match(migration, /supplier_order_receipts/); assert.match(migration, /unique\(user_id, supplier_order_id, idempotency_key\)/); assert.match(migration, /coalesce\(prior_stock.available_stock,0\)\+received/); assert.match(route, /receive_supplier_order_items/); assert.match(ui, /Confirm receiving/);
});
test("V6 supplier order transitions block terminal states and keep cancellation explicit", async () => {
  const [source, migration] = await Promise.all([readFile(new URL("../src/app/api/founder/supplier-orders/[id]/route.ts", import.meta.url), "utf8"), readFile(new URL("../supabase/migrations/20260906150000_v6_github_work_items_and_receiving.sql", import.meta.url), "utf8")]);
  assert.match(source, /draft: \["ordered", "canceled"\]/); assert.match(migration, /Supplier order cannot receive items/); assert.match(source, /transition is not allowed/);
});
test("V6 deployment source health is honest about missing, stale, failed, and current sources", () => {
  assert.equal(deploymentSourceHealth({ connected: false }).state, "not_connected");
  assert.equal(deploymentSourceHealth({ connected: true, lastSuccessfulSync: "2026-09-04T00:00:00Z", now: new Date("2026-09-06T12:00:00Z") }).state, "stale");
  assert.equal(deploymentSourceHealth({ connected: true, providerError: true }).state, "needs_attention");
  assert.equal(deploymentSourceHealth({ connected: true, lastSuccessfulSync: "2026-09-06T11:00:00Z", now: new Date("2026-09-06T12:00:00Z") }).state, "connected");
});
test("V6 campaign drilldown preserves missing attribution and separates currencies", async () => {
  const [route, ui] = await Promise.all([readFile(new URL("../src/app/api/founder/marketing/route.ts", import.meta.url), "utf8"), readFile(new URL("../src/features/founder/founder-marketing.tsx", import.meta.url), "utf8")]);
  assert.match(route, /campaignId.*currency/); assert.match(route, /campaign\.spend != null/); assert.match(route, /eligible\.length < 2/);
  assert.match(ui, /Based on tracked attribution data/); assert.match(ui, /Unavailable/); assert.match(ui, /Limited tracked sample/);
});
test("V6 campaign performance queries stay owner and company scoped", async () => {
  const source = await readFile(new URL("../src/app/api/founder/marketing/route.ts", import.meta.url), "utf8");
  assert.match(source, /requireUser\(\)/); assert.match(source, /eq\("user_id", userId\)/); assert.match(source, /eq\("company_id", company\.data\.id\)/);
});
test("V6 operational hooks use notification preference/dedupe infrastructure without auto-actions", async () => {
  const source = await readFile(new URL("../src/lib/notification-producers.ts", import.meta.url), "utf8");
  for (const key of ["founder:low-stock", "founder:deployment", "founder:incident", "founder:supplier-overdue", "founder:commerce-anomaly"]) assert.match(source, new RegExp(key));
  assert.match(source, /notifyOnce/); assert.match(source, /resolveNotifications/); assert.doesNotMatch(source, /insert into supplier_orders/);
});
test("V6 supplier order drafts can edit owned details and multiple product lines before ordering", async () => {
  const [migration, route, ui] = await Promise.all([readFile(new URL("../supabase/migrations/20260906150000_v6_github_work_items_and_receiving.sql", import.meta.url), "utf8"), readFile(new URL("../src/app/api/founder/supplier-orders/[id]/route.ts", import.meta.url), "utf8"), readFile(new URL("../src/features/founder/supplier-orders.tsx", import.meta.url), "utf8")]);
  assert.match(migration, /update_supplier_order_draft/); assert.match(migration, /saved\.status <> 'draft'/); assert.match(route, /update_supplier_order_draft/); assert.match(route, /eq\("user_id", userId\)/); assert.match(ui, /Add item/); assert.match(ui, /Edit supplier order/);
});
test("V6 receiving remains explicit and mobile-safe rather than a status side effect", async () => {
  const [ui, css] = await Promise.all([readFile(new URL("../src/features/founder/supplier-orders.tsx", import.meta.url), "utf8"), readFile(new URL("../src/app/globals.css", import.meta.url), "utf8")]);
  assert.match(ui, /Only newly received quantities increase inventory/); assert.match(ui, /idempotencyKey/); assert.match(ui, /Confirm receiving/); assert.match(css, /founder-product-row.*flex-direction:column/);
});
test("V6 development and campaign records participate in owner-scoped local search", async () => {
  const [search, palette] = await Promise.all([readFile(new URL("../src/app/api/search/route.ts", import.meta.url), "utf8"), readFile(new URL("../src/components/command-palette.tsx", import.meta.url), "utf8")]);
  assert.match(search, /github_work_items/); assert.match(search, /marketing_attribution_records/); assert.match(search, /eq\("user_id", userId\)/); assert.match(palette, /founder\/development/); assert.match(palette, /founder\/marketing/);
});
test("V6 founder development display uses synchronized refs and direct external links only", async () => {
  const [route, ui] = await Promise.all([readFile(new URL("../src/app/api/founder/development/route.ts", import.meta.url), "utf8"), readFile(new URL("../src/features/founder/founder-development.tsx", import.meta.url), "utf8")]);
  assert.match(route, /github_work_items/); assert.match(route, /incidents/); assert.match(ui, /item\.labels/); assert.match(ui, /milestone/i); assert.match(ui, /rel="noreferrer"/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { readFile, access } from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  calculateSalesVelocity,
  calculateCoverageDays,
  evaluateStockoutRisk,
  evaluateOverstockRisk,
  buildReorderRecommendation,
  detectSlowMovingStock,
  evaluateSupplierPerformance,
  evaluatePurchaseOrderHealth,
  evaluateProductMomentum,
  buildCommerceRisks,
  rankNextCommerceMove,
  buildCommerceReview,
  validateForeignOwnership,
} from "../src/lib/commerce";
import { safeAutomationTypes } from "../src/lib/v4";
import { emitCommerceNotifications } from "../src/lib/notification-producers";
import { assistantTools } from "../src/lib/ai-tools";

const BASE_DIR = path.resolve(__dirname, "..");

// ============================================================
// 1. Pure Calculation Functions
// ============================================================

test("V14 calculateSalesVelocity computes 30-day velocity safely with zero fabrication", () => {
  const sales = [
    { quantity: 15, created_at: "2026-09-01T00:00:00Z" },
    { quantity: 15, created_at: "2026-08-25T00:00:00Z" },
  ];
  const res = calculateSalesVelocity(sales, 30);
  assert.ok(res !== null);
  assert.equal(res.totalSold, 30);
  assert.equal(res.dailyVelocity, 1);

  // Zero sales
  const emptyRes = calculateSalesVelocity([], 30);
  assert.ok(emptyRes !== null);
  assert.equal(emptyRes.totalSold, 0);
  assert.equal(emptyRes.dailyVelocity, 0);
});

test("V14 calculateCoverageDays returns exact days or null on zero velocity", () => {
  assert.equal(calculateCoverageDays(30, 1), 30);
  assert.equal(calculateCoverageDays(0, 1), 0);
  assert.equal(calculateCoverageDays(30, 0), null);
  assert.equal(calculateCoverageDays(30, null), null);
});

test("V14 evaluateStockoutRisk derives discrete states accurately", () => {
  // Out of stock
  const oos = evaluateStockoutRisk({
    availableStock: 0,
    dailyVelocity: 2,
    leadTimeDays: 7,
  });
  assert.equal(oos.state, "critical");
  assert.equal(oos.coverageDays, 0);

  // Critical: coverage <= leadTime
  const crit = evaluateStockoutRisk({
    availableStock: 10,
    dailyVelocity: 2, // 5 days coverage
    leadTimeDays: 7,
  });
  assert.equal(crit.state, "critical");

  // High: coverage <= 1.5x leadTime
  const high = evaluateStockoutRisk({
    availableStock: 18,
    dailyVelocity: 2, // 9 days coverage <= 10.5
    leadTimeDays: 7,
  });
  assert.equal(high.state, "high");

  // Safe: abundant coverage
  const safe = evaluateStockoutRisk({
    availableStock: 100,
    dailyVelocity: 2, // 50 days coverage
    leadTimeDays: 7,
  });
  assert.equal(safe.state, "safe");

  // Unknown: no velocity
  const unk = evaluateStockoutRisk({
    availableStock: 50,
    dailyVelocity: null,
    leadTimeDays: 7,
  });
  assert.equal(unk.state, "unknown");
});

test("V14 evaluateOverstockRisk detects excessive inventory", () => {
  // Overstock
  const over = evaluateOverstockRisk({
    availableStock: 300,
    dailyVelocity: 2, // 150 days coverage vs 60 maxStockDays
    maxStockDays: 60,
    unitCost: 10,
    currency: "MAD",
  });
  assert.equal(over.state, "high");
  assert.ok(over.tiedUpCapital !== null && over.tiedUpCapital > 0);

  // Normal
  const normal = evaluateOverstockRisk({
    availableStock: 60,
    dailyVelocity: 2, // 30 days coverage
    maxStockDays: 60,
  });
  assert.equal(normal.state, "normal");
});

test("V14 buildReorderRecommendation gives deterministic advisory output", () => {
  const rec = buildReorderRecommendation({
    product: { id: "p-1", name: "Widget A", unit_cost: 20, currency: "MAD" },
    availableStock: 10,
    dailyVelocity: 2, // 5 days coverage
    leadTimeDays: 7,
    minStockDays: 14,
    maxStockDays: 45,
    safetyStockUnits: 10,
    moq: 50,
    primarySupplierId: "sup-1",
  });
  assert.equal(rec.state, "reorder_now");
  assert.ok(rec.suggestedQuantity >= 50); // respects MOQ
  assert.ok(rec.reason.length > 0);
});

test("V14 detectSlowMovingStock flags dormant products", () => {
  const products = [
    {
      id: "p-dead",
      name: "Old Item",
      availableStock: 50,
      dailyVelocity: 0,
      unit_cost: 15,
      currency: "MAD",
      lastSoldAt: "2026-06-01T00:00:00Z", // >90 days ago
    },
    {
      id: "p-active",
      name: "Active Item",
      availableStock: 10,
      dailyVelocity: 2,
      unit_cost: 10,
      currency: "MAD",
      lastSoldAt: "2026-09-05T00:00:00Z",
    },
  ];

  const slow = detectSlowMovingStock({ products });
  assert.equal(slow.length, 1);
  assert.equal(slow[0].productId, "p-dead");
  assert.equal(slow[0].severity, "dormant");
});

test("V14 evaluateSupplierPerformance calculates lead time and reliability", () => {
  const supplier = { id: "sup-1", name: "Acme Supply", lead_time_days: 10 };
  const orders = [
    {
      id: "po-1",
      supplier_id: "sup-1",
      ordered_at: "2026-08-01T00:00:00Z",
      expected_at: "2026-08-11T00:00:00Z",
      received_at: "2026-08-10T00:00:00Z", // on time (9 days)
      created_at: "2026-08-01T00:00:00Z",
      status: "received",
    },
    {
      id: "po-2",
      supplier_id: "sup-1",
      ordered_at: "2026-08-15T00:00:00Z",
      expected_at: "2026-08-25T00:00:00Z",
      received_at: "2026-08-24T00:00:00Z", // on time (9 days)
      created_at: "2026-08-15T00:00:00Z",
      status: "received",
    },
  ];
  const items = [
    { supplier_order_id: "po-1", quantity: 100, quantity_received: 100 },
    { supplier_order_id: "po-2", quantity: 50, quantity_received: 50 },
  ];

  const perf = evaluateSupplierPerformance({ supplier, orders, orderItems: items });
  assert.equal(perf.state, "reliable");
  assert.equal(perf.fillRate, 100);
  assert.equal(perf.onTimeRate, 100);
});

test("V14 evaluatePurchaseOrderHealth tracks PO state and delays", () => {
  // Late order
  const lateOrder = {
    id: "po-late",
    status: "ordered",
    ordered_at: "2026-08-01T00:00:00Z",
    expected_at: "2026-08-20T00:00:00Z",
    created_at: "2026-08-01T00:00:00Z",
  };
  const lateHealth = evaluatePurchaseOrderHealth(lateOrder, [{ quantity: 10, quantity_received: 0 }]);
  assert.equal(lateHealth.state, "late");
  assert.equal(lateHealth.isLate, true);
  assert.ok(lateHealth.daysOverdue > 0);

  // Complete order
  const compOrder = {
    id: "po-done",
    status: "received",
    ordered_at: "2026-08-01T00:00:00Z",
    expected_at: "2026-08-10T00:00:00Z",
    created_at: "2026-08-01T00:00:00Z",
  };
  const compHealth = evaluatePurchaseOrderHealth(compOrder, [{ quantity: 10, quantity_received: 10 }]);
  assert.equal(compHealth.state, "completed");
  assert.equal(compHealth.itemsCompletionRate, 100);
});

test("V14 evaluateProductMomentum categorizes growth trends", () => {
  assert.equal(evaluateProductMomentum(50, 20).state, "growing");
  assert.equal(evaluateProductMomentum(20, 50).state, "declining");
  assert.equal(evaluateProductMomentum(30, 30).state, "stable");
  assert.equal(evaluateProductMomentum(0, 0).state, "insufficient_history");
});

test("V14 buildCommerceRisks aggregates distinct stock, order, and supplier risks", () => {
  const risks = buildCommerceRisks({
    stockoutItems: [
      {
        productId: "p-crit",
        productName: "Critical Stock Product",
        sku: null,
        state: "reorder_now",
        coverageDays: 0,
        suggestedQuantity: 100,
        estimatedCost: 1000,
        currency: "MAD",
        leadTimeDays: 7,
        primarySupplierId: null,
        reason: "OOS",
      },
    ],
    supplierOrders: [
      {
        id: "po-1",
        reference: "PO-001",
        health: { state: "late", isLate: true, daysOverdue: 5 },
      },
    ],
    discrepancies: [
      {
        id: "disc-1",
        productName: "Item",
        discrepancyUnits: -5,
        costImpact: 100,
        currency: "MAD",
        status: "investigating",
      },
    ],
    overstockItems: [
      {
        productId: "p-over",
        productName: "Over Item",
        excessUnits: 200,
        tiedUpCapital: 6000,
        currency: "MAD",
      },
    ],
    missingCostCount: 2,
  });

  assert.ok(risks.some((r) => r.type === "stockout"));
  assert.ok(risks.some((r) => r.type === "late_order"));
  assert.ok(risks.some((r) => r.type === "discrepancy"));
  assert.ok(risks.some((r) => r.type === "cost_missing"));
});

test("V14 rankNextCommerceMove selects highest priority move", () => {
  const risks = buildCommerceRisks({
    stockoutItems: [
      {
        productId: "p-crit",
        productName: "Critical Stock Product",
        sku: null,
        state: "reorder_now",
        coverageDays: 0,
        suggestedQuantity: 100,
        estimatedCost: 1000,
        currency: "MAD",
        leadTimeDays: 7,
        primarySupplierId: null,
        reason: "OOS",
      },
    ],
    supplierOrders: [],
    discrepancies: [],
    overstockItems: [],
  });

  const move = rankNextCommerceMove(risks);
  assert.ok(move !== null);
  assert.equal(move.urgency, "critical");
  assert.ok(move.headline.toLowerCase().includes("stockout") || move.action.toLowerCase().includes("reorder"));
});

test("V14 buildCommerceReview groups financials by currency cleanly", () => {
  const review = buildCommerceReview({
    products: [
      { id: "p-1", currency: "MAD", availableStock: 10, unit_cost: 100, totalSold30d: 5, selling_price: 150 },
      { id: "p-2", currency: "EUR", availableStock: 5, unit_cost: 50, totalSold30d: 2, selling_price: 80 },
    ],
    supplierOrders: [],
    slowStockCount: 1,
    activeRisksCount: 2,
  });

  assert.ok(review.currencyBuckets.MAD !== undefined);
  assert.ok(review.currencyBuckets.EUR !== undefined);
  assert.equal(review.currencyBuckets.MAD.inventoryValue, 1000);
  assert.equal(review.currencyBuckets.EUR.inventoryValue, 250);
});

test("V14 validateForeignOwnership rejects mismatched owner IDs", async () => {
  const mockClient = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null }),
            }),
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;

  const res = await validateForeignOwnership(mockClient, "user-111", "comp-111", {
    productId: "p-1",
  });
  assert.equal(res.valid, false);
  assert.ok(res.error);

  const mockClientSuccess = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { id: "p-1" } }),
            }),
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;

  const resSuccess = await validateForeignOwnership(mockClientSuccess, "user-111", "comp-111", {
    productId: "p-1",
  });
  assert.equal(resSuccess.valid, true);
});

// ============================================================
// 2. Migration & Database Layer
// ============================================================

test("V14 migration file exists and defines 8 owner-scoped tables with RLS", async () => {
  const migPath = path.join(
    BASE_DIR,
    "supabase/migrations/20260909180000_v14_commerce_inventory_intelligence.sql"
  );
  await access(migPath);
  const sql = await readFile(migPath, "utf8");

  // Check table definitions
  const tables = [
    "inventory_policies",
    "inventory_discrepancies",
    "inventory_audits",
    "inventory_audit_lines",
    "inventory_adjustments",
    "product_supplier_links",
    "saved_inventory_scenarios",
    "commerce_review_records",
  ];

  for (const t of tables) {
    assert.ok(sql.includes(`create table if not exists ${t}`), `Missing table: ${t}`);
    assert.ok(sql.includes(`'${t}'`), `Missing table in RLS loop: ${t}`);
  }
  assert.ok(sql.includes("enable row level security"));
  assert.ok(sql.includes("auth.uid()"));
});

// ============================================================
// 3. Cross-Domain Integrations
// ============================================================

test("V14 safeAutomationTypes includes all 8 commerce automation types", () => {
  const expectedTypes = [
    "daily_inventory_review",
    "weekly_commerce_review",
    "replenishment_review",
    "supplier_order_review",
    "supplier_performance_review",
    "slow_stock_review",
    "cost_data_review",
    "inventory_audit_review",
  ];

  for (const t of expectedTypes) {
    assert.ok(safeAutomationTypes.includes(t as (typeof safeAutomationTypes)[number]), `Missing automation type: ${t}`);
  }
});

test("V14 assistantTools includes all 16 commerce read and write tools", () => {
  const toolNames = assistantTools.map((t) => t.name);
  const expectedTools = [
    "get_commerce_overview",
    "get_inventory_intelligence",
    "get_replenishment_queue",
    "get_slow_stock",
    "get_product_intelligence",
    "get_commerce_suppliers",
    "get_purchase_review",
    "get_commerce_risks",
    "get_commerce_review",
    "get_inventory_discrepancies",
    "get_inventory_audits",
    "get_inventory_movements",
    "get_inventory_scenarios",
    "get_commerce_brands",
    "get_commerce_categories",
    "get_next_commerce_move",
    "record_inventory_discrepancy",
    "resolve_inventory_discrepancy",
    "create_inventory_adjustment",
  ];

  for (const name of expectedTools) {
    assert.ok(toolNames.includes(name), `Missing AI tool: ${name}`);
  }
});

test("V14 notification producers export emitCommerceNotifications", () => {
  assert.equal(typeof emitCommerceNotifications, "function");
});

// ============================================================
// 4. File Structure Verification
// ============================================================

test("V14 all 24 API routes exist", async () => {
  const routes = [
    "src/app/api/commerce/overview/route.ts",
    "src/app/api/commerce/inventory/route.ts",
    "src/app/api/commerce/replenishment/route.ts",
    "src/app/api/commerce/slow-stock/route.ts",
    "src/app/api/commerce/products/route.ts",
    "src/app/api/commerce/products/[id]/route.ts",
    "src/app/api/commerce/brands/route.ts",
    "src/app/api/commerce/categories/route.ts",
    "src/app/api/commerce/suppliers/route.ts",
    "src/app/api/commerce/suppliers/[id]/route.ts",
    "src/app/api/commerce/purchasing/route.ts",
    "src/app/api/commerce/purchase-review/route.ts",
    "src/app/api/commerce/orders/route.ts",
    "src/app/api/commerce/orders/[id]/route.ts",
    "src/app/api/commerce/discrepancies/route.ts",
    "src/app/api/commerce/discrepancies/[id]/route.ts",
    "src/app/api/commerce/adjustments/route.ts",
    "src/app/api/commerce/audits/route.ts",
    "src/app/api/commerce/audits/[id]/route.ts",
    "src/app/api/commerce/policies/route.ts",
    "src/app/api/commerce/movements/route.ts",
    "src/app/api/commerce/risks/route.ts",
    "src/app/api/commerce/review/route.ts",
    "src/app/api/commerce/scenarios/route.ts",
  ];

  for (const r of routes) {
    await access(path.join(BASE_DIR, r));
  }
});

test("V14 all 14 workspace pages exist", async () => {
  const pages = [
    "src/app/(workspace)/commerce/page.tsx",
    "src/app/(workspace)/commerce/inventory/page.tsx",
    "src/app/(workspace)/commerce/replenishment/page.tsx",
    "src/app/(workspace)/commerce/slow-stock/page.tsx",
    "src/app/(workspace)/commerce/products/page.tsx",
    "src/app/(workspace)/commerce/brands/page.tsx",
    "src/app/(workspace)/commerce/categories/page.tsx",
    "src/app/(workspace)/commerce/suppliers/page.tsx",
    "src/app/(workspace)/commerce/purchasing/page.tsx",
    "src/app/(workspace)/commerce/purchase-review/page.tsx",
    "src/app/(workspace)/commerce/movements/page.tsx",
    "src/app/(workspace)/commerce/audits/page.tsx",
    "src/app/(workspace)/commerce/risks/page.tsx",
    "src/app/(workspace)/commerce/review/page.tsx",
  ];

  for (const p of pages) {
    await access(path.join(BASE_DIR, p));
  }
});

test("V14 all 14 feature components exist", async () => {
  const components = [
    "src/features/commerce/commerce-home.tsx",
    "src/features/commerce/inventory-view.tsx",
    "src/features/commerce/replenishment-view.tsx",
    "src/features/commerce/slow-stock-view.tsx",
    "src/features/commerce/products-performance-view.tsx",
    "src/features/commerce/brands-categories-view.tsx",
    "src/features/commerce/suppliers-view.tsx",
    "src/features/commerce/purchasing-view.tsx",
    "src/features/commerce/purchase-review-view.tsx",
    "src/features/commerce/discrepancies-audits-view.tsx",
    "src/features/commerce/movements-view.tsx",
    "src/features/commerce/commerce-risks-view.tsx",
    "src/features/commerce/commerce-review-view.tsx",
    "src/features/commerce/stockout-badge.tsx",
  ];

  for (const c of components) {
    await access(path.join(BASE_DIR, c));
  }
});

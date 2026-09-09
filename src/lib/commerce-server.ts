import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/supabase/server";
import {
  calculateSalesVelocity,
  evaluateStockoutRisk,
  evaluateOverstockRisk,
  buildReorderRecommendation,
  detectSlowMovingStock,
  evaluateSupplierPerformance,
  evaluatePurchaseOrderHealth,
  evaluateProductMomentum,
  buildCommerceRisks,
  rankNextCommerceMove,
  type ReorderRecommendation,
  type CommerceRiskItem,
} from "./commerce";

// ---------------------------------------------------------------------------
// CommerceState — typed return shape of loadFullCommerceState
// ---------------------------------------------------------------------------
export interface CommerceProductIntelligence extends Record<string, unknown> {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  brand: string | null;
  unit_cost: number | null;
  selling_price: number | null;
  currency: string;
  availableStock: number;
  reservedStock: number;
  dailyVelocity: number | null;
  totalSold30d: number;
  stockout: ReturnType<typeof evaluateStockoutRisk>;
  overstock: ReturnType<typeof evaluateOverstockRisk>;
  reorder: ReorderRecommendation;
  momentum: ReturnType<typeof evaluateProductMomentum>;
  leadTimeDays: number;
  policy: Record<string, unknown> | null;
  primarySupplierLink: Record<string, unknown> | null;
  marginAmount: number | null;
  marginRate: number | null;
}

export interface CommerceSupplierIntelligence extends Record<string, unknown> {
  id: string;
  name: string;
  performance: ReturnType<typeof evaluateSupplierPerformance>;
}

export interface CommerceOrderWithHealth extends Record<string, unknown> {
  id: string;
  supplier_id: string;
  reference: string | null;
  status: string;
  health: ReturnType<typeof evaluatePurchaseOrderHealth>;
  items: Record<string, unknown>[];
}

export interface CommerceState {
  products: CommerceProductIntelligence[];
  suppliers: CommerceSupplierIntelligence[];
  supplierOrders: CommerceOrderWithHealth[];
  supplierOrderItems: Record<string, unknown>[];
  policies: Record<string, unknown>[];
  discrepancies: Record<string, unknown>[];
  audits: Record<string, unknown>[];
  adjustments: Record<string, unknown>[];
  supplierLinks: Record<string, unknown>[];
  slowStock: ReturnType<typeof detectSlowMovingStock>;
  activeRisks: CommerceRiskItem[];
  nextMove: ReturnType<typeof rankNextCommerceMove>;
  currencyBuckets: Record<string, { inventoryValue: number; sales30d: number; orderCount: number }>;
  missingCostCount: number;
}

export async function getCommerceContext() {
  const { supabase, userId } = await requireUser();
  const company = await supabase
    .from("companies")
    .select("id, name, currency")
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();

  if (company.error) throw company.error;

  return {
    supabase,
    userId,
    company: company.data,
    companyId: company.data?.id ?? null,
    isConfigured: !!company.data?.id,
  };
}

export async function loadFullCommerceState(supabase: SupabaseClient, userId: string, companyId: string): Promise<CommerceState> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString();

  const [
    productsRes,
    snapshotsRes,
    orderItemsRes,
    priorOrderItemsRes,
    suppliersRes,
    supplierOrdersRes,
    supplierOrderItemsRes,
    policiesRes,
    discrepanciesRes,
    auditsRes,
    adjustmentsRes,
    supplierLinksRes,
  ] = await Promise.all([
    supabase
      .from("product_catalog_refs")
      .select("*")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .order("name"),
    supabase
      .from("inventory_snapshots")
      .select("*")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .order("captured_at", { ascending: false })
      .limit(1000),
    supabase
      .from("commerce_order_items")
      .select("id, order_id, product_id, product_name, quantity, unit_price, unit_cost, created_at")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .gte("created_at", thirtyDaysAgo),
    supabase
      .from("commerce_order_items")
      .select("id, product_id, quantity, created_at")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .gte("created_at", sixtyDaysAgo)
      .lt("created_at", thirtyDaysAgo),
    supabase
      .from("supplier_records")
      .select("*")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .order("name"),
    supabase
      .from("supplier_orders")
      .select("*")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("supplier_order_items")
      .select("*")
      .eq("user_id", userId)
      .eq("company_id", companyId),
    supabase
      .from("inventory_policies")
      .select("*")
      .eq("user_id", userId)
      .eq("company_id", companyId),
    supabase
      .from("inventory_discrepancies")
      .select("*")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .order("reported_at", { ascending: false }),
    supabase
      .from("inventory_audits")
      .select("*")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("inventory_adjustments")
      .select("*")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .order("recorded_at", { ascending: false })
      .limit(100),
    supabase
      .from("product_supplier_links")
      .select("*")
      .eq("user_id", userId)
      .eq("company_id", companyId),
  ]);

  const products = productsRes.data ?? [];
  const snapshots = snapshotsRes.data ?? [];
  const orderItems = orderItemsRes.data ?? [];
  const priorOrderItems = priorOrderItemsRes.data ?? [];
  const suppliers = suppliersRes.data ?? [];
  const supplierOrders = supplierOrdersRes.data ?? [];
  const supplierOrderItems = supplierOrderItemsRes.data ?? [];
  const policies = policiesRes.data ?? [];
  const discrepancies = discrepanciesRes.data ?? [];
  const audits = auditsRes.data ?? [];
  const adjustments = adjustmentsRes.data ?? [];
  const supplierLinks = supplierLinksRes.data ?? [];

  // Index latest snapshot per product
  const latestSnapshotMap = new Map<string, Record<string, unknown>>();
  for (const snap of snapshots) {
    if (snap.product_id && !latestSnapshotMap.has(snap.product_id)) {
      latestSnapshotMap.set(snap.product_id, snap);
    }
  }

  // Index policies per product
  const policyMap = new Map<string, Record<string, unknown>>();
  for (const pol of policies) {
    if (pol.product_id && pol.active) {
      policyMap.set(pol.product_id, pol);
    }
  }

  // Index primary supplier link per product
  const primarySupplierLinkMap = new Map<string, Record<string, unknown>>();
  for (const link of supplierLinks) {
    if (link.product_id && link.is_primary) {
      primarySupplierLinkMap.set(link.product_id, link);
    }
  }

  // Group sales items by product_id
  const recentSalesByProduct = new Map<string, Array<{ quantity: string | number; created_at?: string | null }>>();
  for (const item of orderItems) {
    if (item.product_id) {
      const list = recentSalesByProduct.get(item.product_id) || [];
      list.push({
        quantity: (item.quantity as string | number) ?? 0,
        created_at: (item.created_at as string | null) ?? null,
      });
      recentSalesByProduct.set(item.product_id, list);
    }
  }

  const priorSalesByProduct = new Map<string, number>();
  for (const item of priorOrderItems) {
    if (item.product_id) {
      const current = priorSalesByProduct.get(item.product_id) || 0;
      priorSalesByProduct.set(item.product_id, current + (Number(item.quantity) || 0));
    }
  }

  // Compute product intelligence
  let missingCostCount = 0;
  const productIntelligence: CommerceProductIntelligence[] = products.map((prod: Record<string, unknown>) => {
    const prodId = prod.id as string;
    const snap = latestSnapshotMap.get(prodId);
    const availableStock = snap ? Number(snap.available_stock) || 0 : 0;
    const reservedStock = snap ? Number(snap.reserved_stock) || 0 : 0;
    const policy = policyMap.get(prodId);
    const supplierLink = primarySupplierLinkMap.get(prodId);

    if (prod.unit_cost === null || prod.unit_cost === undefined) {
      missingCostCount++;
    }

    const sales = recentSalesByProduct.get(prodId) || [];
    const velocityResult = calculateSalesVelocity(sales, 30);
    const dailyVelocity = velocityResult ? velocityResult.dailyVelocity : null;
    const totalSold30d = velocityResult ? velocityResult.totalSold : 0;

    const leadTime = (supplierLink?.lead_time_days as number | undefined) ?? 7;
    const minStockDays = (policy?.min_stock_days as number | undefined) ?? 14;
    const maxStockDays = (policy?.max_stock_days as number | undefined) ?? 60;
    const safetyStockUnits = (policy?.safety_stock_units as number | undefined) ?? 0;
    const moq = (supplierLink?.moq as number | undefined) ?? 1;

    const stockout = evaluateStockoutRisk({
      availableStock,
      dailyVelocity,
      leadTimeDays: leadTime,
      safetyStockUnits,
    });

    const overstock = evaluateOverstockRisk({
      availableStock,
      dailyVelocity,
      maxStockDays,
      unitCost: prod.unit_cost as number | null | undefined,
      currency: prod.currency as string | undefined,
    });

    const reorder = buildReorderRecommendation({
      product: { id: prodId, name: prod.name as string, sku: prod.sku as string | null | undefined, unit_cost: prod.unit_cost as number | null | undefined, currency: prod.currency as string | undefined },
      availableStock,
      dailyVelocity,
      leadTimeDays: leadTime,
      minStockDays,
      maxStockDays,
      safetyStockUnits,
      moq,
      primarySupplierId: (supplierLink?.supplier_id as string | undefined) ?? null,
    });

    const priorSales = priorSalesByProduct.get(prodId) || 0;
    const momentum = evaluateProductMomentum(totalSold30d, priorSales);

    // Gross margin estimation (strictly if both selling_price and unit_cost exist)
    const sellingPrice = Number(prod.selling_price) || 0;
    const unitCost = Number(prod.unit_cost) || 0;
    const marginAmount = sellingPrice > 0 && unitCost > 0 ? Number((sellingPrice - unitCost).toFixed(2)) : null;
    const marginRate = sellingPrice > 0 && marginAmount !== null ? Number(((marginAmount / sellingPrice) * 100).toFixed(1)) : null;

    return {
      ...prod,
      id: prodId,
      name: prod.name as string,
      sku: (prod.sku as string | null) ?? null,
      category: (prod.category as string | null) ?? null,
      brand: (prod.brand as string | null) ?? null,
      unit_cost: prod.unit_cost !== null && prod.unit_cost !== undefined ? Number(prod.unit_cost) : null,
      selling_price: prod.selling_price !== null && prod.selling_price !== undefined ? Number(prod.selling_price) : null,
      currency: (prod.currency as string) || "MAD",
      availableStock,
      reservedStock,
      dailyVelocity,
      totalSold30d,
      stockout,
      overstock,
      reorder,
      momentum,
      leadTimeDays: leadTime,
      policy: policy || null,
      primarySupplierLink: supplierLink || null,
      marginAmount,
      marginRate,
    };
  });

  // Slow moving stock detection
  const slowStock = detectSlowMovingStock({
    products: productIntelligence.map((p: CommerceProductIntelligence) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      availableStock: p.availableStock,
      dailyVelocity: p.dailyVelocity,
      unit_cost: p.unit_cost,
      currency: p.currency,
      lastSoldAt: (recentSalesByProduct.get(p.id) || [])[0]?.created_at ?? null,
    })),
  });

  // Group supplier orders and items
  const itemsBySupplierOrder = new Map<string, Record<string, unknown>[]>();
  for (const it of supplierOrderItems) {
    const list = itemsBySupplierOrder.get(it.supplier_order_id) || [];
    list.push(it);
    itemsBySupplierOrder.set(it.supplier_order_id, list);
  }

  // Supplier orders health
  const supplierOrdersWithHealth: CommerceOrderWithHealth[] = supplierOrders.map((po: Record<string, unknown>) => {
    const items = itemsBySupplierOrder.get(po.id as string) || [];
    const health = evaluatePurchaseOrderHealth(po as Parameters<typeof evaluatePurchaseOrderHealth>[0], items as Parameters<typeof evaluatePurchaseOrderHealth>[1]);
    return {
      ...po,
      items: items as Record<string, unknown>[],
      health,
    } as CommerceOrderWithHealth;
  });

  // Supplier performance
  const ordersBySupplier = new Map<string, Record<string, unknown>[]>();
  for (const po of supplierOrders) {
    const list = ordersBySupplier.get(po.supplier_id) || [];
    list.push(po);
    ordersBySupplier.set(po.supplier_id, list);
  }

  const supplierPerformanceList: CommerceSupplierIntelligence[] = suppliers.map((sup: Record<string, unknown>) => {
    const supOrders = ordersBySupplier.get(sup.id as string) || [];
    const orderIds = new Set(supOrders.map((o: Record<string, unknown>) => o.id as string));
    const supItems = supplierOrderItems.filter((it: Record<string, unknown>) => orderIds.has(it.supplier_order_id as string));
    const perf = evaluateSupplierPerformance({
      supplier: sup as Parameters<typeof evaluateSupplierPerformance>[0]["supplier"],
      orders: supOrders as Parameters<typeof evaluateSupplierPerformance>[0]["orders"],
      orderItems: supItems as Parameters<typeof evaluateSupplierPerformance>[0]["orderItems"],
    });
    return {
      ...sup,
      performance: perf,
    } as CommerceSupplierIntelligence;
  });

  // Map product name to discrepancies
  const prodNameMap = new Map(products.map((p: Record<string, unknown>) => [p.id as string, p.name as string]));
  const discrepanciesWithNames = discrepancies.map((d: Record<string, unknown>) => ({
    ...d,
    productName: prodNameMap.get(d.product_id as string) || "Unknown Product",
  }));

  // Build aggregate risks
  const reorderList = productIntelligence.map((p) => p.reorder);
  const overstockList = productIntelligence
    .filter((p) => p.overstock.state !== "normal" && p.overstock.excessUnits > 0)
    .map((p) => ({
      productId: p.id,
      productName: p.name,
      excessUnits: p.overstock.excessUnits,
      tiedUpCapital: p.overstock.tiedUpCapital,
      currency: p.currency,
    }));

  const activeRisks = buildCommerceRisks({
    stockoutItems: reorderList,
    overstockItems: overstockList,
    supplierOrders: supplierOrdersWithHealth.map((po: CommerceOrderWithHealth) => ({
      id: po.id,
      reference: po.reference,
      health: po.health,
    })),
    discrepancies: discrepanciesWithNames.map((d: Record<string, unknown>) => ({
      id: d.id as string,
      productName: d.productName as string,
      discrepancyUnits: Number(d.discrepancy_units) || 0,
      costImpact: d.cost_impact !== null ? Number(d.cost_impact) : null,
      currency: (d.currency as string) || "MAD",
      status: d.status as string,
    })),
    missingCostCount,
  });

  const nextMove = rankNextCommerceMove(activeRisks);

  // Multi-currency bucket aggregation: NEVER aggregate distinct currencies
  const currencyBuckets: Record<string, { inventoryValue: number; sales30d: number; orderCount: number }> = {};
  for (const prod of productIntelligence) {
    const c = prod.currency || "MAD";
    if (!currencyBuckets[c]) currencyBuckets[c] = { inventoryValue: 0, sales30d: 0, orderCount: 0 };
    if (prod.unit_cost && prod.availableStock > 0) {
      currencyBuckets[c].inventoryValue += Number((prod.unit_cost * prod.availableStock).toFixed(2));
    }
  }

  for (const item of orderItems) {
    const prod = products.find((p: Record<string, unknown>) => p.id === item.product_id);
    const c = (prod?.currency as string | undefined) || "MAD";
    if (!currencyBuckets[c]) currencyBuckets[c] = { inventoryValue: 0, sales30d: 0, orderCount: 0 };
    const amt = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
    currencyBuckets[c].sales30d += amt;
    currencyBuckets[c].orderCount += 1;
  }

  return {
    products: productIntelligence,
    suppliers: supplierPerformanceList,
    supplierOrders: supplierOrdersWithHealth as CommerceOrderWithHealth[],
    supplierOrderItems: supplierOrderItems as Record<string, unknown>[],
    policies: policies as Record<string, unknown>[],
    discrepancies: discrepanciesWithNames as Record<string, unknown>[],
    audits: audits as Record<string, unknown>[],
    adjustments: adjustments as Record<string, unknown>[],
    supplierLinks: supplierLinks as Record<string, unknown>[],
    slowStock,
    activeRisks,
    nextMove,
    currencyBuckets,
    missingCostCount,
  };
}

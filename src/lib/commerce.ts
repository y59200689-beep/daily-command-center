import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================
// Types and States
// ============================================================

export type StockoutRiskState =
  | "critical"
  | "high"
  | "watch"
  | "safe"
  | "unknown";

export type OverstockRiskState =
  | "high"
  | "elevated"
  | "normal"
  | "unknown";

export type ReorderState =
  | "reorder_now"
  | "review_soon"
  | "sufficient_stock"
  | "pause_replenishment"
  | "insufficient_data";

export type SupplierReliabilityState =
  | "reliable"
  | "watch"
  | "unreliable"
  | "insufficient_history";

export type PurchaseOrderHealthState =
  | "on_track"
  | "needs_attention"
  | "late"
  | "partial"
  | "blocked"
  | "completed"
  | "canceled"
  | "unknown";

export type ProductMomentumState =
  | "growing"
  | "stable"
  | "declining"
  | "insufficient_history";

export type InventoryMovementType =
  | "sale"
  | "receipt"
  | "adjustment"
  | "audit_adjustment"
  | "snapshot";

export type DiscrepancySeverity = "minor" | "moderate" | "significant" | "critical";

// ============================================================
// Zod Schemas
// ============================================================

const blank = (value: unknown) =>
  typeof value === "string" && !value.trim() ? null : value;

const optionalNumber = z.preprocess(
  blank,
  z.coerce.number().finite().nonnegative().nullable().optional()
);

const optionalSignedNumber = z.preprocess(
  blank,
  z.coerce.number().finite().nullable().optional()
);

const optionalInt = z.preprocess(
  blank,
  z.coerce.number().int().finite().nonnegative().nullable().optional()
);

const optionalUuid = z.preprocess(blank, z.string().uuid().nullable().optional());
const optionalText = (max = 5000) =>
  z.preprocess(blank, z.string().trim().max(max).nullable().optional());

export const currencyCodeSchema = z
  .string()
  .trim()
  .length(3)
  .transform((v) => v.toUpperCase())
  .default("MAD");

export const inventoryPolicySchema = z.object({
  id: z.string().uuid().optional(),
  product_id: z.string().uuid(),
  min_stock_days: z.coerce.number().int().min(0).max(365).default(14),
  max_stock_days: z.coerce.number().int().min(0).max(730).default(60),
  safety_stock_units: z.coerce.number().nonnegative().default(0),
  target_service_level: z.coerce.number().min(50).max(100).default(95),
  reorder_strategy: z
    .enum(["min_max", "fixed_interval", "demand_driven", "manual"])
    .default("min_max"),
  seasonal_factor: z.coerce.number().positive().default(1.0),
  notes: optionalText(5000),
  active: z.boolean().default(true),
});

export const inventoryDiscrepancySchema = z.object({
  id: z.string().uuid().optional(),
  product_id: z.string().uuid(),
  audit_id: optionalUuid,
  expected_stock: z.coerce.number().finite(),
  actual_stock: z.coerce.number().finite(),
  discrepancy_units: z.coerce.number().finite(),
  cost_impact: optionalSignedNumber,
  currency: currencyCodeSchema,
  discrepancy_type: z
    .enum(["shrinkage", "counting_error", "damage", "supplier_variance", "admin_error", "unexplained"])
    .default("unexplained"),
  status: z.enum(["investigating", "verified", "adjusted", "dismissed"]).default("investigating"),
  resolution_notes: optionalText(5000),
  reported_at: z.string().datetime().optional(),
});

export const inventoryAuditSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(240),
  status: z.enum(["draft", "in_progress", "completed", "cancelled"]).default("draft"),
  audit_type: z.enum(["full", "cycle_count", "spot_check", "supplier_reconciliation"]).default("spot_check"),
  location: optionalText(160),
  notes: optionalText(5000),
  started_at: z.string().datetime().nullable().optional(),
  completed_at: z.string().datetime().nullable().optional(),
});

export const inventoryAuditLineSchema = z.object({
  id: z.string().uuid().optional(),
  audit_id: z.string().uuid(),
  product_id: z.string().uuid(),
  expected_units: z.coerce.number().finite(),
  counted_units: z.coerce.number().finite(),
  variance_units: z.coerce.number().finite().optional(),
  unit_cost: optionalNumber,
  cost_variance: optionalSignedNumber,
  currency: currencyCodeSchema,
  notes: optionalText(2000),
});

export const inventoryAdjustmentSchema = z.object({
  id: z.string().uuid().optional(),
  product_id: z.string().uuid(),
  audit_id: optionalUuid,
  discrepancy_id: optionalUuid,
  adjustment_type: z.enum(["cycle_count", "write_off", "damage", "return_to_stock", "manual_correction"]),
  quantity_delta: z.coerce.number().finite(),
  previous_stock: optionalNumber,
  new_stock: optionalNumber,
  reason: z.string().trim().min(1).max(240),
  notes: optionalText(5000),
  recorded_at: z.string().datetime().optional(),
});

export const productSupplierLinkSchema = z.object({
  id: z.string().uuid().optional(),
  product_id: z.string().uuid(),
  supplier_id: z.string().uuid(),
  supplier_sku: optionalText(160),
  lead_time_days: optionalInt,
  unit_cost: optionalNumber,
  currency: currencyCodeSchema,
  moq: optionalNumber,
  is_primary: z.boolean().default(false),
  notes: optionalText(5000),
});

export const savedScenarioSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(240),
  description: optionalText(2000),
  parameters: z.record(z.string(), z.unknown()),
  results: z.record(z.string(), z.unknown()).default({}),
});

export const commerceReviewSchema = z.object({
  id: z.string().uuid().optional(),
  review_period: z.string().trim().min(1).max(80),
  summary_data: z.record(z.string(), z.unknown()),
  action_items: z.array(z.record(z.string(), z.unknown())).default([]),
  status: z.enum(["draft", "finalized", "archived"]).default("draft"),
  conducted_at: z.string().datetime().optional(),
});

export const commerceProductUpdateSchema = z.object({
  id: z.string().uuid(),
  brand: optionalText(160),
  selling_price: optionalNumber,
  category: optionalText(160),
  unit_cost: optionalNumber,
  currency: currencyCodeSchema.optional(),
  active: z.boolean().optional(),
});

// ============================================================
// Deterministic Calculations & Pure Functions
// ============================================================

/**
 * Calculates daily sales velocity over a specific period.
 * Strict rules:
 * - If periodDays is <= 0 or invalid: returns null.
 * - If zero sales occur in the period: returns dailyVelocity = 0, totalSold = 0.
 */
export function calculateSalesVelocity(
  items: Array<{ quantity: number | string; created_at?: string | null }>,
  periodDays = 30
): { dailyVelocity: number; totalSold: number; periodDays: number } | null {
  if (!Number.isFinite(periodDays) || periodDays <= 0) {
    return null;
  }
  const totalSold = items.reduce((sum, item) => {
    const qty = Number(item.quantity);
    return sum + (Number.isFinite(qty) && qty > 0 ? qty : 0);
  }, 0);

  const dailyVelocity = totalSold / periodDays;
  return {
    dailyVelocity: Number(dailyVelocity.toFixed(4)),
    totalSold: Number(totalSold.toFixed(2)),
    periodDays,
  };
}

/**
 * Calculates days of stock coverage.
 * Strict rule:
 * - If dailyVelocity is null or <= 0: return null (never Infinity or division by zero).
 */
export function calculateCoverageDays(
  availableStock: number,
  dailyVelocity: number | null
): number | null {
  if (!Number.isFinite(availableStock) || availableStock < 0) return 0;
  if (dailyVelocity === null || !Number.isFinite(dailyVelocity) || dailyVelocity <= 0) {
    return null;
  }
  const days = availableStock / dailyVelocity;
  return Math.max(0, Math.round(days * 10) / 10);
}

/**
 * Evaluates Stockout Risk state deterministically:
 * - critical: coverage <= leadTimeDays OR stock = 0
 * - high: coverage <= leadTimeDays * 1.5
 * - watch: coverage <= leadTimeDays * 2.5
 * - safe: coverage > leadTimeDays * 2.5
 * - unknown: velocity is unknown/null
 */
export function evaluateStockoutRisk(params: {
  availableStock: number;
  dailyVelocity: number | null;
  leadTimeDays: number;
  safetyStockUnits?: number;
}): {
  state: StockoutRiskState;
  coverageDays: number | null;
  runoutDate: string | null;
  explanation: string;
} {
  const stock = Math.max(0, Number(params.availableStock) || 0);
  const leadTime = Math.max(1, Number(params.leadTimeDays) || 7);

  if (stock === 0) {
    return {
      state: "critical",
      coverageDays: 0,
      runoutDate: new Date().toISOString().slice(0, 10),
      explanation: "Product is currently completely out of stock.",
    };
  }

  const coverage = calculateCoverageDays(stock, params.dailyVelocity);
  if (coverage === null) {
    return {
      state: "unknown",
      coverageDays: null,
      runoutDate: null,
      explanation: "No recent sales velocity available to calculate stockout risk.",
    };
  }

  const effectiveStockDays = coverage;
  const runout = new Date(Date.now() + effectiveStockDays * 86400000)
    .toISOString()
    .slice(0, 10);

  if (effectiveStockDays <= leadTime) {
    return {
      state: "critical",
      coverageDays: coverage,
      runoutDate: runout,
      explanation: `Coverage (${coverage} days) is within supplier lead time (${leadTime} days). Immediate reorder required.`,
    };
  }

  if (effectiveStockDays <= leadTime * 1.5) {
    return {
      state: "high",
      coverageDays: coverage,
      runoutDate: runout,
      explanation: `Stock coverage (${coverage} days) is less than 1.5x lead time (${leadTime} days). High stockout risk.`,
    };
  }

  if (effectiveStockDays <= leadTime * 2.5) {
    return {
      state: "watch",
      coverageDays: coverage,
      runoutDate: runout,
      explanation: `Stock coverage (${coverage} days) approaching reorder point. Monitor closely.`,
    };
  }

  return {
    state: "safe",
    coverageDays: coverage,
    runoutDate: runout,
    explanation: `Stock coverage (${coverage} days) is healthy and comfortably exceeds lead time (${leadTime} days).`,
  };
}

/**
 * Evaluates Overstock Risk deterministically:
 * - high: coverage > maxStockDays * 1.5
 * - elevated: coverage > maxStockDays
 * - normal: coverage <= maxStockDays
 * - unknown: velocity is null
 */
export function evaluateOverstockRisk(params: {
  availableStock: number;
  dailyVelocity: number | null;
  maxStockDays?: number;
  unitCost?: number | null;
  currency?: string;
}): {
  state: OverstockRiskState;
  excessUnits: number;
  tiedUpCapital: number | null;
  currency: string;
  explanation: string;
} {
  const stock = Math.max(0, Number(params.availableStock) || 0);
  const maxDays = Math.max(1, Number(params.maxStockDays) || 60);
  const currency = params.currency || "MAD";

  if (params.dailyVelocity === null || params.dailyVelocity <= 0) {
    if (stock > 0) {
      const tiedUp =
        params.unitCost !== null && params.unitCost !== undefined && params.unitCost > 0
          ? Number((stock * params.unitCost).toFixed(2))
          : null;
      return {
        state: "elevated",
        excessUnits: stock,
        tiedUpCapital: tiedUp,
        currency,
        explanation: `Product has ${stock} units in stock but 0 recent sales velocity. Potential dormant inventory.`,
      };
    }
    return {
      state: "normal",
      excessUnits: 0,
      tiedUpCapital: null,
      currency,
      explanation: "No stock on hand and no sales velocity.",
    };
  }

  const normalStockUnits = Math.ceil(params.dailyVelocity * maxDays);
  const excessUnits = Math.max(0, stock - normalStockUnits);
  const coverage = calculateCoverageDays(stock, params.dailyVelocity) ?? 0;

  const tiedUpCapital =
    excessUnits > 0 &&
    params.unitCost !== null &&
    params.unitCost !== undefined &&
    params.unitCost > 0
      ? Number((excessUnits * params.unitCost).toFixed(2))
      : null;

  if (coverage > maxDays * 1.5) {
    return {
      state: "high",
      excessUnits,
      tiedUpCapital,
      currency,
      explanation: `Coverage (${coverage} days) exceeds 1.5x max stock policy (${maxDays} days). ${excessUnits} excess units.`,
    };
  }

  if (coverage > maxDays) {
    return {
      state: "elevated",
      excessUnits,
      tiedUpCapital,
      currency,
      explanation: `Coverage (${coverage} days) exceeds max stock policy (${maxDays} days). ${excessUnits} excess units.`,
    };
  }

  return {
    state: "normal",
    excessUnits: 0,
    tiedUpCapital: null,
    currency,
    explanation: `Stock coverage (${coverage} days) is within target policy threshold (${maxDays} days).`,
  };
}

export interface ReorderRecommendation {
  productId: string;
  productName: string;
  sku: string | null;
  state: ReorderState;
  suggestedQuantity: number;
  estimatedCost: number | null;
  currency: string;
  leadTimeDays: number;
  coverageDays: number | null;
  reason: string;
  primarySupplierId: string | null;
}

/**
 * Builds deterministic reorder recommendations.
 * Incorporates MOQ, safety stock, lead time demand, and policy min/max days.
 */
export function buildReorderRecommendation(params: {
  product: {
    id: string;
    name: string;
    sku?: string | null;
    unit_cost?: number | null;
    currency?: string;
  };
  availableStock: number;
  dailyVelocity: number | null;
  leadTimeDays: number;
  minStockDays?: number;
  maxStockDays?: number;
  safetyStockUnits?: number;
  moq?: number;
  primarySupplierId?: string | null;
}): ReorderRecommendation {
  const stock = Math.max(0, Number(params.availableStock) || 0);
  const leadTime = Math.max(1, Number(params.leadTimeDays) || 7);
  const minDays = Math.max(leadTime, Number(params.minStockDays) || leadTime + 7);
  const maxDays = Math.max(minDays + 7, Number(params.maxStockDays) || 60);
  const safety = Math.max(0, Number(params.safetyStockUnits) || 0);
  const moq = Math.max(1, Number(params.moq) || 1);
  const currency = params.product.currency || "MAD";

  if (params.dailyVelocity === null) {
    return {
      productId: params.product.id,
      productName: params.product.name,
      sku: params.product.sku ?? null,
      state: "insufficient_data",
      suggestedQuantity: 0,
      estimatedCost: null,
      currency,
      leadTimeDays: leadTime,
      coverageDays: null,
      reason: "No sales velocity data to compute reorder requirements.",
      primarySupplierId: params.primarySupplierId ?? null,
    };
  }

  if (params.dailyVelocity <= 0) {
    return {
      productId: params.product.id,
      productName: params.product.name,
      sku: params.product.sku ?? null,
      state: "pause_replenishment",
      suggestedQuantity: 0,
      estimatedCost: null,
      currency,
      leadTimeDays: leadTime,
      coverageDays: null,
      reason: "Zero sales velocity detected. Replenishment paused to prevent dead stock.",
      primarySupplierId: params.primarySupplierId ?? null,
    };
  }

  const coverage = calculateCoverageDays(stock, params.dailyVelocity);
  const reorderPointUnits = Math.ceil(params.dailyVelocity * minDays + safety);
  const targetStockUnits = Math.ceil(params.dailyVelocity * maxDays + safety);

  if (stock <= reorderPointUnits) {
    const rawDeficit = Math.max(0, targetStockUnits - stock);
    // Round up to MOQ
    const suggestedQuantity = Math.max(moq, Math.ceil(rawDeficit / moq) * moq);
    const unitCost = params.product.unit_cost;
    const estimatedCost =
      unitCost !== null && unitCost !== undefined && unitCost > 0
        ? Number((suggestedQuantity * unitCost).toFixed(2))
        : null;

    const isUrgent = stock <= Math.ceil(params.dailyVelocity * leadTime);
    return {
      productId: params.product.id,
      productName: params.product.name,
      sku: params.product.sku ?? null,
      state: isUrgent ? "reorder_now" : "review_soon",
      suggestedQuantity,
      estimatedCost,
      currency,
      leadTimeDays: leadTime,
      coverageDays: coverage,
      reason: isUrgent
        ? `Stock (${stock}) is at or below lead time consumption (${Math.ceil(params.dailyVelocity * leadTime)} units). Urgent reorder.`
        : `Stock (${stock}) has breached minimum reorder point (${reorderPointUnits} units). Order to restore max target.`,
      primarySupplierId: params.primarySupplierId ?? null,
    };
  }

  return {
    productId: params.product.id,
    productName: params.product.name,
    sku: params.product.sku ?? null,
    state: "sufficient_stock",
    suggestedQuantity: 0,
    estimatedCost: null,
    currency,
    leadTimeDays: leadTime,
    coverageDays: coverage,
    reason: `Stock (${stock} units / ${coverage} days) is above reorder point (${reorderPointUnits} units).`,
    primarySupplierId: params.primarySupplierId ?? null,
  };
}

/**
 * Identifies slow-moving or dormant stock items.
 */
export function detectSlowMovingStock(params: {
  products: Array<{
    id: string;
    name: string;
    sku?: string | null;
    availableStock: number;
    dailyVelocity: number | null;
    unit_cost?: number | null;
    currency?: string;
    lastSoldAt?: string | null;
  }>;
  dormantThresholdDays?: number;
}): Array<{
  productId: string;
  productName: string;
  sku: string | null;
  availableStock: number;
  dailyVelocity: number | null;
  daysDormant: number | null;
  tiedUpCapital: number | null;
  currency: string;
  severity: "dormant" | "very_slow" | "slow";
  recommendation: string;
}> {
  const threshold = params.dormantThresholdDays || 45;
  const results = [];
  const now = Date.now();

  for (const p of params.products) {
    if (p.availableStock <= 0) continue;

    let daysSinceSale: number | null = null;
    if (p.lastSoldAt) {
      const soldTime = new Date(p.lastSoldAt).getTime();
      if (!Number.isNaN(soldTime)) {
        daysSinceSale = Math.max(0, Math.floor((now - soldTime) / 86400000));
      }
    }

    const velocity = p.dailyVelocity ?? 0;
    const tiedUp =
      p.unit_cost !== null && p.unit_cost !== undefined && p.unit_cost > 0
        ? Number((p.availableStock * p.unit_cost).toFixed(2))
        : null;

    const currency = p.currency || "MAD";

    if (velocity === 0 || (daysSinceSale !== null && daysSinceSale >= threshold)) {
      results.push({
        productId: p.id,
        productName: p.name,
        sku: p.sku ?? null,
        availableStock: p.availableStock,
        dailyVelocity: p.dailyVelocity,
        daysDormant: daysSinceSale,
        tiedUpCapital: tiedUp,
        currency,
        severity: "dormant" as const,
        recommendation: "Evaluate clearance, bundling, or supplier return. Zero recent movement.",
      });
    } else if (velocity > 0 && velocity < 0.1) {
      results.push({
        productId: p.id,
        productName: p.name,
        sku: p.sku ?? null,
        availableStock: p.availableStock,
        dailyVelocity: p.dailyVelocity,
        daysDormant: daysSinceSale,
        tiedUpCapital: tiedUp,
        currency,
        severity: "very_slow" as const,
        recommendation: "Run promotional campaign or reduce replenishment targets.",
      });
    } else if (velocity > 0 && velocity < 0.33) {
      results.push({
        productId: p.id,
        productName: p.name,
        sku: p.sku ?? null,
        availableStock: p.availableStock,
        dailyVelocity: p.dailyVelocity,
        daysDormant: daysSinceSale,
        tiedUpCapital: tiedUp,
        currency,
        severity: "slow" as const,
        recommendation: "Monitor turn rate; hold reorders until stock normalizes.",
      });
    }
  }

  return results;
}

/**
 * Evaluates Supplier Performance deterministically:
 * - on-time delivery rate
 * - fulfillment rate (received vs ordered)
 * - overall reliability state
 */
export function evaluateSupplierPerformance(params: {
  supplier: {
    id: string;
    name: string;
    lead_time_days?: number | null;
  };
  orders: Array<{
    id: string;
    status: string;
    ordered_at?: string | null;
    received_at?: string | null;
    expected_at?: string | null;
    created_at: string;
  }>;
  orderItems: Array<{
    supplier_order_id: string;
    quantity: number | string;
    quantity_received?: number | string | null;
  }>;
  qualityIncidentsCount?: number;
}): {
  state: SupplierReliabilityState;
  totalOrders: number;
  completedOrders: number;
  onTimeOrders: number;
  onTimeRate: number | null;
  fillRate: number | null;
  averageLeadTimeDays: number | null;
  incidentsCount: number;
  explanation: string;
} {
  const totalOrders = params.orders.length;
  if (totalOrders === 0) {
    return {
      state: "insufficient_history",
      totalOrders: 0,
      completedOrders: 0,
      onTimeOrders: 0,
      onTimeRate: null,
      fillRate: null,
      averageLeadTimeDays: null,
      incidentsCount: params.qualityIncidentsCount ?? 0,
      explanation: "No purchase order history for this supplier.",
    };
  }

  const completed = params.orders.filter(
    (o) => o.status === "received" || o.status === "partially_received"
  );
  let onTimeCount = 0;
  const leadTimes: number[] = [];

  for (const o of completed) {
    if (o.received_at && o.expected_at) {
      const receivedTime = new Date(o.received_at).getTime();
      const expectedTime = new Date(o.expected_at).getTime();
      if (!Number.isNaN(receivedTime) && !Number.isNaN(expectedTime)) {
        if (receivedTime <= expectedTime + 86400000) {
          // 1 day grace
          onTimeCount++;
        }
      }
    } else if (o.received_at && o.ordered_at) {
      // Compare with nominal lead time if expected_at wasn't specified
      const nominalLead = params.supplier.lead_time_days ?? 7;
      const actualDays = Math.max(
        0,
        (new Date(o.received_at).getTime() - new Date(o.ordered_at).getTime()) /
          86400000
      );
      leadTimes.push(actualDays);
      if (actualDays <= nominalLead * 1.25) {
        onTimeCount++;
      }
    }
  }

  let totalQtyOrdered = 0;
  let totalQtyReceived = 0;

  for (const item of params.orderItems) {
    const ordered = Number(item.quantity) || 0;
    const received = Number(item.quantity_received) || 0;
    totalQtyOrdered += ordered;
    totalQtyReceived += received;
  }

  const fillRate =
    totalQtyOrdered > 0
      ? Number(((totalQtyReceived / totalQtyOrdered) * 100).toFixed(1))
      : null;

  const onTimeRate =
    completed.length > 0
      ? Number(((onTimeCount / completed.length) * 100).toFixed(1))
      : null;

  const avgLeadTime =
    leadTimes.length > 0
      ? Number(
          (
            leadTimes.reduce((s, d) => s + d, 0) / leadTimes.length
          ).toFixed(1)
        )
      : (params.supplier.lead_time_days ?? null);

  const incidents = params.qualityIncidentsCount ?? 0;

  let state: SupplierReliabilityState = "reliable";
  if (completed.length < 2) {
    state = "insufficient_history";
  } else if ((onTimeRate !== null && onTimeRate < 70) || (fillRate !== null && fillRate < 80) || incidents >= 3) {
    state = "unreliable";
  } else if ((onTimeRate !== null && onTimeRate < 85) || (fillRate !== null && fillRate < 92) || incidents >= 1) {
    state = "watch";
  }

  return {
    state,
    totalOrders,
    completedOrders: completed.length,
    onTimeOrders: onTimeCount,
    onTimeRate,
    fillRate,
    averageLeadTimeDays: avgLeadTime,
    incidentsCount: incidents,
    explanation: `Evaluated across ${totalOrders} order(s). On-time rate: ${onTimeRate ?? "N/A"}%, Fill rate: ${fillRate ?? "N/A"}%.`,
  };
}

/**
 * Evaluates Purchase Order Health deterministically.
 */
export function evaluatePurchaseOrderHealth(
  order: {
    id: string;
    status: string;
    ordered_at?: string | null;
    expected_at?: string | null;
    received_at?: string | null;
    created_at: string;
  },
  items?: Array<{
    quantity: number | string;
    quantity_received?: number | string | null;
  }>
): {
  state: PurchaseOrderHealthState;
  isLate: boolean;
  daysOverdue: number;
  itemsCompletionRate: number;
  explanation: string;
} {
  if (order.status === "received") {
    return {
      state: "completed",
      isLate: false,
      daysOverdue: 0,
      itemsCompletionRate: 100,
      explanation: "Order is fully received.",
    };
  }

  if (order.status === "canceled") {
    return {
      state: "canceled",
      isLate: false,
      daysOverdue: 0,
      itemsCompletionRate: 0,
      explanation: "Order was canceled.",
    };
  }

  let totalOrdered = 0;
  let totalReceived = 0;
  if (items && items.length > 0) {
    for (const it of items) {
      totalOrdered += Number(it.quantity) || 0;
      totalReceived += Number(it.quantity_received) || 0;
    }
  }

  const completionRate =
    totalOrdered > 0
      ? Math.min(100, Number(((totalReceived / totalOrdered) * 100).toFixed(1)))
      : order.status === "partially_received"
      ? 50
      : 0;

  const now = Date.now();
  let daysOverdue = 0;
  let isLate = false;

  if (order.expected_at) {
    const exp = new Date(order.expected_at).getTime();
    if (!Number.isNaN(exp) && now > exp) {
      daysOverdue = Math.max(1, Math.floor((now - exp) / 86400000));
      isLate = true;
    }
  }

  if (isLate) {
    return {
      state: "late",
      isLate: true,
      daysOverdue,
      itemsCompletionRate: completionRate,
      explanation: `Order is ${daysOverdue} days overdue against expected delivery.`,
    };
  }

  if (order.status === "partially_received") {
    return {
      state: "partial",
      isLate: false,
      daysOverdue: 0,
      itemsCompletionRate: completionRate,
      explanation: `Partially received (${completionRate}% fulfilled). Awaiting remaining units.`,
    };
  }

  if (order.status === "ordered") {
    return {
      state: "on_track",
      isLate: false,
      daysOverdue: 0,
      itemsCompletionRate: completionRate,
      explanation: "Order placed and on track.",
    };
  }

  return {
    state: "needs_attention",
    isLate: false,
    daysOverdue: 0,
    itemsCompletionRate: 0,
    explanation: "Draft or pending purchase order requiring confirmation.",
  };
}

/**
 * Evaluates Product Momentum deterministically.
 */
export function evaluateProductMomentum(
  recentSales: number,
  priorSales: number
): {
  state: ProductMomentumState;
  changeRate: number | null;
  explanation: string;
} {
  const recent = Math.max(0, Number(recentSales) || 0);
  const prior = Math.max(0, Number(priorSales) || 0);

  if (prior === 0 && recent === 0) {
    return {
      state: "insufficient_history",
      changeRate: null,
      explanation: "No sales activity in comparison windows.",
    };
  }

  if (prior === 0) {
    return {
      state: "growing",
      changeRate: 100,
      explanation: `New demand: ${recent} units sold vs 0 in prior window.`,
    };
  }

  const change = ((recent - prior) / prior) * 100;
  const rounded = Number(change.toFixed(1));

  if (rounded >= 20) {
    return {
      state: "growing",
      changeRate: rounded,
      explanation: `Sales grew by +${rounded}% compared to prior window.`,
    };
  }

  if (rounded <= -20) {
    return {
      state: "declining",
      changeRate: rounded,
      explanation: `Sales declined by ${rounded}% compared to prior window.`,
    };
  }

  return {
    state: "stable",
    changeRate: rounded,
    explanation: `Sales velocity is steady (${rounded >= 0 ? "+" : ""}${rounded}% change).`,
  };
}

export interface CommerceRiskItem {
  id: string;
  type: "stockout" | "overstock" | "late_order" | "discrepancy" | "unreliable_supplier" | "cost_missing";
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  entityType: "product" | "supplier" | "supplier_order" | "discrepancy";
  entityId: string;
  recommendedAction: string;
  metadata?: Record<string, unknown>;
}

/**
 * Deterministically constructs and ranks all active commerce risks.
 */
export function buildCommerceRisks(params: {
  stockoutItems: ReorderRecommendation[];
  overstockItems: Array<{
    productId: string;
    productName: string;
    excessUnits: number;
    tiedUpCapital: number | null;
    currency: string;
  }>;
  supplierOrders: Array<{
    id: string;
    reference?: string | null;
    health: { state: PurchaseOrderHealthState; isLate: boolean; daysOverdue: number };
  }>;
  discrepancies: Array<{
    id: string;
    productName: string;
    discrepancyUnits: number;
    costImpact: number | null;
    currency: string;
    status: string;
  }>;
  missingCostCount?: number;
}): CommerceRiskItem[] {
  const risks: CommerceRiskItem[] = [];

  // 1. Stockout risks
  for (const item of params.stockoutItems) {
    if (item.state === "reorder_now") {
      risks.push({
        id: `stockout-${item.productId}`,
        type: "stockout",
        severity: item.coverageDays !== null && item.coverageDays <= 2 ? "critical" : "high",
        title: `Critical Stockout Risk: ${item.productName}`,
        description: item.reason,
        entityType: "product",
        entityId: item.productId,
        recommendedAction: `Reorder ${item.suggestedQuantity} units from primary supplier immediately.`,
        metadata: {
          coverageDays: item.coverageDays,
          suggestedQuantity: item.suggestedQuantity,
        },
      });
    } else if (item.state === "review_soon") {
      risks.push({
        id: `reorder-${item.productId}`,
        type: "stockout",
        severity: "medium",
        title: `Replenishment Due: ${item.productName}`,
        description: item.reason,
        entityType: "product",
        entityId: item.productId,
        recommendedAction: `Review replenishment schedule; prepare purchase order for ${item.suggestedQuantity} units.`,
        metadata: {
          coverageDays: item.coverageDays,
          suggestedQuantity: item.suggestedQuantity,
        },
      });
    }
  }

  // 2. Late Purchase Orders
  for (const po of params.supplierOrders) {
    if (po.health.state === "late") {
      risks.push({
        id: `late-po-${po.id}`,
        type: "late_order",
        severity: po.health.daysOverdue >= 7 ? "critical" : "high",
        title: `Late Purchase Order: ${po.reference || po.id.slice(0, 8)}`,
        description: `Order is ${po.health.daysOverdue} days past expected delivery date.`,
        entityType: "supplier_order",
        entityId: po.id,
        recommendedAction: "Contact supplier for expedited tracking or revise inbound schedule.",
        metadata: {
          daysOverdue: po.health.daysOverdue,
        },
      });
    }
  }

  // 3. Open Discrepancies
  for (const disc of params.discrepancies) {
    if (disc.status === "investigating" || disc.status === "verified") {
      risks.push({
        id: `discrepancy-${disc.id}`,
        type: "discrepancy",
        severity: Math.abs(disc.discrepancyUnits) >= 10 || (disc.costImpact && Math.abs(disc.costImpact) > 500) ? "high" : "medium",
        title: `Inventory Discrepancy: ${disc.productName}`,
        description: `Variance of ${disc.discrepancyUnits > 0 ? "+" : ""}${disc.discrepancyUnits} units (${disc.costImpact !== null ? `${disc.costImpact} ${disc.currency}` : "Cost unknown"}).`,
        entityType: "discrepancy",
        entityId: disc.id,
        recommendedAction: "Perform cycle count and record adjustment or resolution.",
        metadata: {
          units: disc.discrepancyUnits,
          costImpact: disc.costImpact,
        },
      });
    }
  }

  // 4. Overstock Risks
  for (const over of params.overstockItems) {
    risks.push({
      id: `overstock-${over.productId}`,
      type: "overstock",
      severity: over.tiedUpCapital && over.tiedUpCapital > 5000 ? "high" : "low",
      title: `Excess Inventory: ${over.productName}`,
      description: `${over.excessUnits} units exceeding target ceiling (${over.tiedUpCapital !== null ? `${over.tiedUpCapital} ${over.currency} tied up` : "cost unrecorded"}).`,
      entityType: "product",
      entityId: over.productId,
      recommendedAction: "Review promotional discount, bundle, or pause upcoming purchase orders.",
      metadata: {
        excessUnits: over.excessUnits,
        tiedUpCapital: over.tiedUpCapital,
      },
    });
  }

  // 5. Missing Costs
  if (params.missingCostCount && params.missingCostCount > 0) {
    risks.push({
      id: "missing-costs",
      type: "cost_missing",
      severity: "low",
      title: `${params.missingCostCount} Products Missing Unit Cost`,
      description: "Gross margins and tied-up capital cannot be calculated accurately.",
      entityType: "product",
      entityId: "catalog",
      recommendedAction: "Update unit costs in product catalog to unlock full margin intelligence.",
    });
  }

  // Severity sort: critical -> high -> medium -> low
  const rank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  return risks.sort((a, b) => (rank[b.severity] || 0) - (rank[a.severity] || 0));
}

/**
 * Deterministically ranks the single next best commerce action move.
 */
export function rankNextCommerceMove(risks: CommerceRiskItem[]): {
  headline: string;
  action: string;
  urgency: "critical" | "high" | "normal";
  targetRoute: string;
} {
  if (risks.length === 0) {
    return {
      headline: "Commerce Operations Healthy",
      action: "All inventory thresholds and supplier deliveries are on schedule.",
      urgency: "normal",
      targetRoute: "/commerce",
    };
  }

  const top = risks[0];
  if (top.severity === "critical") {
    return {
      headline: top.title,
      action: top.recommendedAction,
      urgency: "critical",
      targetRoute:
        top.type === "stockout"
          ? "/commerce/replenishment"
          : top.type === "late_order"
          ? "/commerce/purchasing"
          : "/commerce/risks",
    };
  }

  if (top.severity === "high") {
    return {
      headline: top.title,
      action: top.recommendedAction,
      urgency: "high",
      targetRoute:
        top.type === "stockout"
          ? "/commerce/replenishment"
          : top.type === "discrepancy"
          ? "/commerce/audits"
          : "/commerce/risks",
    };
  }

  return {
    headline: top.title,
    action: top.recommendedAction,
    urgency: "normal",
    targetRoute: "/commerce",
  };
}

/**
 * Summarizes commerce metrics with separated currency buckets.
 */
export function buildCommerceReview(params: {
  products: Array<{
    id: string;
    currency?: string;
    availableStock?: number;
    unit_cost?: number | null;
    totalSold30d?: number;
    selling_price?: number | null;
  }>;
  supplierOrders?: Array<unknown>;
  slowStockCount?: number;
  activeRisksCount?: number;
}): {
  currencyBuckets: Record<string, { inventoryValue: number; sales30d: number; orderCount: number }>;
  productsCount: number;
  slowStockCount: number;
  activeRisksCount: number;
} {
  const currencyBuckets: Record<string, { inventoryValue: number; sales30d: number; orderCount: number }> = {};
  for (const p of params.products) {
    const curr = p.currency || "MAD";
    if (!currencyBuckets[curr]) {
      currencyBuckets[curr] = { inventoryValue: 0, sales30d: 0, orderCount: 0 };
    }
    const stock = Number(p.availableStock) || 0;
    const cost = Number(p.unit_cost) || 0;
    const sold = Number(p.totalSold30d) || 0;
    const price = Number(p.selling_price) || 0;

    currencyBuckets[curr].inventoryValue += Number((stock * cost).toFixed(2));
    currencyBuckets[curr].sales30d += Number((sold * price).toFixed(2));
  }

  return {
    currencyBuckets,
    productsCount: params.products.length,
    slowStockCount: params.slowStockCount ?? 0,
    activeRisksCount: params.activeRisksCount ?? 0,
  };
}

/**
 * Helper to ensure foreign entity ownership across user and active company.
 */
export async function validateForeignOwnership(
  supabase: SupabaseClient,
  userId: string,
  companyId: string,
  checks: {
    productId?: string;
    supplierId?: string;
    supplierOrderId?: string;
    auditId?: string;
  }
): Promise<{ valid: boolean; error?: string }> {
  if (checks.productId) {
    const { data } = await supabase
      .from("product_catalog_refs")
      .select("id")
      .eq("id", checks.productId)
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!data) return { valid: false, error: "Product does not belong to your active company." };
  }

  if (checks.supplierId) {
    const { data } = await supabase
      .from("supplier_records")
      .select("id")
      .eq("id", checks.supplierId)
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!data) return { valid: false, error: "Supplier does not belong to your active company." };
  }

  if (checks.supplierOrderId) {
    const { data } = await supabase
      .from("supplier_orders")
      .select("id")
      .eq("id", checks.supplierOrderId)
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!data) return { valid: false, error: "Supplier order does not belong to your active company." };
  }

  if (checks.auditId) {
    const { data } = await supabase
      .from("inventory_audits")
      .select("id")
      .eq("id", checks.auditId)
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!data) return { valid: false, error: "Inventory audit does not belong to your active company." };
  }

  return { valid: true };
}

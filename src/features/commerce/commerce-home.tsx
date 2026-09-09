"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icons } from "@/components/icons";
import type { CommerceRiskItem } from "@/lib/commerce";

interface OverviewState {
  configured: boolean;
  currencyBuckets: Record<string, { inventoryValue: number; sales30d: number; orderCount: number }>;
  productsCount: number;
  suppliersCount: number;
  metrics: {
    reorderNowCount: number;
    reviewSoonCount: number;
    slowStockCount: number;
    lateOrdersCount: number;
    openDiscrepanciesCount: number;
    missingCostCount: number;
  };
  activeRisks: CommerceRiskItem[];
  nextMove: {
    headline: string;
    action: string;
    urgency: "critical" | "high" | "normal";
    targetRoute: string;
  } | null;
}

export function CommerceHome() {
  const [data, setData] = useState<OverviewState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/commerce/overview");
        if (!res.ok) throw new Error("Failed to load commerce overview.");
        const json = await res.json();
        if (active) setData(json);
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : "Could not load commerce command center.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground text-sm">
          <Icons.Clock3 className="h-5 w-5 animate-spin" />
          <span>Loading Commerce Command Center...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-destructive">
        <p className="font-semibold text-base">Commerce Unavailable</p>
        <p className="mt-1 text-sm">{error || "Failed to load commerce data."}</p>
      </div>
    );
  }

  if (!data.configured) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
        <Icons.BriefcaseBusiness className="mx-auto h-12 w-12 text-muted-foreground" />
        <h2 className="mt-4 font-semibold text-lg">Active Company Required</h2>
        <p className="mt-2 text-muted-foreground text-sm max-w-md mx-auto">
          Commerce, inventory, and supplier operations are scoped to your company context. Configure your active company in Founder settings to begin.
        </p>
        <Link
          href="/founder"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:opacity-90 transition-opacity"
        >
          Go to Founder Settings
        </Link>
      </div>
    );
  }

  const { metrics, nextMove, activeRisks, currencyBuckets } = data;

  return (
    <div className="space-y-8">
      {/* Top Banner / Next Move */}
      {nextMove && (
        <div
          className={`relative overflow-hidden rounded-2xl border p-6 shadow-sm transition-all ${
            nextMove.urgency === "critical"
              ? "border-red-500/40 bg-red-500/5 text-red-950 dark:text-red-100"
              : nextMove.urgency === "high"
              ? "border-amber-500/40 bg-amber-500/5 text-amber-950 dark:text-amber-100"
              : "border-primary/20 bg-primary/5 text-foreground"
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                    nextMove.urgency === "critical"
                      ? "bg-red-500/20 text-red-700 dark:text-red-300"
                      : nextMove.urgency === "high"
                      ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                      : "bg-primary/20 text-primary"
                  }`}
                >
                  Priority Commerce Action
                </span>
              </div>
              <h2 className="text-xl font-bold tracking-tight">{nextMove.headline}</h2>
              <p className="text-sm opacity-90">{nextMove.action}</p>
            </div>
            <Link
              href={nextMove.targetRoute}
              className="inline-flex items-center gap-2 self-start sm:self-center px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
            >
              Resolve Action
              <Icons.ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Multi-Currency Value Cards */}
      <div>
        <h3 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase mb-3">
          Inventory Value & Revenue (Separated by Currency)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.keys(currencyBuckets).length === 0 ? (
            <div className="col-span-full rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              No inventory or order currency data recorded yet.
            </div>
          ) : (
            Object.entries(currencyBuckets).map(([currency, bucket]) => (
              <div key={currency} className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground tracking-wider uppercase">
                    Currency: {currency}
                  </span>
                  <Icons.CircleDollarSign className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Inventory Asset Value</div>
                  <div className="text-2xl font-bold tracking-tight">
                    {bucket.inventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}
                  </div>
                </div>
                <div className="pt-2 border-t border-border/50 flex justify-between text-xs text-muted-foreground">
                  <span>30d Sales: {bucket.sales30d.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}</span>
                  <span>{bucket.orderCount} order(s)</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Core Operational Health Indicators */}
      <div>
        <h3 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase mb-3">
          Operational Attention Matrix
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Link
            href="/commerce/replenishment"
            className={`rounded-xl border p-4 transition-all hover:border-primary/50 hover:shadow-sm ${
              metrics.reorderNowCount > 0 ? "border-red-500/40 bg-red-500/5" : "border-border bg-card"
            }`}
          >
            <div className="text-xs text-muted-foreground font-medium">Reorder Now</div>
            <div className={`text-2xl font-bold mt-1 ${metrics.reorderNowCount > 0 ? "text-red-600 dark:text-red-400" : ""}`}>
              {metrics.reorderNowCount}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">Products urgent</div>
          </Link>

          <Link
            href="/commerce/replenishment"
            className={`rounded-xl border p-4 transition-all hover:border-primary/50 hover:shadow-sm ${
              metrics.reviewSoonCount > 0 ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-card"
            }`}
          >
            <div className="text-xs text-muted-foreground font-medium">Review Soon</div>
            <div className={`text-2xl font-bold mt-1 ${metrics.reviewSoonCount > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>
              {metrics.reviewSoonCount}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">Below safety target</div>
          </Link>

          <Link
            href="/commerce/slow-stock"
            className="rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-sm"
          >
            <div className="text-xs text-muted-foreground font-medium">Slow / Dormant</div>
            <div className="text-2xl font-bold mt-1">{metrics.slowStockCount}</div>
            <div className="text-[11px] text-muted-foreground mt-1">Capital at risk</div>
          </Link>

          <Link
            href="/commerce/purchase-review"
            className={`rounded-xl border p-4 transition-all hover:border-primary/50 hover:shadow-sm ${
              metrics.lateOrdersCount > 0 ? "border-red-500/40 bg-red-500/5" : "border-border bg-card"
            }`}
          >
            <div className="text-xs text-muted-foreground font-medium">Late Supplier POs</div>
            <div className={`text-2xl font-bold mt-1 ${metrics.lateOrdersCount > 0 ? "text-red-600 dark:text-red-400" : ""}`}>
              {metrics.lateOrdersCount}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">Overdue deliveries</div>
          </Link>

          <Link
            href="/commerce/audits"
            className={`rounded-xl border p-4 transition-all hover:border-primary/50 hover:shadow-sm ${
              metrics.openDiscrepanciesCount > 0 ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-card"
            }`}
          >
            <div className="text-xs text-muted-foreground font-medium">Discrepancies</div>
            <div className={`text-2xl font-bold mt-1 ${metrics.openDiscrepanciesCount > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>
              {metrics.openDiscrepanciesCount}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">Open count variances</div>
          </Link>

          <Link
            href="/commerce/products"
            className={`rounded-xl border p-4 transition-all hover:border-primary/50 hover:shadow-sm ${
              metrics.missingCostCount > 0 ? "border-amber-500/30 bg-amber-500/5" : "border-border bg-card"
            }`}
          >
            <div className="text-xs text-muted-foreground font-medium">Missing Costs</div>
            <div className={`text-2xl font-bold mt-1 ${metrics.missingCostCount > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>
              {metrics.missingCostCount}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">Products need cost</div>
          </Link>
        </div>
      </div>

      {/* Ranked Commerce Risks */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
            Top Ranked Commerce Risks ({activeRisks.length})
          </h3>
          <Link href="/commerce/risks" className="text-xs text-primary font-medium hover:underline">
            View All Risks &rarr;
          </Link>
        </div>
        <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
          {activeRisks.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No active commerce risks detected. Stock coverage, suppliers, and discrepancies are clean.
            </div>
          ) : (
            activeRisks.slice(0, 6).map((risk) => (
              <div key={risk.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/40 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        risk.severity === "critical"
                          ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30"
                          : risk.severity === "high"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                          : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30"
                      }`}
                    >
                      {risk.severity}
                    </span>
                    <h4 className="font-semibold text-sm">{risk.title}</h4>
                  </div>
                  <p className="text-xs text-muted-foreground">{risk.description}</p>
                </div>
                <div className="text-xs text-right sm:max-w-xs text-muted-foreground font-medium">
                  {risk.recommendedAction}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Sub-surfaces Directory */}
      <div>
        <h3 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase mb-3">
          Commerce Operating Modules
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <Link
            href="/commerce/inventory"
            className="group rounded-xl border border-border bg-card p-5 hover:border-primary/50 hover:shadow-md transition-all space-y-2"
          >
            <div className="flex items-center justify-between">
              <Icons.Package className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
              <span className="text-xs text-muted-foreground font-mono">/inventory</span>
            </div>
            <h4 className="font-bold text-sm">Inventory & Coverage</h4>
            <p className="text-xs text-muted-foreground">
              Stock on hand, reserved stock, lead time coverage days, and inventory policies.
            </p>
          </Link>

          <Link
            href="/commerce/replenishment"
            className="group rounded-xl border border-border bg-card p-5 hover:border-primary/50 hover:shadow-md transition-all space-y-2"
          >
            <div className="flex items-center justify-between">
              <Icons.Zap className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
              <span className="text-xs text-muted-foreground font-mono">/replenishment</span>
            </div>
            <h4 className="font-bold text-sm">Replenishment</h4>
            <p className="text-xs text-muted-foreground">
              Deterministic reorder recommendations, MOQ alignment, and safety stock targets.
            </p>
          </Link>

          <Link
            href="/commerce/slow-stock"
            className="group rounded-xl border border-border bg-card p-5 hover:border-primary/50 hover:shadow-md transition-all space-y-2"
          >
            <div className="flex items-center justify-between">
              <Icons.Clock3 className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
              <span className="text-xs text-muted-foreground font-mono">/slow-stock</span>
            </div>
            <h4 className="font-bold text-sm">Slow-Moving Stock</h4>
            <p className="text-xs text-muted-foreground">
              Dormant items, excess units, tied-up capital, and clearance suggestions.
            </p>
          </Link>

          <Link
            href="/commerce/products"
            className="group rounded-xl border border-border bg-card p-5 hover:border-primary/50 hover:shadow-md transition-all space-y-2"
          >
            <div className="flex items-center justify-between">
              <Icons.TrendingUp className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
              <span className="text-xs text-muted-foreground font-mono">/products</span>
            </div>
            <h4 className="font-bold text-sm">Product Performance</h4>
            <p className="text-xs text-muted-foreground">
              Sales velocity, momentum trends, gross contribution margins, and catalog editing.
            </p>
          </Link>

          <Link
            href="/commerce/brands"
            className="group rounded-xl border border-border bg-card p-5 hover:border-primary/50 hover:shadow-md transition-all space-y-2"
          >
            <div className="flex items-center justify-between">
              <Icons.Sparkles className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
              <span className="text-xs text-muted-foreground font-mono">/brands</span>
            </div>
            <h4 className="font-bold text-sm">Brand Performance</h4>
            <p className="text-xs text-muted-foreground">
              Cross-product aggregation by brand name with separated currency revenue and stock health.
            </p>
          </Link>

          <Link
            href="/commerce/categories"
            className="group rounded-xl border border-border bg-card p-5 hover:border-primary/50 hover:shadow-md transition-all space-y-2"
          >
            <div className="flex items-center justify-between">
              <Icons.Archive className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
              <span className="text-xs text-muted-foreground font-mono">/categories</span>
            </div>
            <h4 className="font-bold text-sm">Category Performance</h4>
            <p className="text-xs text-muted-foreground">
              Product catalog categorization, revenue contribution, and category-level stockout alerts.
            </p>
          </Link>

          <Link
            href="/commerce/suppliers"
            className="group rounded-xl border border-border bg-card p-5 hover:border-primary/50 hover:shadow-md transition-all space-y-2"
          >
            <div className="flex items-center justify-between">
              <Icons.Truck className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
              <span className="text-xs text-muted-foreground font-mono">/suppliers</span>
            </div>
            <h4 className="font-bold text-sm">Suppliers & Reliability</h4>
            <p className="text-xs text-muted-foreground">
              Supplier directory, on-time delivery rates, fulfillment fill rates, and lead times.
            </p>
          </Link>

          <Link
            href="/commerce/purchasing"
            className="group rounded-xl border border-border bg-card p-5 hover:border-primary/50 hover:shadow-md transition-all space-y-2"
          >
            <div className="flex items-center justify-between">
              <Icons.ShoppingCart className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
              <span className="text-xs text-muted-foreground font-mono">/purchasing</span>
            </div>
            <h4 className="font-bold text-sm">Purchasing (POs)</h4>
            <p className="text-xs text-muted-foreground">
              Purchase orders lifecycle, receipt tracking, and inbound expected stock.
            </p>
          </Link>

          <Link
            href="/commerce/purchase-review"
            className="group rounded-xl border border-border bg-card p-5 hover:border-primary/50 hover:shadow-md transition-all space-y-2"
          >
            <div className="flex items-center justify-between">
              <Icons.AlertTriangle className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
              <span className="text-xs text-muted-foreground font-mono">/purchase-review</span>
            </div>
            <h4 className="font-bold text-sm">Purchase Review</h4>
            <p className="text-xs text-muted-foreground">
              Triage overdue supplier orders, partial fulfillment, and delivery discrepancies.
            </p>
          </Link>

          <Link
            href="/commerce/audits"
            className="group rounded-xl border border-border bg-card p-5 hover:border-primary/50 hover:shadow-md transition-all space-y-2"
          >
            <div className="flex items-center justify-between">
              <Icons.ShieldCheck className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
              <span className="text-xs text-muted-foreground font-mono">/audits</span>
            </div>
            <h4 className="font-bold text-sm">Audits & Discrepancies</h4>
            <p className="text-xs text-muted-foreground">
              Physical cycle counts, count variance recording, and adjustment resolution.
            </p>
          </Link>

          <Link
            href="/commerce/movements"
            className="group rounded-xl border border-border bg-card p-5 hover:border-primary/50 hover:shadow-md transition-all space-y-2"
          >
            <div className="flex items-center justify-between">
              <Icons.ReceiptText className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
              <span className="text-xs text-muted-foreground font-mono">/movements</span>
            </div>
            <h4 className="font-bold text-sm">Movements Audit Trail</h4>
            <p className="text-xs text-muted-foreground">
              Immutable chronological history of all sales, receipts, and manual adjustments.
            </p>
          </Link>

          <Link
            href="/commerce/review"
            className="group rounded-xl border border-border bg-card p-5 hover:border-primary/50 hover:shadow-md transition-all space-y-2"
          >
            <div className="flex items-center justify-between">
              <Icons.BookOpen className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
              <span className="text-xs text-muted-foreground font-mono">/review</span>
            </div>
            <h4 className="font-bold text-sm">Commerce Review</h4>
            <p className="text-xs text-muted-foreground">
              Periodic operating review logs, historical snapshots, and inventory policy governance.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}

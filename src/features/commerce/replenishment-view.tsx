"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icons } from "@/components/icons";
import { ReorderBadge } from "./reorder-badge";
import type { ReorderState } from "@/lib/commerce";

interface Recommendation {
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
  supplierName: string;
  availableStock: number;
  dailyVelocity: number | null;
  unitCost?: number | null;
}

export function ReplenishmentView() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/commerce/replenishment");
        if (!res.ok) throw new Error("Failed to load replenishment queue.");
        const json = await res.json();
        if (active) setRecommendations(json.recommendations ?? []);
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load replenishment.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  const urgentCount = recommendations.filter((r) => r.state === "reorder_now").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Replenishment Intelligence Queue</h2>
          <p className="text-sm text-muted-foreground">
            Deterministic reorder points calculated from daily burn rate, supplier lead time, MOQ, and policy safety thresholds.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/commerce/purchasing"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <Icons.ShoppingCart className="h-4 w-4" />
            Create Purchase Order
          </Link>
        </div>
      </div>

      {urgentCount > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/20 text-red-600 dark:text-red-400">
              <Icons.AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-red-950 dark:text-red-100">
                {urgentCount} Product(s) Require Immediate Reorder
              </div>
              <div className="text-xs text-red-700 dark:text-red-300">
                Current stock coverage is below supplier lead time. Stockout is imminent without expedited ordering.
              </div>
            </div>
          </div>
          <Link
            href="/commerce/purchasing"
            className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors shadow-sm"
          >
            Place Urgent POs
          </Link>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center text-sm text-muted-foreground">
          <Icons.Clock3 className="h-5 w-5 animate-spin mr-2" />
          Evaluating reorder criteria...
        </div>
      ) : error ? (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      ) : recommendations.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          <Icons.Check className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
          <div className="font-semibold text-foreground">Stock Levels Sufficient</div>
          <p className="mt-1">No products currently breach minimum reorder points.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recommendations.map((rec) => (
            <div
              key={rec.productId}
              className={`rounded-xl border p-5 shadow-sm space-y-4 transition-all ${
                rec.state === "reorder_now"
                  ? "border-red-500/40 bg-red-500/5"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-base text-foreground leading-snug">{rec.productName}</h3>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {rec.sku ? `SKU: ${rec.sku}` : "No SKU"} • Supplier: {rec.supplierName}
                  </div>
                </div>
                <ReorderBadge state={rec.state} />
              </div>

              <div className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg">
                {rec.reason}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/50">
                <div>
                  <span className="text-muted-foreground">Stock on Hand:</span>
                  <div className="font-bold text-sm">{rec.availableStock} units</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Coverage Days:</span>
                  <div className="font-bold text-sm">
                    {rec.coverageDays !== null ? `${rec.coverageDays} days` : "Indeterminate"}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Suggested Order:</span>
                  <div className="font-bold text-sm text-primary">{rec.suggestedQuantity} units</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Est. Cost:</span>
                  <div className="font-bold text-sm">
                    {rec.estimatedCost !== null ? `${rec.estimatedCost} ${rec.currency}` : "Cost missing"}
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href={`/commerce/purchasing`}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                  <Icons.ShoppingCart className="h-3.5 w-3.5" />
                  Draft Purchase Order
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

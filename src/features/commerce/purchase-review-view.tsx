"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icons } from "@/components/icons";
import type { PurchaseOrderHealthState } from "@/lib/commerce";

interface ReviewOrder {
  id: string;
  reference?: string | null;
  supplier_id: string;
  status: string;
  ordered_at?: string | null;
  expected_at?: string | null;
  total_value?: number | null;
  currency: string;
  health: {
    state: PurchaseOrderHealthState;
    isLate: boolean;
    daysOverdue: number;
    itemsCompletionRate: number;
    explanation: string;
  };
  items: Array<{
    id: string;
    product_name: string;
    quantity: number;
    quantity_received?: number | null;
  }>;
}

export function PurchaseReviewView() {
  const [orders, setOrders] = useState<ReviewOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/commerce/purchase-review");
        if (!res.ok) throw new Error("Failed to load purchase review items.");
        const json = await res.json();
        if (active) setOrders(json.reviewItems ?? []);
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load purchase review.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Purchase Order Triage & Review</h2>
          <p className="text-sm text-muted-foreground">
            Active inspection for overdue shipments, partial deliveries, and stuck supplier purchase orders.
          </p>
        </div>
        <Link
          href="/commerce/purchasing"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <Icons.ShoppingCart className="h-4 w-4" />
          All Purchase Orders
        </Link>
      </div>

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center text-sm text-muted-foreground">
          <Icons.Clock3 className="h-5 w-5 animate-spin mr-2" />
          Checking supplier delivery health...
        </div>
      ) : error ? (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          <Icons.Check className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
          <div className="font-semibold text-foreground">Purchasing Flow Healthy</div>
          <p className="mt-1">No supplier orders are currently overdue or require urgent triage.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((po) => (
            <div
              key={po.id}
              className={`rounded-xl border p-5 shadow-sm space-y-3 ${
                po.health.state === "late" ? "border-red-500/40 bg-red-500/5" : "border-border bg-card"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${
                        po.health.state === "late"
                          ? "bg-red-500/20 text-red-700 dark:text-red-300"
                          : "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                      }`}
                    >
                      {po.health.state}
                    </span>
                    <h3 className="font-bold text-base text-foreground">
                      {po.reference || `PO #${po.id.slice(0, 8)}`}
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{po.health.explanation}</p>
                </div>

                <div className="text-right">
                  <div className="text-sm font-bold text-foreground">
                    {po.health.itemsCompletionRate}% Fulfilled
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {po.total_value ? `${po.total_value} ${po.currency}` : ""}
                  </div>
                </div>
              </div>

              {po.items.length > 0 && (
                <div className="text-xs border-t border-border/50 pt-2 divide-y divide-border/30">
                  {po.items.map((it) => (
                    <div key={it.id} className="py-1 flex justify-between">
                      <span>{it.product_name}</span>
                      <span className="font-mono text-muted-foreground">
                        {it.quantity_received ?? 0} / {it.quantity} received
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

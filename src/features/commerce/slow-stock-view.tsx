"use client";

import { useEffect, useState } from "react";
import { Icons } from "@/components/icons";

interface SlowStockItem {
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
}

export function SlowStockView() {
  const [items, setItems] = useState<SlowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/commerce/slow-stock");
        if (!res.ok) throw new Error("Failed to load slow-moving stock.");
        const json = await res.json();
        if (active) setItems(json.items ?? []);
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load slow-moving stock.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  const totalCapitalByCurrency = items.reduce((acc, item) => {
    if (item.tiedUpCapital) {
      acc[item.currency] = (acc[item.currency] || 0) + item.tiedUpCapital;
    }
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Slow-Moving & Dormant Stock</h2>
        <p className="text-sm text-muted-foreground">
          Identify inventory tying up operational capital with low or zero consumption velocity over 30–60 days.
        </p>
      </div>

      {Object.keys(totalCapitalByCurrency).length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Object.entries(totalCapitalByCurrency).map(([currency, total]) => (
            <div key={currency} className="rounded-xl border border-border bg-card p-4">
              <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                Tied-Up Dormant Capital ({currency})
              </span>
              <div className="text-2xl font-bold mt-1 text-foreground">
                {total.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}
              </div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center text-sm text-muted-foreground">
          <Icons.Clock3 className="h-5 w-5 animate-spin mr-2" />
          Analyzing velocity distribution...
        </div>
      ) : error ? (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          <Icons.Check className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
          <div className="font-semibold text-foreground">Healthy Inventory Turnover</div>
          <p className="mt-1">All stocked products are demonstrating active sales movement.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold">Stock on Hand</th>
                <th className="px-4 py-3 font-semibold">Dormant Duration</th>
                <th className="px-4 py-3 font-semibold">Tied-Up Capital</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Strategic Recommendation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => (
                <tr key={item.productId} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{item.productName}</div>
                    <div className="text-xs text-muted-foreground">{item.sku ? `SKU: ${item.sku}` : "No SKU"}</div>
                  </td>
                  <td className="px-4 py-3 font-bold">{item.availableStock} units</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {item.daysDormant !== null ? `${item.daysDormant} days since sale` : "No recorded sales"}
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    {item.tiedUpCapital !== null ? `${item.tiedUpCapital.toLocaleString()} ${item.currency}` : "Cost missing"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${
                        item.severity === "dormant"
                          ? "bg-red-500/10 text-red-600 dark:text-red-400"
                          : item.severity === "very_slow"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                      }`}
                    >
                      {item.severity.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs">
                    {item.recommendation}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

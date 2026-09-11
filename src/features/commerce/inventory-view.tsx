"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icons } from "@/components/icons";
import { SearchInput } from "@/components/ui/search-input";
import { StockoutBadge } from "./stockout-badge";
import type { StockoutRiskState, OverstockRiskState } from "@/lib/commerce";

interface InventoryItem {
  id: string;
  name: string;
  sku?: string | null;
  category?: string | null;
  brand?: string | null;
  availableStock: number;
  reservedStock: number;
  unitCost?: number | null;
  sellingPrice?: number | null;
  currency: string;
  dailyVelocity: number | null;
  totalSold30d: number;
  stockout: {
    state: StockoutRiskState;
    coverageDays: number | null;
    runoutDate: string | null;
    explanation: string;
  };
  overstock: {
    state: OverstockRiskState;
    excessUnits: number;
    tiedUpCapital: number | null;
    explanation: string;
  };
  leadTimeDays: number;
  policy?: {
    min_stock_days: number;
    max_stock_days: number;
    safety_stock_units: number;
  } | null;
}

export function InventoryView() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("all");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/commerce/inventory");
        if (!res.ok) throw new Error("Failed to load inventory.");
        const json = await res.json();
        if (active) setItems(json.items ?? []);
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load inventory.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  const filtered = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.sku && item.sku.toLowerCase().includes(search.toLowerCase())) ||
      (item.category && item.category.toLowerCase().includes(search.toLowerCase())) ||
      (item.brand && item.brand.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;
    if (riskFilter === "all") return true;
    if (riskFilter === "stockout") return item.stockout.state === "critical" || item.stockout.state === "high";
    if (riskFilter === "overstock") return item.overstock.state === "high" || item.overstock.state === "elevated";
    if (riskFilter === "safe") return item.stockout.state === "safe";
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Inventory & Coverage Intelligence</h2>
          <p className="text-sm text-muted-foreground">
            Real-time stock on hand, daily consumption velocity, supplier lead time coverage, and runout projections.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/commerce/replenishment"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <Icons.Zap className="h-4 w-4" />
            Replenishment Queue
          </Link>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="flex-1 w-full">
          <SearchInput
            label="Search inventory"
            containerClassName="search-control--full"
            placeholder="Search products by name, SKU, category, or brand..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch("")}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All Risk States</option>
            <option value="stockout">Stockout Risk (Critical / High)</option>
            <option value="overstock">Overstock Risk (High / Elevated)</option>
            <option value="safe">Safe Stock Coverage</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center text-sm text-muted-foreground">
          <Icons.Clock3 className="h-5 w-5 animate-spin mr-2" />
          Loading inventory intelligence...
        </div>
      ) : error ? (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No inventory products match the filter criteria.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Product</th>
                  <th className="px-4 py-3 font-semibold">Stock on Hand</th>
                  <th className="px-4 py-3 font-semibold">30d Velocity</th>
                  <th className="px-4 py-3 font-semibold">Coverage</th>
                  <th className="px-4 py-3 font-semibold">Stockout Risk</th>
                  <th className="px-4 py-3 font-semibold">Lead Time</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-foreground">{item.name}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {item.sku && <span>SKU: {item.sku}</span>}
                        {item.brand && <span>• {item.brand}</span>}
                        {item.category && <span>• {item.category}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-foreground">{item.availableStock} units</div>
                      {item.reservedStock > 0 && (
                        <div className="text-xs text-muted-foreground">{item.reservedStock} reserved</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {item.dailyVelocity !== null ? (
                        <div>
                          <div className="font-medium">{item.dailyVelocity} / day</div>
                          <div className="text-xs text-muted-foreground">{item.totalSold30d} units (30d)</div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">No sales velocity</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {item.stockout.coverageDays !== null ? (
                        <div>
                          <div className="font-semibold">{item.stockout.coverageDays} days</div>
                          {item.stockout.runoutDate && (
                            <div className="text-xs text-muted-foreground">Runout: {item.stockout.runoutDate}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Indeterminate</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StockoutBadge state={item.stockout.state} coverageDays={item.stockout.coverageDays} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.leadTimeDays} days
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/commerce/products`}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

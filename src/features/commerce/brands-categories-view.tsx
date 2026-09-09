"use client";

import { useEffect, useState } from "react";
import { Icons } from "@/components/icons";

interface GroupItem {
  name: string;
  productCount: number;
  availableStockUnits: number;
  soldUnits30d: number;
  currencyTotals: Record<string, { inventoryValue: number; salesValue30d: number }>;
  stockoutCount: number;
  overstockCount: number;
}

export function BrandsCategoriesView({ initialTab = "brands" }: { initialTab?: "brands" | "categories" }) {
  const [activeTab, setActiveTab] = useState<"brands" | "categories">(initialTab);
  const [brands, setBrands] = useState<GroupItem[]>([]);
  const [categories, setCategories] = useState<GroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [bRes, cRes] = await Promise.all([
          fetch("/api/commerce/brands"),
          fetch("/api/commerce/categories"),
        ]);
        if (!bRes.ok || !cRes.ok) throw new Error("Failed to load brands or categories.");
        const [bJson, cJson] = await Promise.all([bRes.json(), cRes.json()]);
        if (active) {
          setBrands(bJson.brands ?? []);
          setCategories(cJson.categories ?? []);
        }
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load aggregations.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  const currentList = activeTab === "brands" ? brands : categories;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Portfolio Aggregations</h2>
          <p className="text-sm text-muted-foreground">
            Evaluate performance, stock health, and sales contribution grouped by brand and category.
          </p>
        </div>

        <div className="flex rounded-lg border border-border bg-muted/40 p-1">
          <button
            onClick={() => setActiveTab("brands")}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeTab === "brands" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Brands ({brands.length})
          </button>
          <button
            onClick={() => setActiveTab("categories")}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeTab === "categories" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Categories ({categories.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center text-sm text-muted-foreground">
          <Icons.Clock3 className="h-5 w-5 animate-spin mr-2" />
          Aggregating catalog segments...
        </div>
      ) : error ? (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      ) : currentList.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          No segment data available. Assign brands and categories to your catalog products.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentList.map((group) => (
            <div key={group.name} className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base text-foreground">{group.name}</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                  {group.productCount} products
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/50">
                <div>
                  <span className="text-muted-foreground">Stock on Hand:</span>
                  <div className="font-bold text-sm">{group.availableStockUnits} units</div>
                </div>
                <div>
                  <span className="text-muted-foreground">30d Units Sold:</span>
                  <div className="font-bold text-sm">{group.soldUnits30d} units</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Stockout Risks:</span>
                  <div className={`font-bold text-sm ${group.stockoutCount > 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                    {group.stockoutCount}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Overstock Items:</span>
                  <div className={`font-bold text-sm ${group.overstockCount > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>
                    {group.overstockCount}
                  </div>
                </div>
              </div>

              {Object.keys(group.currencyTotals).length > 0 && (
                <div className="pt-2 border-t border-border/50 space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Financial Totals (Separated by Currency)
                  </span>
                  {Object.entries(group.currencyTotals).map(([curr, totals]) => (
                    <div key={curr} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{curr} Inventory:</span>
                      <span className="font-semibold">{totals.inventoryValue.toLocaleString()} {curr}</span>
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

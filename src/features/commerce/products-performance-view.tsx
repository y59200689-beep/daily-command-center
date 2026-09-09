"use client";

import { useEffect, useState } from "react";
import { Icons } from "@/components/icons";
import type { ProductMomentumState } from "@/lib/commerce";

interface ProductPerformance {
  id: string;
  name: string;
  sku?: string | null;
  category?: string | null;
  brand?: string | null;
  currency: string;
  unit_cost?: number | null;
  selling_price?: number | null;
  availableStock: number;
  dailyVelocity: number | null;
  totalSold30d: number;
  marginAmount: number | null;
  marginRate: number | null;
  momentum: {
    state: ProductMomentumState;
    changeRate: number | null;
    explanation: string;
  };
  active: boolean;
}

export function ProductsPerformanceView() {
  const [products, setProducts] = useState<ProductPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    category: "",
    brand: "",
    currency: "MAD",
    unit_cost: "",
    selling_price: "",
  });
  const [submitting, setSubmitting] = useState(false);

  async function loadProducts() {
    try {
      setLoading(true);
      const res = await fetch("/api/commerce/products");
      if (!res.ok) throw new Error("Failed to load products.");
      const json = await res.json();
      setProducts(json.products ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load products.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const res = await fetch("/api/commerce/products");
        if (!res.ok) throw new Error("Failed to load products.");
        const json = await res.json();
        if (active) setProducts(json.products ?? []);
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load products.");
      } finally {
        if (active) setLoading(false);
      }
    }
    init();
    return () => { active = false; };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSubmitting(true);
      const payload = {
        name: formData.name.trim(),
        sku: formData.sku.trim() || undefined,
        category: formData.category.trim() || undefined,
        brand: formData.brand.trim() || undefined,
        currency: formData.currency,
        unit_cost: formData.unit_cost ? Number(formData.unit_cost) : undefined,
        selling_price: formData.selling_price ? Number(formData.selling_price) : undefined,
      };
      const res = await fetch("/api/commerce/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to save product.");
      }
      setShowModal(false);
      setFormData({
        name: "",
        sku: "",
        category: "",
        brand: "",
        currency: "MAD",
        unit_cost: "",
        selling_price: "",
      });
      await loadProducts();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error saving product");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Product Catalog & Margin Intelligence</h2>
          <p className="text-sm text-muted-foreground">
            Monitor sales velocity, demand momentum, unit economics, and gross contribution margins.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <Icons.Plus className="h-4 w-4" />
          Add Product
        </button>
      </div>

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center text-sm text-muted-foreground">
          <Icons.Clock3 className="h-5 w-5 animate-spin mr-2" />
          Loading products...
        </div>
      ) : error ? (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      ) : products.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          No products found in catalog. Create your first product to begin tracking commerce intelligence.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Product & SKU</th>
                <th className="px-4 py-3 font-semibold">Brand / Category</th>
                <th className="px-4 py-3 font-semibold">Unit Economics</th>
                <th className="px-4 py-3 font-semibold">Est. Gross Margin</th>
                <th className="px-4 py-3 font-semibold">30d Velocity</th>
                <th className="px-4 py-3 font-semibold">Momentum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-foreground">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.sku ? `SKU: ${p.sku}` : "No SKU"}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <div>{p.brand || "—"}</div>
                    <div>{p.category || "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div>Cost: {p.unit_cost !== null && p.unit_cost !== undefined ? `${p.unit_cost} ${p.currency}` : "Missing"}</div>
                    <div>Price: {p.selling_price !== null && p.selling_price !== undefined ? `${p.selling_price} ${p.currency}` : "Missing"}</div>
                  </td>
                  <td className="px-4 py-3">
                    {p.marginAmount !== null && p.marginRate !== null ? (
                      <div>
                        <div className="font-bold text-foreground">
                          {p.marginAmount} {p.currency}
                        </div>
                        <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                          {p.marginRate}% gross margin
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Cost/Price unavailable</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{p.totalSold30d} units</div>
                    <div className="text-xs text-muted-foreground">
                      {p.dailyVelocity !== null ? `${p.dailyVelocity}/day` : "0 velocity"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                        p.momentum.state === "growing"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : p.momentum.state === "declining"
                          ? "bg-red-500/10 text-red-600 dark:text-red-400"
                          : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      {p.momentum.state}
                      {p.momentum.changeRate !== null ? ` (${p.momentum.changeRate > 0 ? "+" : ""}${p.momentum.changeRate}%)` : ""}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Product Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Add Catalog Product</h3>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground">
                <Icons.X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">Product Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Leather Laptop Sleeve"
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase">SKU</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="e.g. SLEEVE-BRN-01"
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Brand</label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="e.g. Atelier Nord"
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Category</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="e.g. Accessories"
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Unit Cost</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.unit_cost}
                    onChange={(e) => setFormData({ ...formData, unit_cost: e.target.value })}
                    placeholder="0.00"
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Selling Price</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.selling_price}
                    onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                    placeholder="0.00"
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted/40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

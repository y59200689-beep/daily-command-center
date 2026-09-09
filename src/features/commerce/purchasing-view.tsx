"use client";

import { useEffect, useState } from "react";
import { Icons } from "@/components/icons";
import type { PurchaseOrderHealthState } from "@/lib/commerce";

interface SupplierOrder {
  id: string;
  reference?: string | null;
  supplier_id: string;
  status: string;
  ordered_at?: string | null;
  expected_at?: string | null;
  received_at?: string | null;
  total_value?: number | null;
  currency: string;
  notes?: string | null;
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
    unit_cost?: number | null;
  }>;
}

export function PurchasingView() {
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [products, setProducts] = useState<Array<{ id: string; name: string; unit_cost?: number | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  // New PO form state
  const [supplierId, setSupplierId] = useState("");
  const [reference, setReference] = useState("");
  const [expectedAt, setExpectedAt] = useState("");
  const [currency, setCurrency] = useState("MAD");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Array<{ product_id: string; product_name: string; quantity: number; unit_cost: number }>>([
    { product_id: "", product_name: "", quantity: 1, unit_cost: 0 },
  ]);
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    try {
      setLoading(true);
      const [ordRes, supRes, prodRes] = await Promise.all([
        fetch("/api/commerce/purchasing"),
        fetch("/api/commerce/suppliers"),
        fetch("/api/commerce/products"),
      ]);
      if (!ordRes.ok) throw new Error("Failed to load purchase orders.");
      const [ordJson, supJson, prodJson] = await Promise.all([ordRes.json(), supRes.json(), prodRes.json()]);
      setOrders(ordJson.orders ?? []);
      setSuppliers(supJson.suppliers ?? []);
      setProducts(prodJson.products ?? []);
      if (supJson.suppliers?.length > 0) setSupplierId(supJson.suppliers[0].id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load purchasing data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const [ordRes, supRes, prodRes] = await Promise.all([
          fetch("/api/commerce/purchasing"),
          fetch("/api/commerce/suppliers"),
          fetch("/api/commerce/products"),
        ]);
        if (!ordRes.ok) throw new Error("Failed to load purchase orders.");
        const [ordJson, supJson, prodJson] = await Promise.all([ordRes.json(), supRes.json(), prodRes.json()]);
        if (active) {
          setOrders(ordJson.orders ?? []);
          setSuppliers(supJson.suppliers ?? []);
          setProducts(prodJson.products ?? []);
          if (supJson.suppliers?.length > 0) setSupplierId(supJson.suppliers[0].id);
        }
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load purchasing data.");
      } finally {
        if (active) setLoading(false);
      }
    }
    init();
    return () => { active = false; };
  }, []);

  function handleAddLine() {
    setLines([...lines, { product_id: "", product_name: "", quantity: 1, unit_cost: 0 }]);
  }

  function handleLineProductChange(index: number, pId: string) {
    const prod = products.find((p) => p.id === pId);
    const updated = [...lines];
    updated[index].product_id = pId;
    if (prod) {
      updated[index].product_name = prod.name;
      updated[index].unit_cost = Number(prod.unit_cost) || 0;
    }
    setLines(updated);
  }

  function handleLineChange(
    index: number,
    field: "product_id" | "product_name" | "quantity" | "unit_cost",
    value: string | number
  ) {
    const updated = [...lines];
    updated[index] = {
      ...updated[index],
      [field]: field === "quantity" || field === "unit_cost" ? Number(value) : String(value),
    };
    setLines(updated);
  }

  async function handleCreatePO(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSubmitting(true);
      if (!supplierId) throw new Error("Select a supplier.");
      const validLines = lines.filter((l) => l.product_name.trim() && l.quantity > 0);
      if (validLines.length === 0) throw new Error("Add at least one line item.");

      const payload = {
        supplier_id: supplierId,
        reference: reference.trim() || undefined,
        expected_at: expectedAt ? new Date(expectedAt).toISOString() : undefined,
        currency,
        notes: notes.trim() || undefined,
        items: validLines.map((l) => ({
          product_id: l.product_id || undefined,
          product_name: l.product_name,
          quantity: Number(l.quantity),
          unit_cost: Number(l.unit_cost) || undefined,
        })),
      };

      const res = await fetch("/api/commerce/purchasing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to create purchase order.");
      }

      setShowModal(false);
      setReference("");
      setNotes("");
      setLines([{ product_id: "", product_name: "", quantity: 1, unit_cost: 0 }]);
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error creating purchase order");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Purchase Orders & Inbound Shipments</h2>
          <p className="text-sm text-muted-foreground">
            Manage supplier purchase orders, track on-time delivery progress, and fulfillment rates.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <Icons.Plus className="h-4 w-4" />
          Create Purchase Order
        </button>
      </div>

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center text-sm text-muted-foreground">
          <Icons.Clock3 className="h-5 w-5 animate-spin mr-2" />
          Loading purchase orders...
        </div>
      ) : error ? (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          No purchase orders placed yet. Create your first PO to initiate supplier inbound delivery tracking.
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((po) => (
            <div key={po.id} className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-foreground">
                      {po.reference || `PO #${po.id.slice(0, 8)}`}
                    </h3>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${
                        po.health.state === "late"
                          ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30"
                          : po.health.state === "partial"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                          : po.health.state === "completed"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                          : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30"
                      }`}
                    >
                      {po.health.state.replace("_", " ")}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Placed: {po.ordered_at ? new Date(po.ordered_at).toLocaleDateString() : "Draft"}
                    {po.expected_at && ` • Expected: ${new Date(po.expected_at).toLocaleDateString()}`}
                    {po.health.isLate && (
                      <span className="text-red-600 dark:text-red-400 font-bold ml-1">
                        ({po.health.daysOverdue} days overdue)
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-bold text-foreground">
                    {po.total_value !== null && po.total_value !== undefined
                      ? `${po.total_value.toLocaleString()} ${po.currency}`
                      : "Value uncalculated"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Fulfillment: {po.health.itemsCompletionRate}%
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              {po.items.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border/50">
                  <div className="text-xs font-semibold text-muted-foreground mb-1">Line Items:</div>
                  <div className="divide-y divide-border/40 text-xs">
                    {po.items.map((item) => (
                      <div key={item.id} className="py-1.5 flex justify-between">
                        <span>{item.product_name}</span>
                        <span className="font-mono text-muted-foreground">
                          {item.quantity_received ?? 0} / {item.quantity} received
                          {item.unit_cost ? ` @ ${item.unit_cost} ${po.currency}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create PO Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">New Purchase Order</h3>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground">
                <Icons.X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreatePO} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Supplier *</label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    required
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase">PO Reference / Code</label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="e.g. PO-2026-001"
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Expected Delivery Date</label>
                  <input
                    type="date"
                    value={expectedAt}
                    onChange={(e) => setExpectedAt(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Currency</label>
                  <input
                    type="text"
                    maxLength={3}
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">Order Line Items</span>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="text-xs text-primary font-semibold hover:underline"
                  >
                    + Add Item
                  </button>
                </div>

                {lines.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-muted/20 p-2 rounded-lg">
                    <div className="col-span-6">
                      <select
                        value={line.product_id}
                        onChange={(e) => handleLineProductChange(idx, e.target.value)}
                        className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
                      >
                        <option value="">Select Catalog Product or Custom</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      {!line.product_id && (
                        <input
                          type="text"
                          placeholder="Item Name"
                          value={line.product_name}
                          onChange={(e) => handleLineChange(idx, "product_name", e.target.value)}
                          className="w-full mt-1 px-2 py-1 rounded border border-border bg-background text-xs"
                        />
                      )}
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={line.quantity}
                        onChange={(e) => handleLineChange(idx, "quantity", Number(e.target.value))}
                        className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Cost"
                        value={line.unit_cost}
                        onChange={(e) => handleLineChange(idx, "unit_cost", Number(e.target.value))}
                        className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Shipping instructions, terms..."
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                />
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
                  {submitting ? "Placing PO..." : "Create Purchase Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Icons } from "@/components/icons";
import type { SupplierReliabilityState } from "@/lib/commerce";

interface SupplierItem {
  id: string;
  name: string;
  contact_reference?: string | null;
  lead_time_days: number;
  minimum_order_value?: number | null;
  currency: string;
  payment_terms?: string | null;
  notes?: string | null;
  active: boolean;
  performance: {
    state: SupplierReliabilityState;
    totalOrders: number;
    completedOrders: number;
    onTimeOrders: number;
    onTimeRate: number | null;
    fillRate: number | null;
    averageLeadTimeDays: number | null;
    incidentsCount: number;
    explanation: string;
  };
}

export function SuppliersView() {
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    contact_reference: "",
    lead_time_days: "7",
    minimum_order_value: "",
    currency: "MAD",
    payment_terms: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  async function loadSuppliers() {
    try {
      setLoading(true);
      const res = await fetch("/api/commerce/suppliers");
      if (!res.ok) throw new Error("Failed to load suppliers.");
      const json = await res.json();
      setSuppliers(json.suppliers ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load suppliers.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const res = await fetch("/api/commerce/suppliers");
        if (!res.ok) throw new Error("Failed to load suppliers.");
        const json = await res.json();
        if (active) setSuppliers(json.suppliers ?? []);
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load suppliers.");
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
        contact_reference: formData.contact_reference.trim() || undefined,
        lead_time_days: Number(formData.lead_time_days) || 7,
        minimum_order_value: formData.minimum_order_value ? Number(formData.minimum_order_value) : undefined,
        currency: formData.currency,
        payment_terms: formData.payment_terms.trim() || undefined,
        notes: formData.notes.trim() || undefined,
      };

      const res = await fetch("/api/commerce/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to save supplier.");
      }

      setShowModal(false);
      setFormData({
        name: "",
        contact_reference: "",
        lead_time_days: "7",
        minimum_order_value: "",
        currency: "MAD",
        payment_terms: "",
        notes: "",
      });
      await loadSuppliers();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error saving supplier");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Suppliers & Reliability Tracking</h2>
          <p className="text-sm text-muted-foreground">
            Monitor supplier fulfillment, delivery lead times, on-time delivery rates, and reliability ratings.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <Icons.Plus className="h-4 w-4" />
          Add Supplier
        </button>
      </div>

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center text-sm text-muted-foreground">
          <Icons.Clock3 className="h-5 w-5 animate-spin mr-2" />
          Loading suppliers...
        </div>
      ) : error ? (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      ) : suppliers.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          No suppliers registered yet. Add your first supplier to track lead times and purchase orders.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((sup) => (
            <div key={sup.id} className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-base text-foreground">{sup.name}</h3>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {sup.contact_reference || "No contact info"}
                  </div>
                </div>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${
                    sup.performance.state === "reliable"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : sup.performance.state === "watch"
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      : sup.performance.state === "unreliable"
                      ? "bg-red-500/10 text-red-600 dark:text-red-400"
                      : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  {sup.performance.state.replace("_", " ")}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/50">
                <div>
                  <span className="text-muted-foreground">Lead Time:</span>
                  <div className="font-bold text-sm">{sup.lead_time_days} days</div>
                </div>
                <div>
                  <span className="text-muted-foreground">PO Count:</span>
                  <div className="font-bold text-sm">{sup.performance.totalOrders}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">On-Time Rate:</span>
                  <div className="font-bold text-sm">
                    {sup.performance.onTimeRate !== null ? `${sup.performance.onTimeRate}%` : "No history"}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Fill Rate:</span>
                  <div className="font-bold text-sm">
                    {sup.performance.fillRate !== null ? `${sup.performance.fillRate}%` : "No history"}
                  </div>
                </div>
              </div>

              {sup.payment_terms && (
                <div className="text-xs text-muted-foreground pt-1 border-t border-border/50">
                  <span className="font-semibold">Terms:</span> {sup.payment_terms}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Supplier Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Add Supplier</h3>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground">
                <Icons.X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">Supplier Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Atlas Packaging SARL"
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Contact Info</label>
                  <input
                    type="text"
                    value={formData.contact_reference}
                    onChange={(e) => setFormData({ ...formData, contact_reference: e.target.value })}
                    placeholder="Email, phone, or rep name"
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Lead Time (Days) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.lead_time_days}
                    onChange={(e) => setFormData({ ...formData, lead_time_days: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Min Order Value (MOQ)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.minimum_order_value}
                    onChange={(e) => setFormData({ ...formData, minimum_order_value: e.target.value })}
                    placeholder="0.00"
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Currency</label>
                  <input
                    type="text"
                    maxLength={3}
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value.toUpperCase() })}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">Payment Terms</label>
                <input
                  type="text"
                  value={formData.payment_terms}
                  onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                  placeholder="e.g. Net 30, 50% advance"
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                  {submitting ? "Saving..." : "Save Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Icons } from "@/components/icons";

interface Discrepancy {
  id: string;
  product_id: string;
  productName?: string;
  expected_stock: number;
  actual_stock: number;
  discrepancy_units: number;
  cost_impact?: number | null;
  currency: string;
  discrepancy_type: string;
  status: string;
  resolution_notes?: string | null;
  reported_at: string;
  product_catalog_refs?: { name: string; sku?: string | null };
}

interface Audit {
  id: string;
  title: string;
  status: string;
  audit_type: string;
  location?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  inventory_audit_lines?: unknown[];
}

export function DiscrepanciesAuditsView() {
  const [activeTab, setActiveTab] = useState<"audits" | "discrepancies">("audits");
  const [audits, setAudits] = useState<Audit[]>([]);
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [products, setProducts] = useState<Array<{ id: string; name: string; availableStock: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Audit Modal
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditTitle, setAuditTitle] = useState("");
  const [auditType, setAuditType] = useState("cycle_count");
  const [auditLocation, setAuditLocation] = useState("");

  // Adjustment Modal
  const [showAdjModal, setShowAdjModal] = useState(false);
  const [adjProductId, setAdjProductId] = useState("");
  const [adjType, setAdjType] = useState("cycle_count");
  const [adjDelta, setAdjDelta] = useState("");
  const [adjReason, setAdjReason] = useState("");
  const [targetDiscrepancyId, setTargetDiscrepancyId] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    try {
      setLoading(true);
      const [audRes, discRes, prodRes] = await Promise.all([
        fetch("/api/commerce/audits"),
        fetch("/api/commerce/discrepancies"),
        fetch("/api/commerce/inventory"),
      ]);
      if (!audRes.ok || !discRes.ok) throw new Error("Failed to load audit or discrepancy data.");
      const [audJson, discJson, prodJson] = await Promise.all([audRes.json(), discRes.json(), prodRes.json()]);
      setAudits(audJson.audits ?? []);
      setDiscrepancies(discJson.discrepancies ?? []);
      setProducts(prodJson.items ?? []);
      if (prodJson.items?.length > 0) setAdjProductId(prodJson.items[0].id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load audit data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const [audRes, discRes, prodRes] = await Promise.all([
          fetch("/api/commerce/audits"),
          fetch("/api/commerce/discrepancies"),
          fetch("/api/commerce/inventory"),
        ]);
        if (!audRes.ok || !discRes.ok) throw new Error("Failed to load audit or discrepancy data.");
        const [audJson, discJson, prodJson] = await Promise.all([audRes.json(), discRes.json(), prodRes.json()]);
        if (active) {
          setAudits(audJson.audits ?? []);
          setDiscrepancies(discJson.discrepancies ?? []);
          setProducts(prodJson.items ?? []);
          if (prodJson.items?.length > 0) setAdjProductId(prodJson.items[0].id);
        }
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load audit data.");
      } finally {
        if (active) setLoading(false);
      }
    }
    init();
    return () => { active = false; };
  }, []);

  async function handleCreateAudit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await fetch("/api/commerce/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: auditTitle.trim(),
          audit_type: auditType,
          location: auditLocation.trim() || undefined,
          status: "in_progress",
        }),
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to create audit.");
      }
      setShowAuditModal(false);
      setAuditTitle("");
      setAuditLocation("");
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error creating audit");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRecordAdjustment(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSubmitting(true);
      const deltaNum = Number(adjDelta);
      if (isNaN(deltaNum) || deltaNum === 0) throw new Error("Enter a non-zero quantity delta.");

      const res = await fetch("/api/commerce/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: adjProductId,
          adjustment_type: adjType,
          quantity_delta: deltaNum,
          reason: adjReason.trim(),
          discrepancy_id: targetDiscrepancyId || undefined,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to record adjustment.");
      }

      setShowAdjModal(false);
      setAdjDelta("");
      setAdjReason("");
      setTargetDiscrepancyId(null);
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error recording adjustment");
    } finally {
      setSubmitting(false);
    }
  }

  function openDiscrepancyAdjustment(d: Discrepancy) {
    setAdjProductId(d.product_id);
    setAdjDelta(String(-d.discrepancy_units)); // counter-balance or set exact
    setAdjReason(`Resolving discrepancy (${d.discrepancy_type})`);
    setAdjType("manual_correction");
    setTargetDiscrepancyId(d.id);
    setShowAdjModal(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Audits, Cycle Counts & Discrepancies</h2>
          <p className="text-sm text-muted-foreground">
            Execute inventory audits, verify physical counts, record count variances, and resolve discrepancies safely.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setTargetDiscrepancyId(null);
              setShowAdjModal(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted/40 transition-colors"
          >
            <Icons.ReceiptText className="h-4 w-4 text-primary" />
            New Stock Adjustment
          </button>
          <button
            onClick={() => setShowAuditModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <Icons.Plus className="h-4 w-4" />
            Start Audit
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-lg border border-border bg-muted/40 p-1 w-fit">
        <button
          onClick={() => setActiveTab("audits")}
          className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            activeTab === "audits" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Audit Sessions ({audits.length})
        </button>
        <button
          onClick={() => setActiveTab("discrepancies")}
          className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            activeTab === "discrepancies" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Discrepancies ({discrepancies.length})
        </button>
      </div>

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center text-sm text-muted-foreground">
          <Icons.Clock3 className="h-5 w-5 animate-spin mr-2" />
          Loading audit records...
        </div>
      ) : error ? (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      ) : activeTab === "audits" ? (
        audits.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
            No audits initiated. Start a cycle count or spot check session to verify physical inventory.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {audits.map((aud) => (
              <div key={aud.id} className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-base text-foreground">{aud.title}</h3>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Type: {aud.audit_type.replace("_", " ")} {aud.location ? `• ${aud.location}` : ""}
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${
                      aud.status === "completed"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : aud.status === "in_progress"
                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    {aud.status.replace("_", " ")}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Created: {new Date(aud.created_at).toLocaleDateString()}
                  {aud.completed_at && ` • Completed: ${new Date(aud.completed_at).toLocaleDateString()}`}
                </div>
              </div>
            ))}
          </div>
        )
      ) : discrepancies.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          <Icons.Check className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
          <div className="font-semibold text-foreground">Zero Discrepancies</div>
          <p className="mt-1">All physical counts match recorded inventory snapshots perfectly.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold">Expected</th>
                <th className="px-4 py-3 font-semibold">Counted</th>
                <th className="px-4 py-3 font-semibold">Variance</th>
                <th className="px-4 py-3 font-semibold">Cost Impact</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {discrepancies.map((d) => (
                <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-semibold">
                    {d.product_catalog_refs?.name || "Product"}
                    <div className="text-xs text-muted-foreground font-normal">Type: {d.discrepancy_type}</div>
                  </td>
                  <td className="px-4 py-3">{d.expected_stock} units</td>
                  <td className="px-4 py-3">{d.actual_stock} units</td>
                  <td className="px-4 py-3 font-bold">
                    <span className={d.discrepancy_units < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}>
                      {d.discrepancy_units > 0 ? "+" : ""}{d.discrepancy_units}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {d.cost_impact !== null && d.cost_impact !== undefined
                      ? `${d.cost_impact} ${d.currency}`
                      : "Unrecorded"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${
                        d.status === "adjusted"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : d.status === "investigating"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      {d.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {d.status !== "adjusted" && (
                      <button
                        onClick={() => openDiscrepancyAdjustment(d)}
                        className="px-2.5 py-1 rounded bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90"
                      >
                        Adjust Stock
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Start Audit Modal */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">New Inventory Audit</h3>
              <button onClick={() => setShowAuditModal(false)} className="text-muted-foreground hover:text-foreground">
                <Icons.X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateAudit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">Audit Title *</label>
                <input
                  type="text"
                  required
                  value={auditTitle}
                  onChange={(e) => setAuditTitle(e.target.value)}
                  placeholder="e.g. Q3 Main Warehouse Cycle Count"
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">Audit Type</label>
                <select
                  value={auditType}
                  onChange={(e) => setAuditType(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                >
                  <option value="cycle_count">Cycle Count</option>
                  <option value="full">Full Physical Inventory</option>
                  <option value="spot_check">Spot Check</option>
                  <option value="supplier_reconciliation">Supplier Reconciliation</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">Location / Shelf</label>
                <input
                  type="text"
                  value={auditLocation}
                  onChange={(e) => setAuditLocation(e.target.value)}
                  placeholder="e.g. Aisle 3 / Storage Room"
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowAuditModal(false)}
                  className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted/40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {submitting ? "Starting..." : "Start Audit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Stock Adjustment Modal */}
      {showAdjModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Record Stock Adjustment</h3>
              <button onClick={() => setShowAdjModal(false)} className="text-muted-foreground hover:text-foreground">
                <Icons.X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleRecordAdjustment} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">Product *</label>
                <select
                  value={adjProductId}
                  onChange={(e) => setAdjProductId(e.target.value)}
                  required
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Current: {p.availableStock})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Adjustment Type</label>
                  <select
                    value={adjType}
                    onChange={(e) => setAdjType(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  >
                    <option value="cycle_count">Cycle Count</option>
                    <option value="damage">Damaged Stock</option>
                    <option value="write_off">Write-Off</option>
                    <option value="return_to_stock">Return to Stock</option>
                    <option value="manual_correction">Manual Correction</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Quantity Delta (+ or -) *</label>
                  <input
                    type="number"
                    step="1"
                    required
                    value={adjDelta}
                    onChange={(e) => setAdjDelta(e.target.value)}
                    placeholder="e.g. -5 or +10"
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">Reason / Justification *</label>
                <input
                  type="text"
                  required
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  placeholder="e.g. Expired packaging damaged during inspection"
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowAdjModal(false)}
                  className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted/40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Record Adjustment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

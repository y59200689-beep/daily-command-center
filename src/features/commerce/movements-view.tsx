"use client";

import { useEffect, useState } from "react";
import { Icons } from "@/components/icons";

interface MovementItem {
  id: string;
  type: "sale" | "receipt" | "adjustment";
  productId: string;
  productName: string;
  sku?: string | null;
  delta: number;
  previousStock?: number | null;
  newStock?: number | null;
  reason: string;
  timestamp: string;
}

export function MovementsView() {
  const [movements, setMovements] = useState<MovementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/commerce/movements");
        if (!res.ok) throw new Error("Failed to load inventory movements.");
        const json = await res.json();
        if (active) setMovements(json.movements ?? []);
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load movements.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  const filtered = movements.filter((m) => {
    if (filter === "all") return true;
    return m.type === filter;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Stock Movements Audit Trail</h2>
          <p className="text-sm text-muted-foreground">
            Complete chronological record of all stock balance changes: outbound customer sales, inbound supplier receipts, and manual audited adjustments.
          </p>
        </div>

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="all">All Movement Types</option>
          <option value="sale">Outbound Sales Only</option>
          <option value="receipt">Inbound Receipts Only</option>
          <option value="adjustment">Audited Adjustments Only</option>
        </select>
      </div>

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center text-sm text-muted-foreground">
          <Icons.Clock3 className="h-5 w-5 animate-spin mr-2" />
          Loading movements audit trail...
        </div>
      ) : error ? (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          No inventory movements recorded matching the current filter.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Event Type</th>
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold">Quantity Delta</th>
                <th className="px-4 py-3 font-semibold">Stock Before &rarr; After</th>
                <th className="px-4 py-3 font-semibold">Reference / Reason</th>
                <th className="px-4 py-3 font-semibold text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((m) => (
                <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${
                        m.type === "sale"
                          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          : m.type === "receipt"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {m.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    {m.productName}
                    {m.sku && <span className="text-xs font-normal text-muted-foreground ml-2">SKU: {m.sku}</span>}
                  </td>
                  <td className="px-4 py-3 font-bold">
                    <span className={m.delta < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}>
                      {m.delta > 0 ? `+${m.delta}` : m.delta}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {m.previousStock !== null && m.newStock !== null
                      ? `${m.previousStock} → ${m.newStock}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-foreground font-medium">{m.reason}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground text-right">
                    {new Date(m.timestamp).toLocaleString()}
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

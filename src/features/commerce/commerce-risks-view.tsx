"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icons } from "@/components/icons";
import type { CommerceRiskItem } from "@/lib/commerce";

export function CommerceRisksView() {
  const [risks, setRisks] = useState<CommerceRiskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/commerce/risks");
        if (!res.ok) throw new Error("Failed to load commerce risks.");
        const json = await res.json();
        if (active) setRisks(json.risks ?? []);
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load risks.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  const filtered = risks.filter((r) => {
    if (filter === "all") return true;
    return r.severity === filter;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Commerce Risk Intelligence Matrix</h2>
          <p className="text-sm text-muted-foreground">
            Ranked risk signals synthesized deterministically across stockout burn rates, late supplier shipments, count variances, and tied-up capital.
          </p>
        </div>

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="all">All Severities</option>
          <option value="critical">Critical Severity Only</option>
          <option value="high">High Severity Only</option>
          <option value="medium">Medium Severity Only</option>
          <option value="low">Low Severity Only</option>
        </select>
      </div>

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center text-sm text-muted-foreground">
          <Icons.Clock3 className="h-5 w-5 animate-spin mr-2" />
          Ranking operational risk signals...
        </div>
      ) : error ? (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          <Icons.Check className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
          <div className="font-semibold text-foreground">No Risks Active</div>
          <p className="mt-1">All operational signals are currently within acceptable tolerances.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((risk) => (
            <div
              key={risk.id}
              className={`rounded-xl border p-5 shadow-sm space-y-2 transition-all ${
                risk.severity === "critical"
                  ? "border-red-500/40 bg-red-500/5"
                  : risk.severity === "high"
                  ? "border-amber-500/40 bg-amber-500/5"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                      risk.severity === "critical"
                        ? "bg-red-500/20 text-red-700 dark:text-red-300 border border-red-500/40"
                        : risk.severity === "high"
                        ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40"
                        : "bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/40"
                    }`}
                  >
                    {risk.severity}
                  </span>
                  <h3 className="font-bold text-base text-foreground">{risk.title}</h3>
                </div>

                <div className="text-xs font-mono uppercase text-muted-foreground">
                  Entity: {risk.entityType}
                </div>
              </div>

              <p className="text-sm text-muted-foreground">{risk.description}</p>

              <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs">
                <span className="font-medium text-foreground">
                  Recommendation: {risk.recommendedAction}
                </span>
                <Link
                  href={
                    risk.type === "stockout"
                      ? "/commerce/replenishment"
                      : risk.type === "late_order"
                      ? "/commerce/purchasing"
                      : risk.type === "discrepancy"
                      ? "/commerce/audits"
                      : "/commerce/products"
                  }
                  className="inline-flex items-center gap-1 text-primary font-semibold hover:underline"
                >
                  Resolve
                  <Icons.ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Icons } from "@/components/icons";

interface ReviewRecord {
  id: string;
  review_period: string;
  summary_data: {
    productsCount?: number;
    metrics?: {
      reorderNowCount?: number;
      lateOrdersCount?: number;
      slowStockCount?: number;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  action_items: Array<{
    title: string;
    description?: string;
    urgent?: boolean;
    [key: string]: unknown;
  }>;
  status: string;
  conducted_at: string;
}

export function CommerceReviewView() {
  const [review, setReview] = useState<ReviewRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conducting, setConducting] = useState(false);

  async function loadReview() {
    try {
      setLoading(true);
      const res = await fetch("/api/commerce/review");
      if (!res.ok) throw new Error("Failed to load review record.");
      const json = await res.json();
      setReview(json.review);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load review.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const res = await fetch("/api/commerce/review");
        if (!res.ok) throw new Error("Failed to load review record.");
        const json = await res.json();
        if (active) setReview(json.review);
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load review.");
      } finally {
        if (active) setLoading(false);
      }
    }
    init();
    return () => { active = false; };
  }, []);

  async function handleConductReview() {
    try {
      setConducting(true);
      const overviewRes = await fetch("/api/commerce/overview");
      const overview = await overviewRes.json();

      const now = new Date();
      const period = `W${Math.ceil(now.getDate() / 7)} ${now.toLocaleString("default", { month: "short" })} ${now.getFullYear()}`;

      const actionItems = [];
      if (overview.metrics?.reorderNowCount > 0) {
        actionItems.push({
          title: "Expedite urgent replenishment orders",
          urgent: true,
          count: overview.metrics.reorderNowCount,
        });
      }
      if (overview.metrics?.lateOrdersCount > 0) {
        actionItems.push({
          title: "Follow up with late supplier purchase orders",
          urgent: true,
          count: overview.metrics.lateOrdersCount,
        });
      }
      if (overview.metrics?.openDiscrepanciesCount > 0) {
        actionItems.push({
          title: "Investigate and adjust count discrepancies",
          urgent: false,
          count: overview.metrics.openDiscrepanciesCount,
        });
      }

      const payload = {
        review_period: period,
        summary_data: {
          metrics: overview.metrics,
          currencyBuckets: overview.currencyBuckets,
          productsCount: overview.productsCount,
          nextMove: overview.nextMove,
        },
        action_items: actionItems,
        status: "finalized",
        conducted_at: new Date().toISOString(),
      };

      const res = await fetch("/api/commerce/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to record review.");
      }

      await loadReview();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to record review");
    } finally {
      setConducting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Commerce Operating Review</h2>
          <p className="text-sm text-muted-foreground">
            Structured governance records tracking stock health, turnover trends, supplier discipline, and capital deployment.
          </p>
        </div>

        <button
          onClick={handleConductReview}
          disabled={conducting}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Icons.BookOpen className="h-4 w-4" />
          {conducting ? "Conducting Review..." : "Conduct Operating Review"}
        </button>
      </div>

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center text-sm text-muted-foreground">
          <Icons.Clock3 className="h-5 w-5 animate-spin mr-2" />
          Loading review records...
        </div>
      ) : error ? (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      ) : !review ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          <Icons.BookOpen className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <div className="font-semibold text-foreground">No Commerce Review Conducted Yet</div>
          <p className="mt-1">
            Click &quot;Conduct Operating Review&quot; to synthesize current inventory state, currency totals, and pending actions into an audited record.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Latest Operating Review Record
              </span>
              <h3 className="text-xl font-bold text-foreground mt-0.5">{review.review_period}</h3>
              <div className="text-xs text-muted-foreground">
                Conducted on {new Date(review.conducted_at).toLocaleString()}
              </div>
            </div>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              {review.status}
            </span>
          </div>

          {/* Review Metrics Snapshot */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Metrics at Time of Review
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-muted/40 border border-border/50">
                <span className="text-muted-foreground">Products Tracked</span>
                <div className="text-lg font-bold text-foreground mt-0.5">
                  {review.summary_data.productsCount ?? 0}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted/40 border border-border/50">
                <span className="text-muted-foreground">Reorder Now</span>
                <div className="text-lg font-bold text-red-600 dark:text-red-400 mt-0.5">
                  {review.summary_data.metrics?.reorderNowCount ?? 0}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted/40 border border-border/50">
                <span className="text-muted-foreground">Late Supplier POs</span>
                <div className="text-lg font-bold text-red-600 dark:text-red-400 mt-0.5">
                  {review.summary_data.metrics?.lateOrdersCount ?? 0}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted/40 border border-border/50">
                <span className="text-muted-foreground">Slow Stock Items</span>
                <div className="text-lg font-bold text-foreground mt-0.5">
                  {review.summary_data.metrics?.slowStockCount ?? 0}
                </div>
              </div>
            </div>
          </div>

          {/* Action Items */}
          {review.action_items.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Identified Action Items
              </h4>
              <div className="space-y-2">
                {review.action_items.map((act, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background text-sm">
                    <Icons.Check className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium text-foreground flex-1">{act.title}</span>
                    {act.urgent && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30">
                        Urgent
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

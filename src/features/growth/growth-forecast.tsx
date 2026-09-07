"use client";

import { useCallback, useState } from "react";
import { useDeferredEffect } from "@/lib/use-deferred-effect";

type ForecastItem = {
  id: string;
  title: string;
  value: number;
  currency: string;
  bucket: "Committed" | "Likely" | "Possible";
  stage: string;
  expectedCloseDate?: string | null;
  ruleReason: string;
};

type ForecastData = {
  items: ForecastItem[];
  totalsByBucket: Record<string, number>;
  totalOpenValue: number;
};

function fmt(n: number, currency = "MAD") {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M ${currency}`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k ${currency}`;
  return `${n} ${currency}`;
}

const BUCKET_COLORS: Record<string, string> = {
  Committed: "var(--success)",
  Likely: "var(--attention)",
  Possible: "var(--muted)",
};

export function GrowthForecast() {
  const [data, setData] = useState<ForecastData | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/growth/forecast", { cache: "no-store" });
    const body = await res.json();
    if (res.ok) setData(body);
    else setError(body.error ?? "Forecast could not be loaded.");
  }, []);

  useDeferredEffect(useCallback(() => { void load(); }, [load]));

  const buckets = ["Committed", "Likely", "Possible"] as const;
  const visible = (data?.items ?? []).filter((i) => filter === "all" || i.bucket === filter);
  const totals = data?.totalsByBucket ?? {};
  const totalOpen = data?.totalOpenValue ?? 0;

  return (
    <main className="domain-page growth-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Growth · Forecast</p>
          <h1>Revenue forecast.</h1>
          <p>Deterministic bucketing based on stage, probability, and proposal status.</p>
        </div>
      </header>

      {error ? <p role="alert" className="field-error">{error}</p> : null}

      {/* Bucket summary */}
      <div className="metric-ledger metric-ledger--four">
        <div>
          <strong>{fmt(totalOpen)}</strong>
          <span>Total open pipeline</span>
        </div>
        {buckets.map((b) => (
          <div key={b}>
            <strong style={{ color: BUCKET_COLORS[b] }}>{fmt(Number(totals[b] ?? 0))}</strong>
            <span>{b}</span>
          </div>
        ))}
      </div>

      {/* Bucket filter */}
      <div className="content-stage-strip" role="tablist" aria-label="Forecast buckets">
        <button role="tab" aria-selected={filter === "all"} className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All</button>
        {buckets.map((b) => (
          <button key={b} role="tab" aria-selected={filter === b} className={filter === b ? "active" : ""} onClick={() => setFilter(b)}>{b}</button>
        ))}
      </div>

      {/* Forecast items */}
      <section className="data-surface">
        {visible.length ? (
          <div className="growth-forecast-list">
            {visible.map((item) => (
              <div key={item.id} className="growth-forecast-row">
                <div className="growth-forecast-row__main">
                  <strong>{item.title}</strong>
                  <small>{item.stage.replace(/_/g, " ")}</small>
                  {item.expectedCloseDate ? <em>Close: {item.expectedCloseDate.slice(0, 10)}</em> : null}
                </div>
                <div className="growth-forecast-row__right">
                  <span className="growth-forecast-bucket" style={{ color: BUCKET_COLORS[item.bucket] }}>
                    {item.bucket}
                  </span>
                  <strong className="growth-forecast-value">{fmt(item.value, item.currency)}</strong>
                </div>
                <p className="growth-forecast-rule">{item.ruleReason}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="dataset-note">No open pipeline to forecast. Add opportunities in Pipeline.</p>
        )}
      </section>

      <aside className="growth-forecast-legend data-surface">
        <p className="eyebrow">How forecasting works</p>
        <ul className="growth-forecast-legend__list">
          <li><strong style={{ color: BUCKET_COLORS.Committed }}>Committed</strong> — Proposal accepted or in final negotiation, or probability ≥ 80%.</li>
          <li><strong style={{ color: BUCKET_COLORS.Likely }}>Likely</strong> — Formal proposal sent or probability ≥ 50%.</li>
          <li><strong style={{ color: BUCKET_COLORS.Possible }}>Possible</strong> — Qualified lead or meeting stage, early pipeline.</li>
        </ul>
        <p>All bucketing is 100% deterministic — no AI probability estimates.</p>
      </aside>
    </main>
  );
}

"use client";

import { useCallback, useState } from "react";
import { useDeferredEffect } from "@/lib/use-deferred-effect";

type Row = Record<string, unknown> & { id: string };

function fmt(n: number, currency = "MAD") {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M ${currency}`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k ${currency}`;
  return `${n} ${currency}`;
}

function healthClass(h: string) {
  if (h === "Healthy") return "health--healthy";
  if (h === "Needs attention") return "health--warning";
  if (h === "At risk") return "health--danger";
  return "health--stalled";
}

const STAGE_ORDER = ["discovery", "qualified", "meeting", "proposal", "negotiation", "won", "lost"];

export function GrowthPipeline() {
  const [data, setData] = useState<{ summary?: Record<string, unknown>; opportunities?: Row[] } | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/growth/pipeline", { cache: "no-store" });
    const body = await res.json();
    if (res.ok) setData(body);
    else setError(body.error ?? "Pipeline could not be loaded.");
  }, []);

  useDeferredEffect(useCallback(() => { void load(); }, [load]));

  const summary = data?.summary ?? {};
  const opps = (data?.opportunities ?? []).filter((o) => filter === "all" || o.stage === filter);

  const stages = [...new Set((data?.opportunities ?? []).map((o) => String(o.stage ?? "")))].sort(
    (a, b) => STAGE_ORDER.indexOf(a) - STAGE_ORDER.indexOf(b)
  );

  return (
    <main className="domain-page growth-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Growth · Pipeline</p>
          <h1>Deal health.</h1>
          <p>
            {String(summary.openCount ?? 0)} open deals ·{" "}
            {fmt(Number(summary.totalOpenValue ?? 0))} total value ·{" "}
            Signal: {String(summary.signal ?? "–")}
          </p>
        </div>
      </header>

      {error ? <p role="alert" className="field-error">{error}</p> : null}

      {/* Stage filter strip */}
      <div className="content-stage-strip" role="tablist" aria-label="Pipeline stages">
        <button
          role="tab"
          aria-selected={filter === "all"}
          className={filter === "all" ? "active" : ""}
          onClick={() => setFilter("all")}
        >
          All
        </button>
        {stages.map((stage) => (
          <button
            key={stage}
            role="tab"
            aria-selected={filter === stage}
            className={filter === stage ? "active" : ""}
            onClick={() => setFilter(stage)}
          >
            {stage.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {/* Pipeline quality summary */}
      {summary.signal ? (
        <div className="metric-ledger metric-ledger--four">
          <div>
            <strong>{fmt(Number(summary.totalOpenValue ?? 0))}</strong>
            <span>Open pipeline</span>
          </div>
          <div>
            <strong>{String(summary.openCount ?? 0)}</strong>
            <span>Active deals</span>
          </div>
          <div>
            <strong>{String(summary.stalledCount ?? 0)}</strong>
            <span>Stalled (&gt;30 days)</span>
          </div>
          <div>
            <strong>{String(summary.signal ?? "–")}</strong>
            <span>Quality signal</span>
          </div>
        </div>
      ) : null}

      {/* Opportunity rows */}
      <section className="data-surface">
        {opps.length ? (
          <div className="pipeline-deal-list">
            {opps.map((opp) => {
              const intel = opp.intelligence as Record<string, unknown> | undefined;
              const health = String(intel?.health ?? "");
              const score = Number(intel?.score ?? 0);
              const nextAction = String(intel?.nextAction ?? "");
              const reasons = (intel?.reasons as string[] | undefined) ?? [];
              return (
                <div key={opp.id} className="pipeline-deal-row">
                  <div className="pipeline-deal-main">
                    <strong>{String(opp.title ?? "Untitled")}</strong>
                    <small>{String(opp.stage ?? "").replace(/_/g, " ")}</small>
                    {opp.client_name ? <em>{String(opp.client_name)}</em> : null}
                  </div>
                  <div className="pipeline-deal-meta">
                    <span className={`growth-health-badge ${healthClass(health)}`}>{health || "–"}</span>
                    <span className="pipeline-score">Score: {score}</span>
                  </div>
                  <div className="pipeline-deal-value">
                    {fmt(Number(opp.estimated_value ?? 0), String(opp.currency ?? "MAD"))}
                  </div>
                  {nextAction ? (
                    <div className="pipeline-deal-action">
                      <p className="eyebrow">Next action</p>
                      <p>{nextAction}</p>
                    </div>
                  ) : null}
                  {reasons.length > 0 ? (
                    <ul className="pipeline-deal-reasons">
                      {reasons.slice(0, 3).map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : <p className="dataset-note">No deals match this filter.</p>}
      </section>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDeferredEffect } from "@/lib/use-deferred-effect";

type Row = Record<string, unknown> & { id: string };

function fmt(n: number, currency = "MAD") {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M ${currency}`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k ${currency}`;
  return `${n} ${currency}`;
}

function severityClass(s: string) {
  if (s === "critical") return "growth-risk--critical";
  if (s === "important") return "growth-risk--important";
  return "growth-risk--attention";
}

function healthClass(h: string) {
  if (h === "Healthy") return "health--healthy";
  if (h === "Needs attention") return "health--warning";
  if (h === "At risk") return "health--danger";
  return "health--stalled";
}

export function GrowthHome() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/growth/overview", { cache: "no-store" });
    const body = await res.json();
    if (res.ok) setData(body);
    else setError(body.error ?? "Growth overview could not be loaded.");
  }, []);

  useDeferredEffect(useCallback(() => { void load(); }, [load]));

  const nextMove = data?.nextGrowthMove as Row | null | undefined;
  const revenue = data?.revenueInMotion as Record<string, unknown> | undefined;
  const pipeline = data?.pipelineQuality as Record<string, unknown> | undefined;
  const opportunities = (data?.scoredOpportunities as Row[] | undefined) ?? [];
  const expansion = (data?.expansionCandidates as Row[] | undefined) ?? [];
  const dormant = (data?.dormantClients as Row[] | undefined) ?? [];
  const risks = (data?.growthRisks as Row[] | undefined) ?? [];
  const offers = (data?.offerMetrics as Row[] | undefined) ?? [];
  const experiments = (data?.activeExperiments as Row[] | undefined) ?? [];

  const currency = String(revenue?.currency ?? "MAD");
  const pipelineSignals = Array.isArray(pipeline?.qualitySignals)
    ? pipeline.qualitySignals.map(String).join(", ")
    : "";

  return (
    <main className="domain-page growth-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">V10 · Growth operating system</p>
          <h1>Growth.</h1>
          <p>
            {opportunities.length} open opportunities
            {pipelineSignals ? ` · Pipeline: ${pipelineSignals}` : ""}
          </p>
        </div>
        <div className="growth-header-actions">
          <Link href="/growth/pipeline"><Button emphasis="outline">Pipeline</Button></Link>
          <Link href="/growth/playbooks"><Button emphasis="outline">Playbooks</Button></Link>
          <Link href="/growth/reviews"><Button emphasis="outline">Reviews</Button></Link>
          <Link href="/growth/experiments"><Button intent="brand">Experiments</Button></Link>
        </div>
      </header>

      {error ? <p role="alert" className="field-error">{error}</p> : null}

      {/* Next best growth move */}
      {nextMove ? (
        <section className="growth-next data-surface">
          <p className="eyebrow">Next growth move</p>
          <h2>{String(nextMove.title)}</h2>
          <p>{String(nextMove.reason)}</p>
          {nextMove.route ? (
            <Link href={String(nextMove.route)} className="growth-next__cta">
              Take action →
            </Link>
          ) : null}
        </section>
      ) : null}

      {/* Revenue metrics */}
      {revenue ? (
        <div className="metric-ledger metric-ledger--four">
          <div>
            <strong>{fmt(Number(revenue.openPipeline ?? 0), currency)}</strong>
            <span>Open pipeline</span>
          </div>
          <div>
            <strong>{fmt(Number(revenue.wonThisMonth ?? 0), currency)}</strong>
            <span>Won this month</span>
          </div>
          <div>
            <strong>{fmt(Number(revenue.invoicedTotal ?? 0), currency)}</strong>
            <span>Invoiced total</span>
          </div>
          <div>
            <strong>{fmt(Number(revenue.collectedTotal ?? 0), currency)}</strong>
            <span>Collected</span>
          </div>
        </div>
      ) : null}

      <div className="growth-grid">
        {/* Pipeline opportunities */}
        <section className="data-surface growth-section">
          <header>
            <div>
              <p className="eyebrow">Deal health</p>
              <h2>Open opportunities</h2>
            </div>
            <Link href="/growth/pipeline"><Button emphasis="ghost">View pipeline</Button></Link>
          </header>
          {opportunities.length ? (
            <div className="signal-stack">
              {opportunities.slice(0, 6).map((opp) => {
                const intel = opp.intelligence as Record<string, unknown> | undefined;
                const health = String(intel?.health ?? "");
                return (
                  <div key={opp.id} className="signal-row growth-opp-row">
                    <Link href={`/pipeline`}>
                      <strong>{String(opp.title ?? "Untitled")}</strong>
                      <small>{String(opp.stage ?? "").replace(/_/g, " ")}</small>
                    </Link>
                    <span className={`growth-health-badge ${healthClass(health)}`}>{health || "–"}</span>
                    <em>{fmt(Number(opp.estimated_value ?? 0), String(opp.currency ?? currency))}</em>
                  </div>
                );
              })}
            </div>
          ) : <p className="dataset-note">No open opportunities. Add some in Pipeline.</p>}
        </section>

        {/* Expansion candidates */}
        <section className="data-surface growth-section">
          <header>
            <div>
              <p className="eyebrow">Expansion</p>
              <h2>Growth opportunities</h2>
            </div>
            <Link href="/pipeline"><Button emphasis="ghost">All</Button></Link>
          </header>
          {expansion.length ? (
            <div className="signal-stack">
              {expansion.map((c) => (
                <div key={c.id} className="signal-row">
                  <Link href="/pipeline">
                    <strong>{String(c.name ?? c.client_name ?? "Client")}</strong>
                    <small>{String(c.reason ?? "Expansion candidate")}</small>
                  </Link>
                </div>
              ))}
            </div>
          ) : <p className="dataset-note">No expansion candidates identified.</p>}
        </section>

        {/* Risks */}
        <section className="data-surface growth-section growth-section--full">
          <header>
            <div>
              <p className="eyebrow">Risk signals</p>
              <h2>Growth risks</h2>
            </div>
          </header>
          {risks.length ? (
            <div className="signal-stack">
              {risks.map((risk) => (
                <div key={String(risk.id)} className={`signal-row growth-risk-row ${severityClass(String(risk.severity ?? ""))}`}>
                  <strong>{String(risk.risk ?? "Risk")}</strong>
                  <p>{String(risk.evidence ?? "")}</p>
                  <small>{String(risk.recommendedAction ?? "")}</small>
                  {risk.affectedValue ? <em>{fmt(Number(risk.affectedValue), String(risk.currency ?? currency))}</em> : null}
                </div>
              ))}
            </div>
          ) : <p className="dataset-note">No active growth risks detected.</p>}
        </section>

        {/* Dormant clients */}
        <section className="data-surface growth-section">
          <header>
            <div>
              <p className="eyebrow">Reactivation</p>
              <h2>Dormant clients</h2>
            </div>
          </header>
          {dormant.length ? (
            <div className="signal-stack">
              {dormant.map((c) => (
                <div key={c.id} className="signal-row">
                  <span>
                    <strong>{String(c.name ?? "Client")}</strong>
                    <small>{String(c.reason ?? "No recent activity")}</small>
                  </span>
                </div>
              ))}
            </div>
          ) : <p className="dataset-note">No dormant clients identified.</p>}
        </section>

        {/* Top offers */}
        <section className="data-surface growth-section">
          <header>
            <div>
              <p className="eyebrow">Offer intelligence</p>
              <h2>Service performance</h2>
            </div>
            <Link href="/services"><Button emphasis="ghost">All</Button></Link>
          </header>
          {offers.length ? (
            <div className="signal-stack">
              {offers.map((o) => (
                <div key={String(o.service_id ?? o.name)} className="signal-row">
                  <span>
                    <strong>{String(o.name ?? "Service")}</strong>
                    <small>{String(o.proposalCount ?? 0)} proposals · {String(o.winRate ?? "0")}% win rate</small>
                  </span>
                  <em>{fmt(Number(o.totalRevenue ?? 0), currency)}</em>
                </div>
              ))}
            </div>
          ) : <p className="dataset-note">No service performance data yet.</p>}
        </section>
      </div>

      {/* Active experiments */}
      {experiments.length > 0 ? (
        <section className="data-surface growth-section growth-section--full">
          <header>
            <div>
              <p className="eyebrow">Running now</p>
              <h2>Active experiments</h2>
            </div>
            <Link href="/growth/experiments"><Button emphasis="ghost">All experiments</Button></Link>
          </header>
          <div className="growth-experiments-strip">
            {experiments.map((exp) => (
              <div key={exp.id} className="growth-experiment-card">
                <p className="eyebrow">{String(exp.status ?? "running")}</p>
                <strong>{String(exp.name ?? "Experiment")}</strong>
                <small>{String(exp.hypothesis ?? "")}</small>
                {exp.target_metric ? <em>Target: {String(exp.target_metric)}</em> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Navigation strip */}
      <nav className="growth-nav-strip" aria-label="Growth sections">
        <Link href="/growth/pipeline">
          <span>Pipeline</span>
          <small>Scored opportunities & deal health</small>
        </Link>
        <Link href="/growth/playbooks">
          <span>Playbooks</span>
          <small>Sales engagement sequences</small>
        </Link>
        <Link href="/growth/experiments">
          <span>Experiments</span>
          <small>Test hypotheses, measure impact</small>
        </Link>
        <Link href="/growth/forecast">
          <span>Forecast</span>
          <small>Committed / Likely / Possible</small>
        </Link>
        <Link href="/growth/reviews">
          <span>Reviews & Targets</span>
          <small>Deal retrospectives & targets</small>
        </Link>
      </nav>
    </main>
  );
}

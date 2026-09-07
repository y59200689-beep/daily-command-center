"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useDeferredEffect } from "@/lib/use-deferred-effect";

type Row = Record<string, unknown> & { id: string };

function fmt(n: number, currency = "MAD") {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M ${currency}`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k ${currency}`;
  return `${n} ${currency}`;
}

export function GrowthReviews() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Review form state
  const [selectedOppId, setSelectedOppId] = useState("");
  const [reviewType, setReviewType] = useState<"won" | "lost">("won");
  const [reason, setReason] = useState("timing");
  const [competitor, setCompetitor] = useState("");
  const [lessons, setLessons] = useState("");
  const [whyWeWon, setWhyWeWon] = useState("");
  const [whatHelped, setWhatHelped] = useState("");
  const [potentialExpansion, setPotentialExpansion] = useState("");
  const [couldReactivate, setCouldReactivate] = useState(false);

  // Target form state
  const [metricType, setMetricType] = useState("monthly_revenue");
  const [targetValue, setTargetValue] = useState("");
  const [period, setPeriod] = useState<"week" | "month" | "quarter" | "year">("month");
  const [periodStart, setPeriodStart] = useState(new Date().toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  );

  const load = useCallback(async () => {
    const res = await fetch("/api/growth/reviews", { cache: "no-store" });
    const body = await res.json();
    if (res.ok) setData(body);
    else setError(body.error ?? "Growth review could not be loaded.");
  }, []);

  useDeferredEffect(useCallback(() => { void load(); }, [load]));

  async function submitDealReview(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOppId) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/growth/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opportunity_id: selectedOppId,
          review_type: reviewType,
          reason: reviewType === "lost" ? reason : null,
          competitor: reviewType === "lost" ? competitor || null : null,
          lessons: lessons || null,
          could_reactivate_later: couldReactivate,
          why_we_won: reviewType === "won" ? whyWeWon || null : null,
          what_helped: reviewType === "won" ? whatHelped || null : null,
          potential_expansion: reviewType === "won" ? potentialExpansion || null : null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to save deal review.");
      setReviewOpen(false);
      resetReviewForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function submitTarget(e: React.FormEvent) {
    e.preventDefault();
    if (!targetValue) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/growth/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metric_type: metricType,
          target_value: Number(targetValue),
          period,
          period_start: periodStart,
          period_end: periodEnd,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to save sales target.");
      setTargetOpen(false);
      setTargetValue("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Target save failed.");
    } finally {
      setSaving(false);
    }
  }

  function resetReviewForm() {
    setSelectedOppId("");
    setReviewType("won");
    setReason("timing");
    setCompetitor("");
    setLessons("");
    setWhyWeWon("");
    setWhatHelped("");
    setPotentialExpansion("");
    setCouldReactivate(false);
  }

  const dealsAtRisk = (data?.dealsAtRisk as Row[] | undefined) ?? [];
  const targets = (data?.targets as Row[] | undefined) ?? [];
  const dealReviews = (data?.dealReviews as Row[] | undefined) ?? [];
  const channels = ((data?.channels as Record<string, unknown>)?.channels as Row[] | undefined) ?? [];
  const nextMove = data?.nextGrowthMove as Row | null | undefined;

  return (
    <main className="domain-page growth-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Growth · Retrospectives & Planning</p>
          <h1>Growth reviews.</h1>
          <p>Systematic deal post-mortems, sales targets, and channel intelligence.</p>
        </div>
        <div className="growth-header-actions">
          <Button intent="brand" onClick={() => setReviewOpen(true)}>Record deal review</Button>
          <Button emphasis="outline" onClick={() => setTargetOpen(true)}>+ Set sales target</Button>
        </div>
      </header>

      {error ? <p role="alert" className="field-error">{error}</p> : null}

      {/* Next move */}
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

      <div className="growth-grid">
        {/* Sales Targets */}
        <section className="data-surface growth-section">
          <header>
            <div>
              <p className="eyebrow">Targets</p>
              <h2>Commercial targets</h2>
            </div>
            <Button emphasis="ghost" onClick={() => setTargetOpen(true)}>+ New</Button>
          </header>
          {targets.length ? (
            <div className="signal-stack">
              {targets.map((t) => {
                const targetVal = Number(t.target_value ?? 0);
                const currentVal = Number(t.current_value ?? 0);
                const pct = targetVal > 0 ? Math.min(100, Math.round((currentVal / targetVal) * 100)) : 0;
                return (
                  <div key={t.id} className="signal-row">
                    <div>
                      <strong>{String(t.metric_type ?? "").replace(/_/g, " ")}</strong>
                      <small>{String(t.period)} · {String(t.period_start)} to {String(t.period_end)}</small>
                    </div>
                    <em>{fmt(currentVal, String(t.currency ?? "MAD"))} / {fmt(targetVal, String(t.currency ?? "MAD"))} ({pct}%)</em>
                  </div>
                );
              })}
            </div>
          ) : <p className="dataset-note">No active sales targets set. Create one above.</p>}
        </section>

        {/* Deals at risk */}
        <section className="data-surface growth-section">
          <header>
            <div>
              <p className="eyebrow">Attention</p>
              <h2>Deals at risk</h2>
            </div>
            <Link href="/growth/pipeline"><Button emphasis="ghost">Pipeline</Button></Link>
          </header>
          {dealsAtRisk.length ? (
            <div className="signal-stack">
              {dealsAtRisk.map((opp) => (
                <div key={opp.id} className="signal-row">
                  <div>
                    <strong>{String(opp.title ?? "Deal")}</strong>
                    <small>{String(opp.stage ?? "").replace(/_/g, " ")}</small>
                  </div>
                  <div className="integration-actions">
                    <em>{fmt(Number(opp.estimated_value ?? 0), String(opp.currency ?? "MAD"))}</em>
                    <Button
                      emphasis="ghost"
                      onClick={() => {
                        setSelectedOppId(opp.id);
                        setReviewOpen(true);
                      }}
                    >
                      Review
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="dataset-note">No deals currently flagged as stalled or at risk.</p>}
        </section>
      </div>

      {/* Deal Reviews Log */}
      <section className="data-surface growth-section growth-section--full">
        <header>
          <div>
            <p className="eyebrow">Retrospectives</p>
            <h2>Recorded deal reviews</h2>
          </div>
        </header>
        {dealReviews.length ? (
          <div className="signal-stack">
            {dealReviews.map((rev) => (
              <div key={rev.id} className="signal-row">
                <div>
                  <strong>
                    <span className={`growth-status-badge ${rev.review_type === "won" ? "growth-status--completed" : "growth-status--cancelled"}`}>
                      {String(rev.review_type).toUpperCase()}
                    </span>{" "}
                    {rev.review_type === "won" ? String(rev.why_we_won ?? "Deal Won") : `Lost: ${String(rev.reason ?? "Unknown reason")}`}
                  </strong>
                  {rev.lessons ? <p><small>Lessons: {String(rev.lessons)}</small></p> : null}
                  {rev.what_helped ? <p><small>What helped: {String(rev.what_helped)}</small></p> : null}
                  {rev.potential_expansion ? <p><small>Expansion path: {String(rev.potential_expansion)}</small></p> : null}
                </div>
                <em>Reviewed {String(rev.review_date ?? "")}</em>
              </div>
            ))}
          </div>
        ) : <p className="dataset-note">No deal reviews logged yet. Record a won or lost deal review to capture insights.</p>}
      </section>

      {/* Channel Intelligence */}
      {channels.length ? (
        <section className="data-surface growth-section growth-section--full">
          <header>
            <div>
              <p className="eyebrow">Attribution</p>
              <h2>Channel performance</h2>
            </div>
          </header>
          <div className="metric-ledger metric-ledger--four">
            {channels.slice(0, 4).map((c) => (
              <div key={String(c.channel)}>
                <strong>{String(c.leadCount ?? 0)} leads · {String(c.winCount ?? 0)} won</strong>
                <span>{String(c.channel)} ({fmt(Number(c.revenue ?? 0))} won)</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Deal Review Modal */}
      {reviewOpen ? (
        <Modal open onClose={() => { setReviewOpen(false); resetReviewForm(); }} title="Record deal review">
          <form className="simple-form" onSubmit={submitDealReview}>
            <label htmlFor="rev-type">Review outcome</label>
            <select
              id="rev-type"
              value={reviewType}
              onChange={(e) => setReviewType(e.target.value as "won" | "lost")}
            >
              <option value="won">Won deal retrospective</option>
              <option value="lost">Lost deal post-mortem</option>
            </select>

            <label htmlFor="rev-opp">Opportunity ID</label>
            <input
              id="rev-opp"
              required
              placeholder="Paste opportunity UUID"
              value={selectedOppId}
              onChange={(e) => setSelectedOppId(e.target.value)}
            />

            {reviewType === "lost" ? (
              <>
                <label htmlFor="rev-reason">Primary lost reason</label>
                <select id="rev-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
                  <option value="price">Price too high</option>
                  <option value="timing">Bad timing / deferred</option>
                  <option value="budget">No allocated budget</option>
                  <option value="scope">Scope mismatch</option>
                  <option value="no_response">Ghosted / no response</option>
                  <option value="internal_decision">Internal change of direction</option>
                  <option value="not_a_fit">Not a qualified fit</option>
                  <option value="competitor">Chosen competitor</option>
                  <option value="other">Other</option>
                </select>

                <label htmlFor="rev-competitor">Competitor (if any)</label>
                <input
                  id="rev-competitor"
                  placeholder="Competitor name"
                  value={competitor}
                  onChange={(e) => setCompetitor(e.target.value)}
                />

                <label htmlFor="rev-reactivate">
                  <input
                    type="checkbox"
                    id="rev-reactivate"
                    checked={couldReactivate}
                    onChange={(e) => setCouldReactivate(e.target.checked)}
                  />{" "}
                  Could reactivate in 3–6 months
                </label>
              </>
            ) : (
              <>
                <label htmlFor="rev-why">Why did we win?</label>
                <textarea
                  id="rev-why"
                  rows={2}
                  placeholder="Key differentiators that closed the deal"
                  value={whyWeWon}
                  onChange={(e) => setWhyWeWon(e.target.value)}
                />

                <label htmlFor="rev-helped">What sales asset or action helped?</label>
                <input
                  id="rev-helped"
                  placeholder="e.g. Case study, demo call, fast proposal turnaround"
                  value={whatHelped}
                  onChange={(e) => setWhatHelped(e.target.value)}
                />

                <label htmlFor="rev-expansion">Future expansion opportunity</label>
                <input
                  id="rev-expansion"
                  placeholder="e.g. Phase 2 rollout, maintenance retainer"
                  value={potentialExpansion}
                  onChange={(e) => setPotentialExpansion(e.target.value)}
                />
              </>
            )}

            <label htmlFor="rev-lessons">Lessons learned & notes</label>
            <textarea
              id="rev-lessons"
              rows={3}
              placeholder="What to do differently or repeat next time"
              value={lessons}
              onChange={(e) => setLessons(e.target.value)}
            />

            <div className="modal__actions">
              <Button emphasis="ghost" onClick={() => { setReviewOpen(false); resetReviewForm(); }}>Cancel</Button>
              <Button intent="brand" type="submit" disabled={saving}>{saving ? "Saving…" : "Save review"}</Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {/* Target Modal */}
      {targetOpen ? (
        <Modal open onClose={() => setTargetOpen(false)} title="Set sales target">
          <form className="simple-form" onSubmit={submitTarget}>
            <label htmlFor="target-metric">Metric</label>
            <select
              id="target-metric"
              value={metricType}
              onChange={(e) => setMetricType(e.target.value)}
            >
              <option value="monthly_revenue">Monthly revenue</option>
              <option value="pipeline_generated">Pipeline generated</option>
              <option value="deals_won">Deals won</option>
              <option value="proposals_sent">Proposals sent</option>
              <option value="qualified_leads">Qualified leads</option>
              <option value="new_leads">New leads</option>
              <option value="expansion_revenue">Expansion revenue</option>
            </select>

            <label htmlFor="target-val">Target value</label>
            <input
              id="target-val"
              type="number"
              required
              min={0}
              placeholder="Target amount or count"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
            />

            <label htmlFor="target-period">Period</label>
            <select
              id="target-period"
              value={period}
              onChange={(e) => setPeriod(e.target.value as "week" | "month" | "quarter" | "year")}
            >
              <option value="week">Week</option>
              <option value="month">Month</option>
              <option value="quarter">Quarter</option>
              <option value="year">Year</option>
            </select>

            <label htmlFor="target-start">Period start</label>
            <input
              id="target-start"
              type="date"
              required
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
            />

            <label htmlFor="target-end">Period end</label>
            <input
              id="target-end"
              type="date"
              required
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
            />

            <div className="modal__actions">
              <Button emphasis="ghost" onClick={() => setTargetOpen(false)}>Cancel</Button>
              <Button intent="brand" type="submit" disabled={saving}>{saving ? "Saving…" : "Save target"}</Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </main>
  );
}

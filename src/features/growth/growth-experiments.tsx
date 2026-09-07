"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useDeferredEffect } from "@/lib/use-deferred-effect";

type Experiment = {
  id: string;
  name: string;
  hypothesis: string;
  target_metric: string;
  channel?: string | null;
  offer?: string | null;
  audience?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  budget?: number | null;
  currency: string;
  status: string;
  outcome?: string | null;
  result_summary?: string | null;
  notes?: string | null;
};

const STATUS_ORDER = ["running", "planned", "idea", "completed", "cancelled"];
const STATUS_LABELS: Record<string, string> = {
  idea: "Idea", planned: "Planned", running: "Running",
  completed: "Completed", cancelled: "Cancelled",
};

function statusClass(s: string) {
  if (s === "running") return "status--active";
  if (s === "planned") return "status--pending";
  if (s === "completed") return "status--success";
  if (s === "cancelled") return "status--muted";
  return "";
}

export function GrowthExperiments() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // form
  const [name, setName] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [metric, setMetric] = useState("");
  const [channel, setChannel] = useState("");
  const [audience, setAudience] = useState("");
  const [status, setStatus] = useState<Experiment["status"]>("idea");
  const [budget, setBudget] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/growth/experiments", { cache: "no-store" });
    const body = await res.json();
    if (res.ok) setExperiments(body.experiments ?? []);
    else setError(body.error ?? "Experiments could not be loaded.");
  }, []);

  useDeferredEffect(useCallback(() => { void load(); }, [load]));

  function resetForm() {
    setName(""); setHypothesis(""); setMetric(""); setChannel("");
    setAudience(""); setStatus("idea"); setBudget("");
  }

  async function create() {
    if (!name.trim() || !hypothesis.trim() || !metric.trim()) return;
    setSaving(true);
    const res = await fetch("/api/growth/experiments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, hypothesis, target_metric: metric,
        channel: channel || null, audience: audience || null,
        status, budget: budget ? Number(budget) : null, currency: "MAD",
      }),
    });
    setSaving(false);
    if (res.ok) { resetForm(); setOpen(false); await load(); }
    else setError("Experiment could not be saved.");
  }

  const visible = experiments
    .filter((e) => filter === "all" || e.status === filter)
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));

  const statuses = [...new Set(experiments.map((e) => e.status))];

  return (
    <main className="domain-page growth-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Growth · Experiments</p>
          <h1>Growth experiments.</h1>
          <p>
            {experiments.filter((e) => e.status === "running").length} running ·{" "}
            {experiments.filter((e) => e.status === "planned").length} planned ·{" "}
            {experiments.length} total
          </p>
        </div>
        <Button intent="brand" onClick={() => setOpen(true)}>New experiment</Button>
      </header>

      {error ? <p role="alert" className="field-error">{error}</p> : null}

      {/* Filter strip */}
      <div className="content-stage-strip" role="tablist" aria-label="Experiment status">
        <button role="tab" aria-selected={filter === "all"} className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All</button>
        {statuses.sort((a, b) => STATUS_ORDER.indexOf(a) - STATUS_ORDER.indexOf(b)).map((s) => (
          <button key={s} role="tab" aria-selected={filter === s} className={filter === s ? "active" : ""} onClick={() => setFilter(s)}>
            {STATUS_LABELS[s] ?? s}
          </button>
        ))}
      </div>

      <section className="data-surface">
        {visible.length ? (
          <div className="growth-experiments-list">
            {visible.map((exp) => (
              <div key={exp.id} className="growth-experiment-detail">
                <div className="growth-experiment-detail__head">
                  <div>
                    <strong>{exp.name}</strong>
                    <span className={`growth-status-badge ${statusClass(exp.status)}`}>
                      {STATUS_LABELS[exp.status] ?? exp.status}
                    </span>
                  </div>
                  <div className="growth-experiment-detail__meta">
                    {exp.channel ? <em>Channel: {exp.channel}</em> : null}
                    {exp.audience ? <em>Audience: {exp.audience}</em> : null}
                    {exp.budget ? <em>Budget: {exp.budget} {exp.currency}</em> : null}
                  </div>
                </div>
                <p className="growth-experiment-detail__hypothesis">{exp.hypothesis}</p>
                <div className="growth-experiment-detail__metric">
                  <span className="eyebrow">Target metric</span>
                  <span>{exp.target_metric}</span>
                </div>
                {exp.result_summary ? (
                  <div className="growth-experiment-detail__result">
                    <span className="eyebrow">Result</span>
                    <p>{exp.result_summary}</p>
                  </div>
                ) : null}
                {exp.outcome ? <p className="growth-experiment-detail__outcome">{exp.outcome}</p> : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="dataset-note">No experiments match this filter. Log a hypothesis to get started.</p>
        )}
      </section>

      <Modal open={open} onClose={() => { setOpen(false); resetForm(); }} title="New growth experiment" description="State a testable hypothesis and define what you'll measure.">
        <form className="simple-form" onSubmit={(e) => { e.preventDefault(); void create(); }} noValidate>
          <label>
            Experiment name
            <input required value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <label>
            Hypothesis
            <textarea required value={hypothesis} onChange={(e) => setHypothesis(e.target.value)} rows={3} placeholder="If we do X, we expect Y because Z." />
          </label>
          <label>
            Target metric
            <input required value={metric} onChange={(e) => setMetric(e.target.value)} placeholder="e.g. Proposal acceptance rate" />
          </label>
          <label>
            Channel (optional)
            <input value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="e.g. WhatsApp, Email" />
          </label>
          <label>
            Audience (optional)
            <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. Warm leads over 50k MAD" />
          </label>
          <label>
            Budget (MAD, optional)
            <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} min="0" />
          </label>
          <label>
            Initial status
            <select value={status} onChange={(e) => setStatus(e.target.value as Experiment["status"])}>
              <option value="idea">Idea</option>
              <option value="planned">Planned</option>
              <option value="running">Running</option>
            </select>
          </label>
          <div className="modal__actions">
            <Button emphasis="ghost" onClick={() => { setOpen(false); resetForm(); }}>Cancel</Button>
            <Button intent="brand" type="submit" disabled={saving}>{saving ? "Saving…" : "Log experiment"}</Button>
          </div>
        </form>
      </Modal>
    </main>
  );
}

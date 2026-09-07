"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useDeferredEffect } from "@/lib/use-deferred-effect";

type Playbook = {
  id: string;
  name: string;
  purpose?: string | null;
  target_type: string;
  status: string;
  steps: Array<{ day: number; title: string; channel?: string | null; description?: string | null }>;
};

type Run = {
  id: string;
  playbook_id: string;
  status: string;
  started_at: string;
  sales_playbooks?: { name: string } | null;
};

const CHANNELS = ["email", "whatsapp", "call", "meeting", "linkedin", "other"] as const;
const TARGET_TYPES = ["lead", "opportunity", "client"] as const;

function emptyStep() {
  return { day: 0, title: "", channel: "email" as string, description: "" };
}

export function GrowthPlaybooks() {
  const [data, setData] = useState<{ playbooks?: Playbook[]; runs?: Run[] } | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // form state
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [targetType, setTargetType] = useState<"lead" | "opportunity" | "client">("lead");
  const [channel, setChannel] = useState<string>("email");
  const [steps, setSteps] = useState([emptyStep()]);

  const load = useCallback(async () => {
    const res = await fetch("/api/growth/playbooks", { cache: "no-store" });
    const body = await res.json();
    if (res.ok) setData(body);
    else setError(body.error ?? "Playbooks could not be loaded.");
  }, []);

  useDeferredEffect(useCallback(() => { void load(); }, [load]));

  function resetForm() {
    setName(""); setPurpose(""); setTargetType("lead"); setChannel("email");
    setSteps([emptyStep()]);
  }

  async function create() {
    if (!name.trim() || steps.some((s) => !s.title.trim())) return;
    setSaving(true);
    const res = await fetch("/api/growth/playbooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, purpose: purpose || null, target_type: targetType,
        steps: steps.map((s, i) => ({ ...s, day: i * 2 })),
        suggested_channel: channel,
      }),
    });
    setSaving(false);
    if (res.ok) { resetForm(); setOpen(false); await load(); }
    else setError("Playbook could not be saved.");
  }

  const playbooks = data?.playbooks ?? [];
  const runs = data?.runs ?? [];

  return (
    <main className="domain-page growth-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Growth · Playbooks</p>
          <h1>Sales playbooks.</h1>
          <p>{playbooks.length} playbooks · {runs.filter((r) => r.status === "active").length} active runs</p>
        </div>
        <Button intent="brand" onClick={() => setOpen(true)}>New playbook</Button>
      </header>

      {error ? <p role="alert" className="field-error">{error}</p> : null}

      <div className="growth-grid">
        <section className="data-surface growth-section growth-section--full">
          <p className="eyebrow">Your playbooks</p>
          {playbooks.length ? (
            <div className="signal-stack">
              {playbooks.map((pb) => (
                <div key={pb.id} className="signal-row growth-playbook-row">
                  <div>
                    <strong>{pb.name}</strong>
                    <small>{pb.target_type} · {pb.steps.length} steps · {pb.status}</small>
                    {pb.purpose ? <p>{pb.purpose}</p> : null}
                  </div>
                  <div className="growth-playbook-steps">
                    {pb.steps.map((step, i) => (
                      <span key={i} className="growth-step-badge">
                        Day {step.day}: {step.title}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="dataset-note">No playbooks yet. Create your first sales engagement sequence.</p>}
        </section>

        {runs.length > 0 ? (
          <section className="data-surface growth-section growth-section--full">
            <p className="eyebrow">Recent runs</p>
            <div className="signal-stack">
              {runs.slice(0, 10).map((run) => (
                <div key={run.id} className="signal-row">
                  <strong>{run.sales_playbooks?.name ?? "Playbook"}</strong>
                  <small>{run.status} · Started {run.started_at?.slice(0, 10)}</small>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <Modal open={open} onClose={() => { setOpen(false); resetForm(); }} title="New sales playbook" description="Define a sequence of touchpoints to work a lead, opportunity, or client.">
        <form className="simple-form" onSubmit={(e) => { e.preventDefault(); void create(); }} noValidate>
          <label>
            Playbook name
            <input required value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <label>
            Purpose (optional)
            <textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={2} />
          </label>
          <label>
            Target type
            <select value={targetType} onChange={(e) => setTargetType(e.target.value as typeof targetType)}>
              {TARGET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label>
            Suggested channel
            <select value={channel} onChange={(e) => setChannel(e.target.value)}>
              {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>

          <fieldset className="knowledge-checklist">
            <legend>Steps</legend>
            {steps.map((step, i) => (
              <div key={i} style={{ display: "grid", gap: "6px", paddingBottom: "10px", borderBottom: "1px solid var(--line)" }}>
                <input
                  placeholder={`Step ${i + 1} title`}
                  value={step.title}
                  onChange={(e) => setSteps(steps.map((s, j) => j === i ? { ...s, title: e.target.value } : s))}
                />
                <select
                  value={step.channel ?? "email"}
                  onChange={(e) => setSteps(steps.map((s, j) => j === i ? { ...s, channel: e.target.value } : s))}
                >
                  {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            ))}
            <Button
              emphasis="ghost"
              type="button"
              onClick={() => setSteps([...steps, emptyStep()])}
            >
              + Add step
            </Button>
          </fieldset>

          <div className="modal__actions">
            <Button emphasis="ghost" onClick={() => { setOpen(false); resetForm(); }}>Cancel</Button>
            <Button intent="brand" type="submit" disabled={saving}>{saving ? "Saving…" : "Create playbook"}</Button>
          </div>
        </form>
      </Modal>
    </main>
  );
}

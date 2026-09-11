"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDeferredEffect } from "@/lib/use-deferred-effect";

type RunbookRow = Record<string, unknown> & { id: string };

export function RunbooksView() {
  const [runbooks, setRunbooks] = useState<RunbookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [schemaUnavailable, setSchemaUnavailable] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [triggerCondition, setTriggerCondition] = useState("");
  const [mitigationSteps, setMitigationSteps] = useState("");
  const [escalationPath, setEscalationPath] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/operations/runbooks", { cache: "no-store" });
      const body = await res.json();
      if (res.ok) {
        setSchemaUnavailable(body.schemaStatus === "unavailable");
        setRunbooks(body.runbooks || []);
      } else {
        setError(body.error || "Failed to load runbooks");
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useDeferredEffect(useCallback(() => { void load(); }, [load]));

  const handleCreateRunbook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      const res = await fetch("/api/operations/runbooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          trigger_conditions: triggerCondition.trim() || null,
          mitigation_steps: mitigationSteps.trim() || null,
          escalation_path: escalationPath.trim() || null,
        }),
      });
      if (res.ok) {
        setShowModal(false);
        setTitle("");
        setTriggerCondition("");
        setMitigationSteps("");
        setEscalationPath("");
        void load();
      } else {
        const body = await res.json();
        setError(body.error || "Failed to create runbook");
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  return (
    <main className="domain-page operations-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Operations · Incident Mitigation</p>
          <h1>Emergency Runbooks.</h1>
          <p>
            {runbooks.length} mitigation runbook{runbooks.length === 1 ? "" : "s"} · Standardized procedures for unexpected failure states
          </p>
        </div>
        <div className="operations-header-actions">
          <Link href="/operations"><Button emphasis="outline">Overview</Button></Link>
          <Link href="/operations/systems"><Button emphasis="outline">Systems</Button></Link>
          {!schemaUnavailable ? <Button intent="brand" onClick={() => setShowModal(true)}>New Runbook</Button> : null}
        </div>
      </header>

      {error ? <p role="alert" className="field-error">{error}</p> : null}

      {schemaUnavailable ? (
        <section className="data-surface empty-state">
          <h2>Emergency Runbooks are unavailable</h2>
          <p>This workspace is missing the optional V11 operations schema. Runbook creation will be available after that dependency is installed.</p>
        </section>
      ) : <div className="data-surface">
        {loading ? (
          <p className="faint-note">Loading runbooks...</p>
        ) : runbooks.length === 0 ? (
          <p className="faint-note">No emergency runbooks created yet.</p>
        ) : (
          runbooks.map((rb) => (
            <div key={rb.id} className="operations-row" style={{ gridTemplateColumns: "1fr auto" }}>
              <div>
                <strong>{String(rb.title)}</strong>
                <small>
                  Trigger: {String(rb.trigger_conditions || "Manual trigger")}
                  {rb.escalation_path ? ` · Escalation: ${String(rb.escalation_path)}` : ""}
                </small>
                {Boolean(rb.mitigation_steps) && (
                  <p style={{ marginTop: "6px", fontSize: "12px", color: "var(--muted)", whiteSpace: "pre-wrap" }}>
                    {String(rb.mitigation_steps)}
                  </p>
                )}

              </div>
              <span className="operations-badge badge--warning">Active Runbook</span>
            </div>
          ))
        )}
      </div>}

      {showModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h2>Create Emergency Runbook</h2>
            <form onSubmit={handleCreateRunbook}>
              <label>
                Runbook Title
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Payment Gateway Outage Protocol"
                />
              </label>
              <label>
                Trigger Conditions
                <textarea
                  rows={2}
                  value={triggerCondition}
                  onChange={(e) => setTriggerCondition(e.target.value)}
                  placeholder="e.g. Stripe webhook failures > 5 in 10 minutes"
                />
              </label>
              <label>
                Mitigation Steps
                <textarea
                  rows={5}
                  value={mitigationSteps}
                  onChange={(e) => setMitigationSteps(e.target.value)}
                  placeholder="1. Check status page&#10;2. Switch fallback gateway&#10;3. Notify client..."
                />
              </label>
              <label>
                Escalation Path
                <input
                  type="text"
                  value={escalationPath}
                  onChange={(e) => setEscalationPath(e.target.value)}
                  placeholder="e.g. Call Tech Lead immediately via WhatsApp"
                />
              </label>
              <div className="modal__actions">
                <Button type="button" emphasis="outline" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" intent="brand">
                  Save Runbook
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

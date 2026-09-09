"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDeferredEffect } from "@/lib/use-deferred-effect";

type IncidentRow = Record<string, unknown> & { id: string };

function severityBadgeClass(s: string) {
  if (s === "Critical") return "badge--danger";
  if (s === "Major") return "badge--warning";
  return "badge--muted";
}

export function QualityCenter() {
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState("Major");
  const [rootCause, setRootCause] = useState("");
  const [impactSummary, setImpactSummary] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/operations/quality", { cache: "no-store" });
      const body = await res.json();
      if (res.ok) {
        setIncidents(body.incidents || []);
      } else {
        setError(body.error || "Failed to load quality incidents");
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useDeferredEffect(useCallback(() => { void load(); }, [load]));

  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      const res = await fetch("/api/operations/quality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          severity,
          root_cause: rootCause.trim() || null,
          impact_summary: impactSummary.trim() || null,
        }),
      });
      if (res.ok) {
        setShowModal(false);
        setTitle("");
        setRootCause("");
        setImpactSummary("");
        void load();
      } else {
        const body = await res.json();
        setError(body.error || "Failed to create quality incident");
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  const handleResolveIncident = async (id: string) => {
    try {
      const res = await fetch(`/api/operations/quality/incidents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "Resolved",
          resolution_summary: "Resolved during quality inspection",
        }),
      });
      if (res.ok) {
        void load();
      } else {
        const body = await res.json();
        setError(body.error || "Failed to resolve incident");
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  return (
    <main className="domain-page operations-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Operations · Quality & Reliability</p>
          <h1>Quality Center.</h1>
          <p>
            {incidents.length} logged incident{incidents.length === 1 ? "" : "s"} · Defect tracking, root cause analysis & corrective actions
          </p>
        </div>
        <div className="operations-header-actions">
          <Link href="/operations"><Button emphasis="outline">Overview</Button></Link>
          <Button intent="brand" onClick={() => setShowModal(true)}>Log Incident</Button>
        </div>
      </header>

      {error ? <p role="alert" className="field-error">{error}</p> : null}

      <div className="data-surface">
        {loading ? (
          <p className="faint-note">Loading quality logs...</p>
        ) : incidents.length === 0 ? (
          <p className="faint-note">No quality incidents logged. Excellent quality hygiene.</p>
        ) : (
          incidents.map((inc) => (
            <div key={inc.id} className="operations-row">
              <div>
                <strong>{String(inc.title)}</strong>
                <small>
                  {inc.root_cause ? `Root cause: ${String(inc.root_cause)} · ` : ""}
                  Logged {new Date(String(inc.created_at)).toLocaleDateString()}
                  {inc.resolution_summary ? ` · Resolution: ${String(inc.resolution_summary)}` : ""}
                </small>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span className={`operations-badge ${severityBadgeClass(String(inc.severity))}`}>
                  {String(inc.severity)}
                </span>
                <span className="operations-badge badge--muted">
                  {String(inc.status || "Open")}
                </span>
                {inc.status !== "Resolved" && (
                  <Button emphasis="ghost" onClick={() => void handleResolveIncident(inc.id)}>
                    Resolve
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h2>Log Quality Incident</h2>
            <form onSubmit={handleCreateIncident}>
              <label>
                Title / Symptom
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Broken links in weekly client deliverable"
                />
              </label>
              <label>
                Severity
                <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
                  <option value="Minor">Minor</option>
                  <option value="Major">Major</option>
                  <option value="Critical">Critical</option>
                </select>
              </label>
              <label>
                Impact Summary
                <textarea
                  rows={3}
                  value={impactSummary}
                  onChange={(e) => setImpactSummary(e.target.value)}
                  placeholder="What was delayed or compromised?"
                />
              </label>
              <label>
                Root Cause Analysis
                <textarea
                  rows={3}
                  value={rootCause}
                  onChange={(e) => setRootCause(e.target.value)}
                  placeholder="Why did this failure occur?"
                />
              </label>
              <div className="modal__actions">
                <Button type="button" emphasis="outline" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" intent="brand">
                  Log Incident
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

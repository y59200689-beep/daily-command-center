"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDeferredEffect } from "@/lib/use-deferred-effect";

type ReviewData = {
  review?: {
    runs_total: number;
    runs_completed: number;
    runs_failed: number;
    runs_blocked: number;
    completion_rate: number;
    quality_incidents: number;
    sops_reviewed: number;
    sops_due: number;
    improvements_active: number;
    repeated_failures_detected: number;
  };
  improvements?: Array<Record<string, unknown> & { id: string }>;
};

function statusBadgeClass(s: string) {
  if (s === "Adopted") return "badge--healthy";
  if (s === "Testing" || s === "Approved") return "badge--warning";
  if (s === "Rejected") return "badge--danger";
  return "badge--muted";
}

export function OperationsReview() {
  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [periodType, setPeriodType] = useState<"weekly" | "monthly">("weekly");
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [problem, setProblem] = useState("");
  const [solution, setSolution] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/operations/review?period_type=${periodType}`, { cache: "no-store" });
      const body = await res.json();
      if (res.ok) {
        setData(body);
      } else {
        setError(body.error || "Failed to load review data");
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [periodType]);

  useDeferredEffect(useCallback(() => { void load(); }, [load]));

  const handleCreateImprovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      const res = await fetch("/api/operations/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          problem_statement: problem.trim() || null,
          proposed_solution: solution.trim() || null,
          status: "Reviewing",
        }),
      });
      if (res.ok) {
        setShowModal(false);
        setTitle("");
        setProblem("");
        setSolution("");
        void load();
      } else {
        const body = await res.json();
        setError(body.error || "Failed to create improvement proposal");
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/operations/improvements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        void load();
      } else {
        const body = await res.json();
        setError(body.error || "Failed to update improvement status");
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  const rev = data?.review;
  const improvements = data?.improvements || [];

  return (
    <main className="domain-page operations-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Operations · Cadence & Continuous Improvement</p>
          <h1>Operations Review.</h1>
          <p>
            Systematic retrospective of operational performance, defect trends & process evolution
          </p>
        </div>
        <div className="operations-header-actions">
          <Link href="/operations"><Button emphasis="outline">Overview</Button></Link>
          <Button intent="brand" onClick={() => setShowModal(true)}>Propose Improvement</Button>
        </div>
      </header>

      {error ? <p role="alert" className="field-error">{error}</p> : null}

      {/* Cadence switch */}
      <div className="strategy-filters">
        <button
          type="button"
          aria-pressed={periodType === "weekly"}
          onClick={() => setPeriodType("weekly")}
        >
          Weekly Cadence
        </button>
        <button
          type="button"
          aria-pressed={periodType === "monthly"}
          onClick={() => setPeriodType("monthly")}
        >
          Monthly Retrospective
        </button>
      </div>

      {/* Review Metrics Ledger */}
      {rev && (
        <div className="metric-ledger metric-ledger--four">
          <div>
            <strong>{Math.round(rev.completion_rate * 100)}%</strong>
            <span>Completion rate</span>
          </div>
          <div>
            <strong>{rev.runs_completed} / {rev.runs_total}</strong>
            <span>Runs finished</span>
          </div>
          <div>
            <strong>{rev.quality_incidents}</strong>
            <span>Quality incidents</span>
          </div>
          <div>
            <strong>{rev.sops_due}</strong>
            <span>SOP reviews due</span>
          </div>
        </div>
      )}

      {/* Continuous Improvements Table */}
      <section className="operations-section operations-section--full data-surface">
        <header>
          <div>
            <p className="eyebrow">Continuous Improvement</p>
            <h2>Kaizen Backlog ({improvements.length})</h2>
          </div>
          <Button emphasis="ghost" onClick={() => setShowModal(true)}>+ New Item</Button>
        </header>

        {loading ? (
          <p className="faint-note">Loading improvements...</p>
        ) : improvements.length === 0 ? (
          <p className="faint-note">No continuous improvements recorded. Propose an operational tweak or SOP enhancement.</p>
        ) : (
          <div>
            {improvements.map((item) => (
              <div key={item.id} className="operations-row">
                <div>
                  <strong>{String(item.title)}</strong>
                  {Boolean(item.problem_statement) && (
                    <p style={{ margin: "4px 0", fontSize: "12px", color: "var(--muted)" }}>
                      Problem: {String(item.problem_statement)}
                    </p>
                  )}
                  {Boolean(item.proposed_solution) && (
                    <p style={{ margin: "2px 0", fontSize: "12px", color: "var(--ink)" }}>
                      Solution: {String(item.proposed_solution)}
                    </p>
                  )}

                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className={`operations-badge ${statusBadgeClass(String(item.status))}`}>
                    {String(item.status)}
                  </span>
                  {item.status === "Reviewing" && (
                    <Button emphasis="ghost" onClick={() => void handleUpdateStatus(item.id, "Approved")}>
                      Approve
                    </Button>
                  )}
                  {item.status === "Approved" && (
                    <Button emphasis="ghost" onClick={() => void handleUpdateStatus(item.id, "Testing")}>
                      Test
                    </Button>
                  )}
                  {item.status === "Testing" && (
                    <Button emphasis="ghost" onClick={() => void handleUpdateStatus(item.id, "Adopted")}>
                      Adopt
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {showModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h2>Propose Continuous Improvement</h2>
            <form onSubmit={handleCreateImprovement}>
              <label>
                Improvement Title
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Automate client onboarding asset validation"
                />
              </label>
              <label>
                Problem Statement (Friction / Root Cause)
                <textarea
                  rows={3}
                  value={problem}
                  onChange={(e) => setProblem(e.target.value)}
                  placeholder="What is failing or causing delays repeatedly?"
                />
              </label>
              <label>
                Proposed Solution
                <textarea
                  rows={3}
                  value={solution}
                  onChange={(e) => setSolution(e.target.value)}
                  placeholder="How can this be permanently resolved or updated in the SOP?"
                />
              </label>
              <div className="modal__actions">
                <Button type="button" emphasis="outline" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" intent="brand">
                  Propose Improvement
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

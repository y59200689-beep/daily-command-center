"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDeferredEffect } from "@/lib/use-deferred-effect";

type RunDetailProps = {
  id: string;
};

type RunData = Record<string, unknown> & {
  id: string;
  title: string;
  status: string;
  started_at?: string;
  completed_at?: string;
  blocker_reason?: string;
  override_reason?: string;
  process_templates?: Record<string, unknown>;
  steps?: Array<Record<string, unknown>>;
  quality_checks?: Array<Record<string, unknown>>;
};

export function RunDetail({ id }: RunDetailProps) {
  const [run, setRun] = useState<RunData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showBlockerModal, setShowBlockerModal] = useState(false);
  const [blockerReason, setBlockerReason] = useState("");
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/operations/runs/${id}`, { cache: "no-store" });
      const body = await res.json();
      if (res.ok) {
        setRun(body.run);
      } else {
        setError(body.error || "Failed to load run");
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useDeferredEffect(useCallback(() => { void load(); }, [load]));

  const handleToggleStep = async (stepId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "Completed" ? "Pending" : "Completed";
    try {
      const res = await fetch(`/api/operations/runs/${id}/steps`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step_id: stepId,
          status: nextStatus,
        }),
      });
      if (res.ok) {
        void load();
      } else {
        const body = await res.json();
        setError(body.error || "Failed to update step");
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  const handleToggleChecklist = async (checklistItemId: string, isCompleted: boolean) => {
    try {
      const res = await fetch(`/api/operations/runs/${id}/checklist`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checklist_item_id: checklistItemId,
          is_completed: !isCompleted,
        }),
      });
      if (res.ok) {
        void load();
      } else {
        const body = await res.json();
        setError(body.error || "Failed to update checklist item");
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  const handleBlockRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockerReason.trim()) return;

    try {
      const res = await fetch(`/api/operations/runs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "Blocked",
          blocker_reason: blockerReason.trim(),
        }),
      });
      if (res.ok) {
        setShowBlockerModal(false);
        setBlockerReason("");
        void load();
      } else {
        const body = await res.json();
        setError(body.error || "Failed to block run");
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  const handleUnblockRun = async () => {
    try {
      const res = await fetch(`/api/operations/runs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "In Progress",
          blocker_reason: null,
        }),
      });
      if (res.ok) {
        void load();
      } else {
        const body = await res.json();
        setError(body.error || "Failed to unblock run");
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  const handleCompleteRun = async (override = false) => {
    setValidationErrors([]);
    try {
      const res = await fetch(`/api/operations/runs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "Completed",
          override_reason: override ? overrideReason : undefined,
        }),
      });
      const body = await res.json();
      if (res.ok) {
        setShowOverrideModal(false);
        setOverrideReason("");
        void load();
      } else {
        if (body.validation_errors) {
          setValidationErrors(body.validation_errors);
        } else {
          setError(body.error || "Failed to complete run");
        }
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  if (loading) {
    return (
      <main className="domain-page operations-page">
        <p className="faint-note">Loading run details...</p>
      </main>
    );
  }

  if (!run) {
    return (
      <main className="domain-page operations-page">
        <p className="field-error">{error || "Run not found"}</p>
        <Link href="/operations/runs"><Button emphasis="outline">Back to Runs</Button></Link>
      </main>
    );
  }

  const steps = run.steps || [];
  const completedSteps = steps.filter((s) => s.status === "Completed");

  return (
    <main className="domain-page operations-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">
            <Link href="/operations/runs">Runs</Link> · {String(run.process_templates?.name || "Standard Run")} · Status: {run.status}
          </p>
          <h1>{run.title}</h1>
          <p>
            {completedSteps.length} of {steps.length} steps completed
            {run.started_at ? ` · Started ${new Date(run.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
            {run.completed_at ? ` · Completed at ${new Date(run.completed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
          </p>
        </div>
        <div className="operations-header-actions">
          <Link href="/operations/runs"><Button emphasis="outline">Runs List</Button></Link>
          {run.status === "Blocked" ? (
            <Button intent="brand" onClick={handleUnblockRun}>Unblock Run</Button>
          ) : run.status !== "Completed" ? (
            <>
              <Button emphasis="outline" onClick={() => setShowBlockerModal(true)}>Record Blocker</Button>
              <Button intent="brand" onClick={() => void handleCompleteRun(false)}>Complete Run</Button>
            </>
          ) : null}
        </div>
      </header>

      {error ? <p role="alert" className="field-error">{error}</p> : null}

      {/* Validation failure warning */}
      {validationErrors.length > 0 && (
        <section className="growth-risk-row growth-risk--critical data-surface">
          <strong>Run Completion Blocked by Quality Validation</strong>
          <ul style={{ margin: "8px 0", paddingLeft: "18px", fontSize: "12px", color: "var(--ink)" }}>
            {validationErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
          <Button emphasis="outline" onClick={() => setShowOverrideModal(true)}>
            Override Validation (Requires Audit Reason)
          </Button>
        </section>
      )}

      {/* Blocker banner */}
      {run.status === "Blocked" && (
        <section className="growth-risk-row growth-risk--critical data-surface">
          <strong>Run is Currently Blocked</strong>
          <p>{String(run.blocker_reason || "No blocker reason documented.")}</p>
          <Button intent="brand" onClick={handleUnblockRun} style={{ marginTop: "8px" }}>
            Resolve Blocker & Resume
          </Button>
        </section>
      )}

      {/* Steps Execution Cockpit */}
      <section className="operations-section operations-section--full data-surface">
        <header>
          <div>
            <p className="eyebrow">Execution Checklist</p>
            <h2>Steps ({steps.length})</h2>
          </div>
          <span className="operations-badge badge--muted">
            {completedSteps.length}/{steps.length} Complete
          </span>
        </header>

        {steps.length === 0 ? (
          <p className="faint-note">No discrete steps recorded for this run.</p>
        ) : (
          <div className="operations-step-list">
            {steps.map((step, idx) => {
              const isCompleted = step.status === "Completed";
              const isFailed = step.status === "Failed";
              const checklistItems = (step.checklist as Array<Record<string, unknown>> | undefined) ?? [];

              return (
                <div
                  key={String(step.id || idx)}
                  className={`operations-step-item ${isCompleted ? "is-completed" : ""} ${isFailed ? "is-failed" : ""}`}
                >
                  <div className="operations-step-header">
                    <label className="operations-checklist-item" style={{ cursor: "pointer", fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={isCompleted}
                        onChange={() => void handleToggleStep(String(step.id), String(step.status))}
                      />
                      <span>
                        {idx + 1}. {String(step.title)}
                        {Boolean(step.is_required) && <span style={{ color: "var(--attention)", marginLeft: "6px" }}>*Required</span>}
                      </span>
                    </label>
                    <span className={`operations-badge ${isCompleted ? "badge--healthy" : isFailed ? "badge--danger" : "badge--muted"}`}>
                      {String(step.status)}
                    </span>
                  </div>

                  {Boolean(step.instructions) && (
                    <p style={{ margin: "4px 0 0 28px", fontSize: "12px", color: "var(--muted)", lineHeight: 1.5 }}>
                      {String(step.instructions)}
                    </p>
                  )}


                  {checklistItems.length > 0 && (
                    <div className="operations-checklist" style={{ marginLeft: "28px" }}>
                      <p className="eyebrow" style={{ margin: "4px 0" }}>Checklist</p>
                      {checklistItems.map((chk) => (
                        <label key={String(chk.id)} className="operations-checklist-item">
                          <input
                            type="checkbox"
                            checked={Boolean(chk.is_completed)}
                            onChange={() => void handleToggleChecklist(String(chk.id), Boolean(chk.is_completed))}
                          />
                          <span>
                            {String(chk.label)}
                            {Boolean(chk.is_required) && <em style={{ color: "var(--attention)", marginLeft: "4px" }}>(Required)</em>}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Blocker modal */}
      {showBlockerModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h2>Record Blocker on Run</h2>
            <form onSubmit={handleBlockRun}>
              <label>
                Blocker Reason & Impact
                <textarea
                  rows={4}
                  required
                  value={blockerReason}
                  onChange={(e) => setBlockerReason(e.target.value)}
                  placeholder="e.g. Waiting on third-party API token / Client asset missing..."
                />
              </label>
              <div className="modal__actions">
                <Button type="button" emphasis="outline" onClick={() => setShowBlockerModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" intent="brand">
                  Mark as Blocked
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Override modal */}
      {showOverrideModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h2>Override Validation & Complete Run</h2>
            <p style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "12px" }}>
              A mandatory audit reason is required when completing a run with incomplete steps or failed checks.
            </p>
            <label>
              Audit Reason
              <textarea
                rows={4}
                required
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="e.g. Step skipped due to urgent production hotfix approved by lead..."
              />
            </label>
            <div className="modal__actions">
              <Button type="button" emphasis="outline" onClick={() => setShowOverrideModal(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                intent="brand"
                disabled={!overrideReason.trim()}
                onClick={() => void handleCompleteRun(true)}
              >
                Confirm Override & Complete
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

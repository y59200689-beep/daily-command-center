"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDeferredEffect } from "@/lib/use-deferred-effect";

type ProcessRow = Record<string, unknown> & { id: string };

function healthBadgeClass(h: string) {
  if (h === "Healthy") return "badge--healthy";
  if (h === "Degraded") return "badge--warning";
  if (h === "At risk") return "badge--danger";
  return "badge--muted";
}

export function ProcessList() {
  const router = useRouter();
  const [processes, setProcesses] = useState<ProcessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [startingId, setStartingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/operations/processes", { cache: "no-store" });
      const body = await res.json();
      if (res.ok) {
        setProcesses(body.processes || []);
      } else {
        setError(body.error || "Failed to load processes");
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useDeferredEffect(useCallback(() => { void load(); }, [load]));

  const handleStartRun = async (processId: string, title: string) => {
    setStartingId(processId);
    try {
      const res = await fetch("/api/operations/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          process_template_id: processId,
          title: `Run: ${title} (${new Date().toLocaleDateString()})`,
        }),
      });
      const body = await res.json();
      if (res.ok && body.run?.id) {
        router.push(`/operations/runs/${body.run.id}`);
      } else {
        setError(body.error || "Failed to start process run");
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setStartingId(null);
    }
  };

  return (
    <main className="domain-page operations-page">
      <header className="task-context-header">
        <div>
          <nav className="task-context-header__breadcrumb" aria-label="Breadcrumb">
            <span>Operations</span>
            <span>/</span>
            <span className="current">Processes</span>
          </nav>
          <div className="task-context-header__title-row">
            <h1>Processes</h1>
            <span className="task-context-header__total-badge">{processes.length} templates</span>
          </div>
          <p className="task-context-header__description">
            Recurring &amp; repeatable process templates
          </p>
        </div>
        <div className="task-context-header__actions">
          <Link href="/operations">Overview</Link>
          <Link href="/operations/runs">All Runs</Link>
        </div>
      </header>

      {error ? <p role="alert" className="field-error">{error}</p> : null}

      <div className="data-surface">
        {loading ? (
          <p className="faint-note">Loading process templates...</p>
        ) : processes.length === 0 ? (
          <p className="faint-note">No process templates configured yet.</p>
        ) : (
          processes.map((proc) => {
            const health = (proc.health as Record<string, unknown> | undefined)?.status || "Unknown";
            const failureRate = (proc.health as Record<string, unknown> | undefined)?.failure_rate;
            const targetMin = proc.target_duration_minutes ? `${proc.target_duration_minutes}m target` : "No target duration";

            return (
              <div key={proc.id} className="operations-row">
                <div>
                  <strong>{String(proc.name)}</strong>
                  <small>
                    {String(proc.category || "General")} · Cadence: {String(proc.cadence || "ad-hoc")} · {targetMin}
                  </small>
                </div>
                <div className="operations-row__actions">
                  <span className={`operations-badge ${healthBadgeClass(String(health))}`}>
                    {String(health)}
                    {typeof failureRate === "number" ? ` (${Math.round(failureRate * 100)}% fail)` : ""}
                  </span>
                  <Button
                    intent="brand"
                    disabled={startingId === proc.id}
                    onClick={() => handleStartRun(proc.id, String(proc.name))}
                  >
                    {startingId === proc.id ? "Starting..." : "Start Run"}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}

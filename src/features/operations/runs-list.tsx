"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDeferredEffect } from "@/lib/use-deferred-effect";

type RunRow = Record<string, unknown> & { id: string };

function statusBadgeClass(status: string) {
  if (status === "Completed") return "badge--healthy";
  if (status === "In Progress") return "badge--warning";
  if (status === "Blocked" || status === "Failed") return "badge--danger";
  return "badge--muted";
}

export function RunsList() {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/operations/runs", { cache: "no-store" });
      const body = await res.json();
      if (res.ok) {
        setRuns(body.runs || []);
      } else {
        setError(body.error || "Failed to load runs");
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useDeferredEffect(useCallback(() => { void load(); }, [load]));

  const filteredRuns = runs.filter((r) => {
    if (filterStatus === "all") return true;
    return String(r.status).toLowerCase() === filterStatus.toLowerCase();
  });

  return (
    <main className="domain-page operations-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Operations · Process Execution</p>
          <h1>Process Runs.</h1>
          <p>
            {runs.length} recorded run{runs.length === 1 ? "" : "s"} · Live and historical operational tracking
          </p>
        </div>
        <div className="operations-header-actions">
          <Link href="/operations"><Button emphasis="outline">Overview</Button></Link>
          <Link href="/operations/processes"><Button intent="brand">Start from Process</Button></Link>
        </div>
      </header>

      {error ? <p role="alert" className="field-error">{error}</p> : null}

      {/* Filter Tabs */}
      <div className="strategy-filters">
        {["all", "In Progress", "Blocked", "Completed", "Failed"].map((st) => (
          <button
            key={st}
            type="button"
            aria-pressed={filterStatus.toLowerCase() === st.toLowerCase()}
            onClick={() => setFilterStatus(st)}
          >
            {st === "all" ? `All (${runs.length})` : `${st} (${runs.filter((r) => String(r.status).toLowerCase() === st.toLowerCase()).length})`}
          </button>
        ))}
      </div>

      <div className="data-surface">
        {loading ? (
          <p className="faint-note">Loading runs...</p>
        ) : filteredRuns.length === 0 ? (
          <p className="faint-note">No runs matching filter &quot;{filterStatus}&quot;.</p>
        ) : (
          filteredRuns.map((run) => (
            <div key={run.id} className="operations-row">
              <Link href={`/operations/runs/${run.id}`}>
                <strong>{String(run.title || "Untitled Run")}</strong>
                <small>
                  Started {run.started_at ? new Date(String(run.started_at)).toLocaleString() : "Not started"}
                  {run.completed_at ? ` · Completed in ${Math.round((new Date(String(run.completed_at)).getTime() - new Date(String(run.started_at)).getTime()) / 60000)}m` : ""}
                  {run.blocker_reason ? ` · Blocked: ${String(run.blocker_reason)}` : ""}
                </small>
              </Link>
              <em>SOP v{String(run.sop_version_number || 1)}</em>
              <span className={`operations-badge ${statusBadgeClass(String(run.status))}`}>
                {String(run.status)}
              </span>
            </div>
          ))
        )}
      </div>
    </main>
  );
}

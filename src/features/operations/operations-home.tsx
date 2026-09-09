"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDeferredEffect } from "@/lib/use-deferred-effect";

type Row = Record<string, unknown> & { id: string };

function healthBadgeClass(h: string) {
  if (h === "Healthy") return "badge--healthy";
  if (h === "Degraded" || h === "Due soon") return "badge--warning";
  if (h === "At risk" || h === "Overdue" || h === "Critical") return "badge--danger";
  return "badge--muted";
}

export function OperationsHome() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/operations/overview", { cache: "no-store" });
    const body = await res.json();
    if (res.ok) setData(body);
    else setError(body.error ?? "Operations overview could not be loaded.");
  }, []);

  useDeferredEffect(useCallback(() => { void load(); }, [load]));

  const nextMove = data?.nextMove as Row | null | undefined;
  const activeRuns = (data?.activeRuns as Row[] | undefined) ?? [];
  const blockedRuns = (data?.blockedRuns as Row[] | undefined) ?? [];
  const sopsReviewDue = (data?.sopsReviewDue as Row[] | undefined) ?? [];
  const openIncidents = (data?.openIncidents as Row[] | undefined) ?? [];
  const repeatedFailures = (data?.repeatedFailures as Row[] | undefined) ?? [];
  const atRiskSystems = (data?.atRiskSystems as Row[] | undefined) ?? [];

  return (
    <main className="domain-page operations-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">V11 · Operations & SOP Operating System</p>
          <h1>Operations.</h1>
          <p>
            {activeRuns.length} active run{activeRuns.length === 1 ? "" : "s"}
            {blockedRuns.length > 0 ? ` · ${blockedRuns.length} blocked` : ""}
            {openIncidents.length > 0 ? ` · ${openIncidents.length} open incident${openIncidents.length === 1 ? "" : "s"}` : ""}
          </p>
        </div>
        <div className="operations-header-actions">
          <Link href="/operations/runs"><Button emphasis="outline">Runs</Button></Link>
          <Link href="/operations/sops"><Button emphasis="outline">SOPs</Button></Link>
          <Link href="/operations/processes"><Button emphasis="outline">Processes</Button></Link>
          <Link href="/operations/quality"><Button emphasis="outline">Quality</Button></Link>
          <Link href="/operations/systems"><Button emphasis="outline">Systems</Button></Link>
          <Link href="/operations/review"><Button intent="brand">Review</Button></Link>
        </div>
      </header>

      {error ? <p role="alert" className="field-error">{error}</p> : null}

      {/* Next best operational move */}
      {nextMove ? (
        <section className="operations-next data-surface">
          <p className="eyebrow">Next Operational Move</p>
          <h2>{String(nextMove.title)}</h2>
          <p>{String(nextMove.reason)}</p>
          {nextMove.route ? (
            <Link href={String(nextMove.route)} className="operations-next__cta">
              Execute move →
            </Link>
          ) : null}
        </section>
      ) : null}

      {/* Operational Subsurfaces Navigation Strip */}
      <nav className="operations-nav-strip" aria-label="Operations surfaces">
        <Link href="/operations/sops">
          <span>SOPs</span>
          <small>Documented operating procedures & versions</small>
        </Link>
        <Link href="/operations/processes">
          <span>Processes</span>
          <small>Recurring operational templates & cadences</small>
        </Link>
        <Link href="/operations/runs">
          <span>Runs</span>
          <small>Live execution tracking & step checklists</small>
        </Link>
        <Link href="/operations/quality">
          <span>Quality</span>
          <small>Incident logs, failure patterns & corrective actions</small>
        </Link>
        <Link href="/operations/systems">
          <span>Systems</span>
          <small>Internal registry, criticality & blast radius</small>
        </Link>
        <Link href="/operations/runbooks">
          <span>Runbooks</span>
          <small>Emergency mitigation & recovery guides</small>
        </Link>
        <Link href="/operations/review">
          <span>Review</span>
          <small>Weekly cadence & continuous improvements</small>
        </Link>
        <Link href="/operations/calendar">
          <span>Calendar</span>
          <small>Schedule of recurring runs & reviews</small>
        </Link>
      </nav>

      <div className="operations-grid">
        {/* Active & Blocked Runs */}
        <section className="operations-section data-surface">
          <header>
            <div>
              <p className="eyebrow">Execution</p>
              <h2>Active & Blocked Runs</h2>
            </div>
            <Link href="/operations/runs"><Button emphasis="ghost">View all</Button></Link>
          </header>
          {blockedRuns.length === 0 && activeRuns.length === 0 ? (
            <p className="faint-note">No runs currently in progress.</p>
          ) : (
            <div>
              {blockedRuns.map((run) => (
                <div key={run.id} className="operations-row">
                  <Link href={`/operations/runs/${run.id}`}>
                    <strong>{String(run.title || "Untitled Run")}</strong>
                    <small>Blocked: {String(run.blocker_reason || "Reason not specified")}</small>
                  </Link>
                  <span className="operations-badge badge--danger">Blocked</span>
                </div>
              ))}
              {activeRuns.map((run) => (
                <div key={run.id} className="operations-row">
                  <Link href={`/operations/runs/${run.id}`}>
                    <strong>{String(run.title || "Untitled Run")}</strong>
                    <small>Started {new Date(String(run.started_at || run.created_at)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>
                  </Link>
                  <span className="operations-badge badge--warning">{String(run.status)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* SOP Reviews Due */}
        <section className="operations-section data-surface">
          <header>
            <div>
              <p className="eyebrow">Procedure Hygiene</p>
              <h2>SOP Reviews Due</h2>
            </div>
            <Link href="/operations/sops"><Button emphasis="ghost">SOP Library</Button></Link>
          </header>
          {sopsReviewDue.length === 0 ? (
            <p className="faint-note">All SOPs are up to date and fresh.</p>
          ) : (
            <div>
              {sopsReviewDue.slice(0, 5).map((sop) => (
                <div key={sop.id} className="operations-row">
                  <Link href={`/operations/sops/${sop.id}`}>
                    <strong>{String(sop.title)}</strong>
                    <small>Version {String(sop.current_version)} · Interval {String(sop.review_interval_days)}d</small>
                  </Link>
                  <span className={`operations-badge ${healthBadgeClass(String(sop.review_status || "Overdue"))}`}>
                    {String(sop.review_status || "Due")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Quality Incidents & Repeated Failures */}
        <section className="operations-section data-surface">
          <header>
            <div>
              <p className="eyebrow">Quality & Reliability</p>
              <h2>Open Incidents & Failures</h2>
            </div>
            <Link href="/operations/quality"><Button emphasis="ghost">Quality Center</Button></Link>
          </header>
          {openIncidents.length === 0 && repeatedFailures.length === 0 ? (
            <p className="faint-note">No open incidents or detected failure loops.</p>
          ) : (
            <div>
              {repeatedFailures.map((rf, idx) => (
                <div key={idx} className="operations-row">
                  <div>
                    <strong>Repeated Failure: {String(rf.process_name || "Process")}</strong>
                    <small>{String(rf.failure_count)} recent failures detected</small>
                  </div>
                  <span className="operations-badge badge--danger">Warning</span>
                </div>
              ))}
              {openIncidents.map((inc) => (
                <div key={inc.id} className="operations-row">
                  <Link href="/operations/quality">
                    <strong>{String(inc.title)}</strong>
                    <small>Severity: {String(inc.severity)} · Status: {String(inc.status)}</small>
                  </Link>
                  <span className={`operations-badge ${healthBadgeClass(String(inc.severity))}`}>
                    {String(inc.severity)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Systems at Risk */}
        <section className="operations-section data-surface">
          <header>
            <div>
              <p className="eyebrow">Infrastructure</p>
              <h2>Systems at Risk</h2>
            </div>
            <Link href="/operations/systems"><Button emphasis="ghost">Registry</Button></Link>
          </header>
          {atRiskSystems.length === 0 ? (
            <p className="faint-note">All internal systems and tools are healthy.</p>
          ) : (
            <div>
              {atRiskSystems.map((sys) => (
                <div key={sys.id} className="operations-row">
                  <Link href="/operations/systems">
                    <strong>{String(sys.name)}</strong>
                    <small>Tier: {String(sys.criticality_tier)} · Blast radius: {String(sys.blast_radius)}</small>
                  </Link>
                  <span className={`operations-badge ${healthBadgeClass(String(sys.health_status))}`}>
                    {String(sys.health_status)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

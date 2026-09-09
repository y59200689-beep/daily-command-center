"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDeferredEffect } from "@/lib/use-deferred-effect";

type ProcessItem = Record<string, unknown> & { id: string };
type SopItem = Record<string, unknown> & { id: string };

export function OperationsCalendar() {
  const [processes, setProcesses] = useState<ProcessItem[]>([]);
  const [sops, setSops] = useState<SopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [procRes, sopRes] = await Promise.all([
        fetch("/api/operations/processes", { cache: "no-store" }),
        fetch("/api/operations/sops", { cache: "no-store" }),
      ]);
      const [procBody, sopBody] = await Promise.all([procRes.json(), sopRes.json()]);
      if (procRes.ok && sopRes.ok) {
        setProcesses(procBody.processes || []);
        setSops(sopBody.sops || []);
      } else {
        setError(procBody.error || sopBody.error || "Failed to load operational schedule");
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useDeferredEffect(useCallback(() => { void load(); }, [load]));

  const dailyProcesses = processes.filter((p) => String(p.cadence).toLowerCase() === "daily");
  const weeklyProcesses = processes.filter((p) => String(p.cadence).toLowerCase() === "weekly");
  const monthlyProcesses = processes.filter((p) => String(p.cadence).toLowerCase() === "monthly");

  return (
    <main className="domain-page operations-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Operations · Schedule & Recurring Cadence</p>
          <h1>Operations Calendar.</h1>
          <p>
            Recurring process execution schedule, scheduled maintenance windows & SOP review deadlines
          </p>
        </div>
        <div className="operations-header-actions">
          <Link href="/operations"><Button emphasis="outline">Overview</Button></Link>
          <Link href="/operations/runs"><Button emphasis="outline">Active Runs</Button></Link>
        </div>
      </header>

      {error ? <p role="alert" className="field-error">{error}</p> : null}

      <div className="operations-grid">
        {/* Daily Schedule */}
        <section className="operations-section data-surface">
          <header>
            <div>
              <p className="eyebrow">Recurring</p>
              <h2>Daily Processes ({dailyProcesses.length})</h2>
            </div>
            <span className="operations-badge badge--healthy">Daily</span>
          </header>
          {loading ? (
            <p className="faint-note">Loading...</p>
          ) : dailyProcesses.length === 0 ? (
            <p className="faint-note">No daily processes configured.</p>
          ) : (
            <div>
              {dailyProcesses.map((proc) => (
                <div key={proc.id} className="operations-row">
                  <div>
                    <strong>{String(proc.name)}</strong>
                    <small>{String(proc.target_duration_minutes || 15)}m target</small>
                  </div>
                  <Link href={`/operations/processes`}>
                    <Button emphasis="ghost">View</Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Weekly Schedule */}
        <section className="operations-section data-surface">
          <header>
            <div>
              <p className="eyebrow">Recurring</p>
              <h2>Weekly Processes ({weeklyProcesses.length})</h2>
            </div>
            <span className="operations-badge badge--warning">Weekly</span>
          </header>
          {loading ? (
            <p className="faint-note">Loading...</p>
          ) : weeklyProcesses.length === 0 ? (
            <p className="faint-note">No weekly processes configured.</p>
          ) : (
            <div>
              {weeklyProcesses.map((proc) => (
                <div key={proc.id} className="operations-row">
                  <div>
                    <strong>{String(proc.name)}</strong>
                    <small>{String(proc.target_duration_minutes || 30)}m target</small>
                  </div>
                  <Link href={`/operations/processes`}>
                    <Button emphasis="ghost">View</Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Monthly Schedule */}
        <section className="operations-section data-surface">
          <header>
            <div>
              <p className="eyebrow">Recurring</p>
              <h2>Monthly Cadence ({monthlyProcesses.length})</h2>
            </div>
            <span className="operations-badge badge--muted">Monthly</span>
          </header>
          {loading ? (
            <p className="faint-note">Loading...</p>
          ) : monthlyProcesses.length === 0 ? (
            <p className="faint-note">No monthly processes configured.</p>
          ) : (
            <div>
              {monthlyProcesses.map((proc) => (
                <div key={proc.id} className="operations-row">
                  <div>
                    <strong>{String(proc.name)}</strong>
                    <small>{String(proc.target_duration_minutes || 60)}m target</small>
                  </div>
                  <Link href={`/operations/processes`}>
                    <Button emphasis="ghost">View</Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* SOP Reviews Due */}
        <section className="operations-section data-surface">
          <header>
            <div>
              <p className="eyebrow">Deadlines</p>
              <h2>Upcoming SOP Reviews</h2>
            </div>
          </header>
          {loading ? (
            <p className="faint-note">Loading...</p>
          ) : sops.length === 0 ? (
            <p className="faint-note">No SOPs to review.</p>
          ) : (
            <div>
              {sops.slice(0, 6).map((sop) => (
                <div key={sop.id} className="operations-row">
                  <Link href={`/operations/sops/${sop.id}`}>
                    <strong>{String(sop.title)}</strong>
                    <small>Interval: {String(sop.review_interval_days || 90)}d</small>
                  </Link>
                  <span className={`operations-badge ${sop.review_status === "Fresh" ? "badge--healthy" : "badge--warning"}`}>
                    {String(sop.review_status || "Due")}
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

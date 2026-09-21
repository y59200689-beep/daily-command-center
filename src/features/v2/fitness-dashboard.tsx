"use client";

import { useCallback, useState } from "react";
import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { DomainPage } from "@/features/domains/domain-page";
import { useDeferredEffect } from "@/lib/use-deferred-effect";

type Row = Record<string, unknown> & {
  id: string;
  progress?: { actual: number; target: number; remaining: number; complete: boolean };
};

type Data = {
  period: { start: string; end: string };
  activities: Row[];
  targets: Row[];
  totals: { sessions: number; distance_km: number; duration_minutes: number };
};

export function FitnessDashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/fitness", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setData(body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Fitness could not be loaded.");
    }
  }, []);

  useDeferredEffect(useCallback(() => { void load(); }, [load]));

  return (
    <div className="domain-page fitness-page">
      <header className="task-context-header fitness-context-header">
        <div>
          <div className="task-context-header__path">
            <Icons.Dumbbell size={15} />
            <span>Personal rhythm</span>
            <Icons.ChevronRight size={13} />
            <strong>Fitness</strong>
          </div>
          <h1>Fitness</h1>
          <p>A calm weekly view of movement, consistency, and targets within reach.</p>
        </div>
      </header>

      {error ? (
        <div className="inline-error" role="alert">
          <p>{error}</p>
          <Button emphasis="outline" onClick={() => void load()}>Try again</Button>
        </div>
      ) : !data ? (
        <div className="loading-state" aria-live="polite">
          <span className="loading-spinner" />
          <p>Reading this week…</p>
        </div>
      ) : (
        <>
          <section className="metric-ledger metric-ledger--three" aria-label="Weekly fitness metrics">
            <div>
              <strong>{data.totals.sessions}</strong>
              <span>Sessions this week</span>
            </div>
            <div>
              <strong>{data.totals.distance_km.toFixed(1)} km</strong>
              <span>Total distance</span>
            </div>
            <div>
              <strong>{Math.round(data.totals.duration_minutes)} min</strong>
              <span>Active duration</span>
            </div>
          </section>

          <section className="target-list" aria-label="Weekly targets">
            <p className="eyebrow">Weekly targets</p>
            {data.targets.length ? (
              data.targets.map((target) => (
                <div className="target-row" key={target.id}>
                  <div>
                    <strong>{String(target.activity_type)}</strong>
                    <span>
                      {target.progress?.actual} / {target.progress?.target}{" "}
                      {String(target.target_type).replace("_", " ")}
                    </span>
                  </div>
                  <span className="target-track">
                    <i
                      style={{
                        width: `${Math.min(
                          100,
                          (Number(target.progress?.actual) / Number(target.progress?.target)) * 100
                        )}%`,
                      }}
                    />
                  </span>
                  <em>
                    {target.progress?.complete ? (
                      <span className="status status--completed">Target met</span>
                    ) : (
                      `${target.progress?.remaining} left`
                    )}
                  </em>
                </div>
              ))
            ) : (
              <p className="dataset-note">No active targets. Add one below.</p>
            )}
          </section>
        </>
      )}

      <DomainPage domain="fitness-targets" embedded onMutationSuccess={load} />
      <DomainPage domain="fitness" embedded onMutationSuccess={load} />
    </div>
  );
}


"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icons } from "@/components/icons";
import { TeamSchemaUnavailable } from "./team-schema-unavailable";

interface CapacityCard {
  person_id: string;
  person_name: string;
  capacity_state: string;
  active_tasks: number;
  active_runs: number;
  active_delegations: number;
  blocked_items: number;
  critical_items: number;
  reasons: string[];
}

export function CapacityView() {
  const [cards, setCards] = useState<CapacityCard[]>([]);
  const [summary, setSummary] = useState<{ total: number; overloaded: number; busy: number; available: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [schemaUnavailable, setSchemaUnavailable] = useState(false);

  useEffect(() => {
    fetch("/api/team/capacity")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        setSchemaUnavailable(json?.schemaStatus === "unavailable");
        if (json?.capacityCards) {
          setCards(json.capacityCards);
          setSummary(json.summary);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (schemaUnavailable) return <TeamSchemaUnavailable title="Team Workload & Capacity" description="Objective commitment balance based strictly on active tasks, runs, and delegations." />;

  return (
    <div className="page-shell team-page">
      <div className="page-header">
        <div>
          <p className="eyebrow"><Link href="/team">← Team Command Center</Link></p>
          <h1>Team Workload & Capacity</h1>
          <p className="page-description">
            Objective commitment balance based strictly on active tasks, runs, and delegations.
          </p>
        </div>
      </div>

      {summary && (
        <div className="metric-ledger metric-ledger--four" style={{ margin: "20px 0" }}>
          <div className="metric-card">
            <span className="metric-card__value">{summary.total}</span>
            <span className="metric-card__label">Active Members</span>
          </div>
          <div className="metric-card">
            <span className="metric-card__value">{summary.overloaded}</span>
            <span className="metric-card__label">Overloaded</span>
          </div>
          <div className="metric-card">
            <span className="metric-card__value">{summary.busy}</span>
            <span className="metric-card__label">Busy</span>
          </div>
          <div className="metric-card">
            <span className="metric-card__value">{summary.available}</span>
            <span className="metric-card__label">Available</span>
          </div>
        </div>
      )}

      {loading ? (
        <p className="muted">Loading capacity data…</p>
      ) : cards.length === 0 ? (
        <div className="data-surface empty-hero">
          <Icons.ChartNoAxesCombined size={32} />
          <h3>No team capacity data available</h3>
          <p className="muted">Add members in the People Directory to track workload.</p>
        </div>
      ) : (
        <div className="item-stack">
          {cards.map((c) => (
            <div key={c.person_id} className="data-surface" style={{ padding: "18px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                <div>
                  <Link href={`/team/people/${c.person_id}`}>
                    <h3 style={{ margin: "0 0 4px 0", fontSize: "16px" }}>{c.person_name}</h3>
                  </Link>
                  <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
                    {c.reasons.map((r, i) => (
                      <li key={i} className="muted" style={{ fontSize: "12px" }}>{r}</li>
                    ))}
                  </ul>
                </div>
                <span className={`badge badge--${c.capacity_state === "overloaded" ? "danger" : c.capacity_state === "busy" ? "warning" : "healthy"}`}>
                  {c.capacity_state}
                </span>
              </div>

              <div style={{ display: "flex", gap: "24px", marginTop: "14px", borderTop: "1px solid var(--line)", paddingTop: "12px", flexWrap: "wrap" }}>
                <div>
                  <small className="muted" style={{ display: "block" }}>Active Delegations</small>
                  <strong>{c.active_delegations}</strong>
                </div>
                <div>
                  <small className="muted" style={{ display: "block" }}>Active Tasks</small>
                  <strong>{c.active_tasks}</strong>
                </div>
                <div>
                  <small className="muted" style={{ display: "block" }}>Process Runs</small>
                  <strong>{c.active_runs}</strong>
                </div>
                <div>
                  <small className="muted" style={{ display: "block" }}>Critical Items</small>
                  <strong style={{ color: c.critical_items > 0 ? "var(--danger)" : "inherit" }}>{c.critical_items}</strong>
                </div>
                <div>
                  <small className="muted" style={{ display: "block" }}>Blocked Items</small>
                  <strong style={{ color: c.blocked_items > 0 ? "var(--danger)" : "inherit" }}>{c.blocked_items}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

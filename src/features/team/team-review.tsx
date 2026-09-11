"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icons } from "@/components/icons";
import { TeamSchemaUnavailable } from "./team-schema-unavailable";

interface ReviewData {
  period: string;
  nextTeamAction: {
    action: string;
    priority: number;
    why: string;
    direct_route: string;
    badge?: string;
  };
  review: {
    metrics: {
      totalPeople: number;
      openDelegations: number;
      completedDelegations: number;
      blockedDelegations: number;
      overdueDelegations: number;
      ownershipGapsCount: number;
      backupGapsCount: number;
      openEscalationsCount: number;
      pendingHandoffs: number;
    };
    ownershipGaps: Array<{ id: string; title: string; description: string; route: string }>;
    backupGaps: Array<{ responsibility_id: string; responsibility_name: string; description: string }>;
  };
  waitingOnTeam: Array<{ id: string; what: string; who?: string; why_waiting: string; route: string }>;
  waitingOnMe: Array<{ id: string; what: string; who?: string; why_waiting: string; route: string }>;
  risks: Array<{ id: string; risk: string; severity: string; evidence: string; suggested_action: string }>;
}

export function TeamReview() {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [schemaUnavailable, setSchemaUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/team/review?period=${period}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!active) return;
        setSchemaUnavailable(json?.schemaStatus === "unavailable");
        if (json) setData(json);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [period]);

  if (schemaUnavailable) return <TeamSchemaUnavailable title="Team Review" description="Retrospective and coordination review across team commitments and responsibilities." />;

  return (
    <div className="page-shell team-page">
      <div className="page-header">
        <div>
          <p className="eyebrow"><Link href="/team">← Team Command Center</Link></p>
          <h1>Team Review</h1>
          <p className="page-description">Retrospective and coordination review across team commitments and responsibilities.</p>
        </div>
        <div className="header-actions">
          <div className="pill-tabs">
            <button className={`pill-tab ${period === "week" ? "is-active" : ""}`} onClick={() => { setPeriod("week"); setLoading(true); }}>This Week</button>
            <button className={`pill-tab ${period === "month" ? "is-active" : ""}`} onClick={() => { setPeriod("month"); setLoading(true); }}>This Month</button>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="muted">Preparing review…</p>
      ) : !data ? (
        <p className="error-text">Review data could not be loaded.</p>
      ) : (
        <div style={{ display: "grid", gap: "24px", marginTop: "20px" }}>
          {/* NEXT ACTION */}
          {data.nextTeamAction && (
            <div className={`data-surface team-next-action-card team-next-action-card--${data.nextTeamAction.badge || "info"}`}>
              <span className="eyebrow">Priority Coordination Action</span>
              <h2 className="team-next-title">{data.nextTeamAction.action}</h2>
              <p className="team-next-why">{data.nextTeamAction.why}</p>
              <div style={{ marginTop: "12px" }}>
                <Link href={data.nextTeamAction.direct_route} className="button button--small button--primary">
                  Review Item <Icons.ArrowRight size={14} />
                </Link>
              </div>
            </div>
          )}

          {/* METRIC LEDGER */}
          <div className="metric-ledger metric-ledger--four">
            <div className="metric-card">
              <span className="metric-card__value">{data.review.metrics.openDelegations}</span>
              <span className="metric-card__label">Open Delegations</span>
            </div>
            <div className="metric-card">
              <span className="metric-card__value">{data.review.metrics.completedDelegations}</span>
              <span className="metric-card__label">Completed</span>
            </div>
            <div className="metric-card">
              <span className="metric-card__value">{data.review.metrics.blockedDelegations}</span>
              <span className="metric-card__label">Blocked</span>
            </div>
            <div className="metric-card">
              <span className="metric-card__value">{data.review.metrics.overdueDelegations}</span>
              <span className="metric-card__label">Overdue</span>
            </div>
            <div className="metric-card">
              <span className="metric-card__value">{data.review.metrics.ownershipGapsCount}</span>
              <span className="metric-card__label">Ownership Gaps</span>
            </div>
            <div className="metric-card">
              <span className="metric-card__value">{data.review.metrics.backupGapsCount}</span>
              <span className="metric-card__label">Single-Owner Dependencies</span>
            </div>
            <div className="metric-card">
              <span className="metric-card__value">{data.review.metrics.pendingHandoffs}</span>
              <span className="metric-card__label">Pending Handoffs</span>
            </div>
            <div className="metric-card">
              <span className="metric-card__value">{data.review.metrics.openEscalationsCount}</span>
              <span className="metric-card__label">Open Escalations</span>
            </div>
          </div>

          {/* TWO COLUMN SUMMARY */}
          <div className="team-dashboard-grid">
            {/* WAITING ON TEAM */}
            <div className="data-surface">
              <div className="section-heading section-heading--small">
                <div>
                  <p className="eyebrow">Awaiting Others</p>
                  <h2>Waiting on Team ({data.waitingOnTeam.length})</h2>
                </div>
              </div>
              <div className="item-stack">
                {data.waitingOnTeam.map((item) => (
                  <div key={item.id} className="team-list-row">
                    <div>
                      <strong>{item.what}</strong>
                      <p className="muted" style={{ fontSize: "12px", margin: "2px 0" }}>{item.why_waiting}</p>
                      <small className="muted">{item.who ? `Assignee: ${item.who}` : ""}</small>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* WAITING ON ME */}
            <div className="data-surface">
              <div className="section-heading section-heading--small">
                <div>
                  <p className="eyebrow">Owner Actions</p>
                  <h2>Waiting on Me ({data.waitingOnMe.length})</h2>
                </div>
              </div>
              <div className="item-stack">
                {data.waitingOnMe.map((item) => (
                  <div key={item.id} className="team-list-row">
                    <div>
                      <strong>{item.what}</strong>
                      <p className="muted" style={{ fontSize: "12px", margin: "2px 0" }}>{item.why_waiting}</p>
                    </div>
                    <Link href={item.route} className="button button--small button--secondary">Open</Link>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

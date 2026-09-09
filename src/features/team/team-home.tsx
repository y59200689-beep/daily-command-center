"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icons } from "@/components/icons";

interface NextTeamAction {
  action: string;
  priority: number;
  why: string;
  direct_route: string;
  badge?: "critical" | "warning" | "attention" | "info";
  person?: { id: string; name: string } | null;
}

interface OverviewData {
  metrics: {
    totalPeople: number;
    activeDelegations: number;
    waitingOnTeamCount: number;
    waitingOnMeCount: number;
    ownershipGapsCount: number;
    backupGapsCount: number;
    openEscalationsCount: number;
    criticalRisksCount: number;
  };
  nextTeamAction: NextTeamAction;
  waitingOnTeam: Array<{
    id: string;
    what: string;
    who?: string;
    since: string;
    due?: string | null;
    status: string;
    why_waiting: string;
    route: string;
  }>;
  waitingOnMe: Array<{
    id: string;
    what: string;
    who?: string;
    since: string;
    why_waiting: string;
    route: string;
  }>;
  recentDelegations: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    due_at?: string | null;
  }>;
  ownershipGaps: Array<{
    id: string;
    title: string;
    criticality: string;
    description: string;
    route: string;
  }>;
  backupGaps: Array<{
    responsibility_id: string;
    responsibility_name: string;
    criticality: string;
    description: string;
  }>;
  risks: Array<{
    id: string;
    risk: string;
    severity: string;
    evidence: string;
    suggested_action: string;
    route: string;
  }>;
  peopleCount: number;
}

export function TeamHome() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/team/overview")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json) setData(json);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="page-shell"><p className="muted">Loading Team Command Center…</p></div>;
  }

  const isEmpty = !data || data.peopleCount === 0;

  return (
    <div className="page-shell team-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">V12 Team & Delegation OS</p>
          <h1>Team Command Center</h1>
          <p className="page-description">
            Coordinate, delegate, and manage responsibility across people without losing control.
          </p>
        </div>
        <div className="header-actions">
          <Link href="/team/people" className="button button--secondary">
            <Icons.Users size={16} /> Directory
          </Link>
          <Link href="/team/delegations" className="button button--secondary">
            <Icons.ListTodo size={16} /> Delegations
          </Link>
          <Link href="/team/responsibilities" className="button button--secondary">
            <Icons.Target size={16} /> Responsibilities
          </Link>
          <Link href="/team/delegations?create=1" className="button button--primary">
            <Icons.Plus size={16} /> New Delegation
          </Link>
        </div>
      </div>

      {isEmpty ? (
        <div className="data-surface empty-hero">
          <div className="empty-hero__content">
            <Icons.Users size={36} />
            <h2>No people are being tracked yet.</h2>
            <p>
              Track collaborators, contractors, or team members so ownership, delegations, and handoffs stay clear.
            </p>
            <div style={{ marginTop: "16px" }}>
              <Link href="/team/people?create=1" className="button button--primary">
                <Icons.Plus size={16} /> Add Person
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* NEXT TEAM ACTION BANNER */}
          {data.nextTeamAction && (
            <div className={`data-surface team-next-action-card team-next-action-card--${data.nextTeamAction.badge || "info"}`}>
              <div className="team-next-header">
                <span className="eyebrow">Next Team Action</span>
                <span className={`badge badge--${data.nextTeamAction.badge || "info"}`}>
                  Priority {data.nextTeamAction.priority}
                </span>
              </div>
              <h2 className="team-next-title">{data.nextTeamAction.action}</h2>
              <p className="team-next-why">{data.nextTeamAction.why}</p>
              {data.nextTeamAction.direct_route && (
                <div style={{ marginTop: "12px" }}>
                  <Link href={data.nextTeamAction.direct_route} className="button button--small button--primary">
                    Take Action <Icons.ArrowRight size={14} />
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* METRIC LEDGER */}
          <div className="metric-ledger metric-ledger--four" style={{ margin: "24px 0" }}>
            <div className="metric-card">
              <span className="metric-card__value">{data.metrics.totalPeople}</span>
              <span className="metric-card__label">People Tracked</span>
            </div>
            <div className="metric-card">
              <span className="metric-card__value">{data.metrics.activeDelegations}</span>
              <span className="metric-card__label">Active Delegations</span>
            </div>
            <div className="metric-card">
              <span className="metric-card__value">{data.metrics.waitingOnTeamCount}</span>
              <span className="metric-card__label">Waiting on Team</span>
            </div>
            <div className="metric-card">
              <span className="metric-card__value">{data.metrics.waitingOnMeCount}</span>
              <span className="metric-card__label">Waiting on Me</span>
            </div>
            <div className="metric-card">
              <span className="metric-card__value">{data.metrics.ownershipGapsCount}</span>
              <span className="metric-card__label">Ownership Gaps</span>
            </div>
            <div className="metric-card">
              <span className="metric-card__value">{data.metrics.backupGapsCount}</span>
              <span className="metric-card__label">Single-Owner Dependencies</span>
            </div>
            <div className="metric-card">
              <span className="metric-card__value">{data.metrics.openEscalationsCount}</span>
              <span className="metric-card__label">Open Escalations</span>
            </div>
            <div className="metric-card">
              <span className="metric-card__value">{data.metrics.criticalRisksCount}</span>
              <span className="metric-card__label">Critical Risks</span>
            </div>
          </div>

          {/* TWO-COLUMN EDITORIAL SECTIONS */}
          <div className="team-dashboard-grid">
            {/* WAITING ON ME */}
            <div className="data-surface">
              <div className="section-heading section-heading--small">
                <div>
                  <p className="eyebrow">Immediate Blockers</p>
                  <h2>Waiting on Me</h2>
                </div>
                <Link href="/team/delegations?waiting=me">View all ({data.metrics.waitingOnMeCount})</Link>
              </div>
              {data.waitingOnMe.length === 0 ? (
                <p className="muted" style={{ padding: "12px 0" }}>No team members are currently blocked waiting on you.</p>
              ) : (
                <div className="item-stack">
                  {data.waitingOnMe.map((item) => (
                    <Link href={item.route} key={item.id} className="team-list-row">
                      <div>
                        <strong>{item.what}</strong>
                        <p className="muted" style={{ fontSize: "12px", margin: "2px 0" }}>{item.why_waiting}</p>
                        <small className="muted">{item.who ? `From: ${item.who}` : "Pending decision"} · Since {item.since}</small>
                      </div>
                      <Icons.ChevronRight size={16} className="muted" />
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* WAITING ON TEAM */}
            <div className="data-surface">
              <div className="section-heading section-heading--small">
                <div>
                  <p className="eyebrow">Delegated Progress</p>
                  <h2>Waiting on Team</h2>
                </div>
                <Link href="/team/delegations?waiting=team">View all ({data.metrics.waitingOnTeamCount})</Link>
              </div>
              {data.waitingOnTeam.length === 0 ? (
                <p className="muted" style={{ padding: "12px 0" }}>No pending delegated items waiting on team.</p>
              ) : (
                <div className="item-stack">
                  {data.waitingOnTeam.map((item) => (
                    <Link href={item.route} key={item.id} className="team-list-row">
                      <div>
                        <strong>{item.what}</strong>
                        <p className="muted" style={{ fontSize: "12px", margin: "2px 0" }}>{item.why_waiting}</p>
                        <small className="muted">Owner: {item.who} · {item.due ? `Due: ${item.due}` : "Ongoing"}</small>
                      </div>
                      <span className={`badge badge--${item.status === "blocked" ? "danger" : "info"}`}>
                        {item.status}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* OWNERSHIP GAPS & BACKUP COVERAGE */}
            <div className="data-surface">
              <div className="section-heading section-heading--small">
                <div>
                  <p className="eyebrow">Accountability</p>
                  <h2>Ownership & Backup Gaps</h2>
                </div>
                <Link href="/team/responsibilities">Responsibilities</Link>
              </div>
              {data.ownershipGaps.length === 0 && data.backupGaps.length === 0 ? (
                <p className="muted" style={{ padding: "12px 0" }}>All active responsibilities have primary and backup owners.</p>
              ) : (
                <div className="item-stack">
                  {data.ownershipGaps.map((gap) => (
                    <Link href={gap.route} key={gap.id} className="team-list-row">
                      <div>
                        <strong style={{ color: "var(--danger)" }}>{gap.title}</strong>
                        <p className="muted" style={{ fontSize: "12px", margin: "2px 0" }}>{gap.description}</p>
                      </div>
                      <span className="badge badge--danger">Unowned</span>
                    </Link>
                  ))}
                  {data.backupGaps.map((bg) => (
                    <div key={bg.responsibility_id} className="team-list-row">
                      <div>
                        <strong>Single Owner: {bg.responsibility_name}</strong>
                        <p className="muted" style={{ fontSize: "12px", margin: "2px 0" }}>{bg.description}</p>
                      </div>
                      <span className="badge badge--warning">No backup</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* TEAM RISKS */}
            <div className="data-surface">
              <div className="section-heading section-heading--small">
                <div>
                  <p className="eyebrow">Coordination Signals</p>
                  <h2>Team Risks</h2>
                </div>
                <Link href="/team/risks">View all risks</Link>
              </div>
              {data.risks.length === 0 ? (
                <p className="muted" style={{ padding: "12px 0" }}>No high-severity team coordination risks detected.</p>
              ) : (
                <div className="item-stack">
                  {data.risks.map((risk) => (
                    <Link href={risk.route} key={risk.id} className="team-list-row">
                      <div>
                        <strong>{risk.risk}</strong>
                        <p className="muted" style={{ fontSize: "12px", margin: "2px 0" }}>{risk.evidence}</p>
                        <small style={{ color: "var(--attention)" }}>Action: {risk.suggested_action}</small>
                      </div>
                      <span className={`badge badge--${risk.severity === "critical" ? "danger" : "warning"}`}>
                        {risk.severity}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* NAVIGATION STRIP */}
          <div className="team-nav-strip" style={{ marginTop: "32px" }}>
            <Link href="/team/people" className="team-nav-card">
              <Icons.Users size={22} />
              <div>
                <strong>People Directory</strong>
                <p>Team members, contractors, and collaborators</p>
              </div>
            </Link>
            <Link href="/team/delegations" className="team-nav-card">
              <Icons.ListTodo size={22} />
              <div>
                <strong>Delegations Inbox & Outbox</strong>
                <p>Tracked outcomes, reviews, and blocked items</p>
              </div>
            </Link>
            <Link href="/team/responsibilities" className="team-nav-card">
              <Icons.Target size={22} />
              <div>
                <strong>Responsibility Areas</strong>
                <p>Primary and backup ownership assignments</p>
              </div>
            </Link>
            <Link href="/team/capacity" className="team-nav-card">
              <Icons.ChartNoAxesCombined size={22} />
              <div>
                <strong>Workload & Capacity</strong>
                <p>Objective commitment balance across team</p>
              </div>
            </Link>
            <Link href="/team/ownership" className="team-nav-card">
              <Icons.BriefcaseBusiness size={22} />
              <div>
                <strong>Ownership Map</strong>
                <p>Cross-domain accountability matrix</p>
              </div>
            </Link>
            <Link href="/team/review" className="team-nav-card">
              <Icons.Check size={22} />
              <div>
                <strong>Team Review</strong>
                <p>Weekly and monthly coordination retrospectives</p>
              </div>
            </Link>
            <Link href="/team/1on1" className="team-nav-card">
              <Icons.MessageSquareText size={22} />
              <div>
                <strong>1:1 Preparation</strong>
                <p>Contextual meeting prep and action items</p>
              </div>
            </Link>
            <Link href="/team/risks" className="team-nav-card">
              <Icons.Bell size={22} />
              <div>
                <strong>Risks & Escalations</strong>
                <p>Coordination bottlenecks and single-owner items</p>
              </div>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

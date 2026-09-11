"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icons } from "@/components/icons";

interface NextAction {
  action: string;
  priority: number;
  client_id?: string;
  client_name?: string;
  reason: string;
  badge?: "critical" | "warning" | "attention" | "info";
  direct_route?: string;
}

interface OverviewData {
  metrics: {
    totalClients: number;
    healthyCount: number;
    needsAttentionCount: number;
    atRiskCount: number;
    criticalCount: number;
    upcomingRenewalsCount: number;
    waitingOnUsCount: number;
    waitingOnClientCount: number;
    activePlansCount: number;
    openIssuesCount: number;
  };
  nextAction: NextAction | null;
  atRiskClients: Array<{
    client: { id: string; name: string; company?: string | null };
    health: { state: string; summary: string };
    activeRisksCount: number;
    openIssuesCount: number;
  }>;
  upcomingRenewals: Array<{
    id: string;
    client_name?: string;
    client_id: string;
    renewal_date: string;
    renewal_type: string;
    status: string;
    forecast_category: string;
    value?: number | null;
    currency: string;
    readiness: { state: string };
  }>;
  waitingOnUs: Array<{
    id: string;
    client_name: string;
    what: string;
    due?: string | null;
    is_overdue: boolean;
    route: string;
  }>;
  recentSignals: Array<{
    id: string;
    client_id: string;
    signal_type: string;
    summary: string;
    recorded_at: string;
  }>;
}

function badgeClass(badge?: string) {
  if (badge === "critical") return "var(--color-red-600)";
  if (badge === "warning") return "var(--color-amber-500)";
  if (badge === "attention") return "var(--color-blue-500)";
  return "var(--color-emerald-500)";
}

function healthColor(state: string) {
  if (state === "healthy") return "#10b981";
  if (state === "needs_attention") return "#f59e0b";
  if (state === "at_risk") return "#f97316";
  if (state === "critical") return "#ef4444";
  return "#6b7280";
}

function forecastColor(fc: string) {
  if (fc === "committed") return "#10b981";
  if (fc === "likely") return "#3b82f6";
  if (fc === "uncertain") return "#f59e0b";
  if (fc === "at_risk") return "#ef4444";
  return "#6b7280";
}

function signalIcon(type: string) {
  if (type === "positive_feedback" || type === "praise" || type === "referral" || type === "renewal_intent")
    return <Icons.Check size={16} aria-hidden="true" />;
  if (type === "negative_feedback" || type === "complaint") return <Icons.AlertTriangle size={16} aria-hidden="true" />;
  return <Icons.MessageSquareText size={16} aria-hidden="true" />;
}

export function SuccessHome() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/success/overview")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load overview");
        return res.json();
      })
      .then((json) => {
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Customer Success overview could not be loaded.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    fetch("/api/success/overview")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load overview");
        return res.json();
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch(() => {
        setError("Customer Success overview could not be loaded.");
        setLoading(false);
      });
  };

  if (loading) {
    return (
      <div className="success-page">
        <div className="page-header">
          <h1 className="page-title"><Icons.HeartHandshake size={22} /> Customer Success</h1>
        </div>
        <p style={{ color: "var(--text-secondary)", padding: "2rem 0" }}>Loading overview…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="success-page">
        <div className="page-header">
          <h1 className="page-title"><Icons.HeartHandshake size={22} /> Customer Success</h1>
        </div>
        <p style={{ color: "var(--color-red-500)" }}>{error}</p>
        <button className="btn btn-secondary" onClick={handleRetry}>Retry</button>
      </div>
    );
  }

  const m = data?.metrics;

  return (
    <div className="success-page">
      <div className="page-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Icons.HeartHandshake size={22} /> Customer Success
        </h1>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Link href="/success/portfolio" className="btn btn-secondary" style={{ fontSize: "0.8125rem" }}>Portfolio Health</Link>
          <Link href="/success/renewals" className="btn btn-secondary" style={{ fontSize: "0.8125rem" }}>Renewals</Link>
          <Link href="/success/risks" className="btn btn-secondary" style={{ fontSize: "0.8125rem" }}>Risks</Link>
          <Link href="/success/review" className="btn btn-secondary" style={{ fontSize: "0.8125rem" }}>Retention Review</Link>
        </div>
      </div>

      {/* Next Action Banner */}
      {data?.nextAction && (
        <div className="card" style={{
          borderLeft: `4px solid ${badgeClass(data.nextAction.badge)}`,
          marginBottom: "1.25rem",
          padding: "1rem 1.25rem",
        }}>
          <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
            Next recommended action
          </div>
          <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--text-primary)", marginBottom: "0.25rem" }}>
            {data.nextAction.action}
          </div>
          <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
            {data.nextAction.reason}
            {data.nextAction.client_name && (
              <> — <Link href={`/success/clients/${data.nextAction.client_id}`} style={{ color: "var(--color-primary)" }}>{data.nextAction.client_name}</Link></>
            )}
          </div>
          {data.nextAction.direct_route && (
            <Link href={data.nextAction.direct_route} className="btn btn-primary" style={{ marginTop: "0.75rem", fontSize: "0.8rem" }}>
              Take action <Icons.ArrowRight size={14} />
            </Link>
          )}
        </div>
      )}

      {/* KPI Tiles */}
      {m && (
        <div className="kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
          <div className="card kpi-tile">
            <div className="kpi-label">Total Clients</div>
            <div className="kpi-value">{m.totalClients}</div>
          </div>
          <div className="card kpi-tile" style={{ borderTop: `3px solid #10b981` }}>
            <div className="kpi-label">Healthy</div>
            <div className="kpi-value" style={{ color: "#10b981" }}>{m.healthyCount}</div>
          </div>
          <div className="card kpi-tile" style={{ borderTop: `3px solid #f59e0b` }}>
            <div className="kpi-label">Needs Attention</div>
            <div className="kpi-value" style={{ color: "#f59e0b" }}>{m.needsAttentionCount}</div>
          </div>
          <div className="card kpi-tile" style={{ borderTop: `3px solid #f97316` }}>
            <div className="kpi-label">At Risk</div>
            <div className="kpi-value" style={{ color: "#f97316" }}>{m.atRiskCount}</div>
          </div>
          <div className="card kpi-tile" style={{ borderTop: `3px solid #ef4444` }}>
            <div className="kpi-label">Critical</div>
            <div className="kpi-value" style={{ color: "#ef4444" }}>{m.criticalCount}</div>
          </div>
          <div className="card kpi-tile">
            <div className="kpi-label">Upcoming Renewals</div>
            <div className="kpi-value">{m.upcomingRenewalsCount}</div>
          </div>
          <div className="card kpi-tile">
            <div className="kpi-label">Waiting On Us</div>
            <div className="kpi-value" style={{ color: m.waitingOnUsCount > 0 ? "#f97316" : undefined }}>{m.waitingOnUsCount}</div>
          </div>
          <div className="card kpi-tile">
            <div className="kpi-label">Open Issues</div>
            <div className="kpi-value" style={{ color: m.openIssuesCount > 0 ? "#ef4444" : undefined }}>{m.openIssuesCount}</div>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.25rem" }}>

        {/* At-Risk Clients */}
        <div className="card">
          <div className="card-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 className="card-title" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <Icons.ShieldCheck size={16} /> At-Risk Clients
            </h2>
            <Link href="/success/portfolio" style={{ fontSize: "0.75rem", color: "var(--color-primary)" }}>View all</Link>
          </div>
          {!data?.atRiskClients?.length ? (
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", padding: "0.75rem 0" }}>No clients at risk.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {data.atRiskClients.map((ac) => (
                <li key={ac.client.id} style={{ padding: "0.6rem 0", borderBottom: "1px solid var(--border-subtle)" }}>
                  <Link href={`/success/clients/${ac.client.id}`} style={{ fontWeight: 500, color: "var(--text-primary)", textDecoration: "none" }}>
                    {ac.client.name}
                    {ac.client.company && <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginLeft: "0.4rem" }}>— {ac.client.company}</span>}
                  </Link>
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.2rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.7rem", padding: "1px 6px", borderRadius: 4, background: healthColor(ac.health.state) + "20", color: healthColor(ac.health.state), fontWeight: 600 }}>
                      {ac.health.state.replace("_", " ")}
                    </span>
                    {ac.activeRisksCount > 0 && <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>{ac.activeRisksCount} risk(s)</span>}
                    {ac.openIssuesCount > 0 && <span style={{ fontSize: "0.7rem", color: "#ef4444" }}>{ac.openIssuesCount} issue(s)</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Upcoming Renewals */}
        <div className="card">
          <div className="card-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 className="card-title" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <Icons.CalendarDays size={16} /> Upcoming Renewals
            </h2>
            <Link href="/success/renewals" style={{ fontSize: "0.75rem", color: "var(--color-primary)" }}>View all</Link>
          </div>
          {!data?.upcomingRenewals?.length ? (
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", padding: "0.75rem 0" }}>No upcoming renewals tracked.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {data.upcomingRenewals.map((r) => (
                <li key={r.id} style={{ padding: "0.6rem 0", borderBottom: "1px solid var(--border-subtle)" }}>
                  <Link href={`/success/clients/${r.client_id}`} style={{ fontWeight: 500, color: "var(--text-primary)", textDecoration: "none" }}>
                    {r.client_name ?? "Client"}
                  </Link>
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.2rem", flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{r.renewal_date}</span>
                    <span style={{ fontSize: "0.7rem", padding: "1px 6px", borderRadius: 4, background: forecastColor(r.forecast_category) + "20", color: forecastColor(r.forecast_category), fontWeight: 600 }}>
                      {r.forecast_category}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Waiting On Us */}
        <div className="card">
          <div className="card-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 className="card-title" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <Icons.Clock3 size={16} /> Waiting On Us
            </h2>
            <Link href="/success/check-ins" style={{ fontSize: "0.75rem", color: "var(--color-primary)" }}>Check-ins</Link>
          </div>
          {!data?.waitingOnUs?.length ? (
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", padding: "0.75rem 0" }}>No outstanding commitments owed to clients.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {data.waitingOnUs.map((w) => (
                <li key={w.id} style={{ padding: "0.6rem 0", borderBottom: "1px solid var(--border-subtle)" }}>
                  <Link href={w.route} style={{ fontWeight: 500, color: w.is_overdue ? "#ef4444" : "var(--text-primary)", textDecoration: "none", fontSize: "0.875rem" }}>
                    {w.what}
                  </Link>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.15rem" }}>
                    {w.client_name}{w.due ? ` · due ${w.due}` : ""}
                    {w.is_overdue && <span style={{ color: "#ef4444", marginLeft: "0.4rem" }}>Overdue</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent Signals */}
        <div className="card">
          <div className="card-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 className="card-title" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <Icons.Sparkles size={16} /> Recent Signals
            </h2>
          </div>
          {!data?.recentSignals?.length ? (
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", padding: "0.75rem 0" }}>No satisfaction signals recorded yet.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {data.recentSignals.map((s) => (
                <li key={s.id} style={{ padding: "0.6rem 0", borderBottom: "1px solid var(--border-subtle)" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                    <span style={{ fontSize: "1rem" }}>{signalIcon(s.signal_type)}</span>
                    <div>
                      <div style={{ fontSize: "0.8125rem", color: "var(--text-primary)", fontWeight: 500 }}>{s.summary}</div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: "0.1rem" }}>
                        {s.signal_type.replace(/_/g, " ")} · {new Date(s.recorded_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>

      {/* Quick nav links */}
      <div className="card" style={{ marginTop: "1.5rem" }}>
        <h2 className="card-title" style={{ marginBottom: "0.75rem" }}>Views</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {[
            ["Portfolio Health", "/success/portfolio"],
            ["Renewals", "/success/renewals"],
            ["Risks", "/success/risks"],
            ["Check-Ins", "/success/check-ins"],
            ["Client Journey", "/success/journey"],
            ["Retention Review", "/success/review"],
          ].map(([label, href]) => (
            <Link key={href} href={href} className="btn btn-secondary" style={{ fontSize: "0.8rem" }}>{label}</Link>
          ))}
        </div>
      </div>
    </div>
  );
}

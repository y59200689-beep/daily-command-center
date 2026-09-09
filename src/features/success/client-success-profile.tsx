"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface ClientProfile {
  client: {
    id: string;
    name: string;
    company?: string | null;
    email?: string | null;
    status: string;
    tier?: string | null;
    last_contact_at?: string | null;
  };
  health: { state: string; summary: string; nextSuggestedStep?: string; positiveReasons: string[]; negativeReasons: string[] };
  churn: { state: string; summary: string; reasons: string[]; mitigatingFactors: string[] };
  delivery: { state: string; reasons: string[] };
  onboarding: { state: string; reasons: string[] };
  expansion: { state: string; reasons: string[] };
  engagement: { state: string; daysSince: number | null; summary: string };
  outcomes: Array<{ id: string; title: string; status: string; priority: string; target_date?: string | null }>;
  plans: Array<{ id: string; title: string; status: string; period: string }>;
  commitments: Array<{ id: string; direction: string; statement: string; status: string; due_at?: string | null }>;
  waitingOnUs: Array<{ id: string; what: string; due?: string | null; is_overdue: boolean }>;
  waitingOnClient: Array<{ id: string; what: string; due?: string | null }>;
  checkIns: Array<{ id: string; purpose: string; status: string; scheduled_at?: string | null; check_in_type: string }>;
  risks: Array<{ id: string; risk_type: string; severity: string; description: string; status: string }>;
  renewals: Array<{ id: string; renewal_date: string; status: string; forecast_category: string; value?: number | null; currency: string }>;
  issues: Array<{ id: string; title: string; severity: string; status: string }>;
  signals: Array<{ id: string; signal_type: string; summary: string; recorded_at: string }>;
  milestones: Array<{ id: string; title: string; status: string; achieved_date?: string | null }>;
}

type Tab = "overview" | "outcomes" | "delivery" | "commitments" | "renewals" | "issues" | "checkins";

function healthColor(state: string) {
  if (state === "healthy") return "#10b981";
  if (state === "needs_attention") return "#f59e0b";
  if (state === "at_risk") return "#f97316";
  if (state === "critical") return "#ef4444";
  return "#6b7280";
}

function churnColor(state: string) {
  if (state === "low") return "#10b981";
  if (state === "watch") return "#f59e0b";
  if (state === "elevated") return "#f97316";
  if (state === "high") return "#ef4444";
  return "#6b7280";
}

function outcomeStatusColor(s: string) {
  if (s === "achieved") return "#10b981";
  if (s === "in_progress") return "#3b82f6";
  if (s === "at_risk") return "#f97316";
  if (s === "planned") return "#6b7280";
  return "#9ca3af";
}

function severityColor(s: string) {
  if (s === "critical") return "#ef4444";
  if (s === "high") return "#f97316";
  if (s === "medium") return "#f59e0b";
  if (s === "low") return "#10b981";
  return "#6b7280";
}

export function ClientSuccessProfile({ clientId }: { clientId: string }) {
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/success/clients/${clientId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed");
        return res.json();
      })
      .then((json) => {
        if (!cancelled) {
          setProfile(json);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Client success profile could not be loaded.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    fetch(`/api/success/clients/${clientId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed");
        return res.json();
      })
      .then((json) => {
        setProfile(json);
        setLoading(false);
      })
      .catch(() => {
        setError("Client success profile could not be loaded.");
        setLoading(false);
      });
  };

  if (loading) return <div className="success-page"><p style={{ color: "var(--text-secondary)", padding: "2rem 0" }}>Loading client profile…</p></div>;
  if (error) return <div className="success-page"><p style={{ color: "#ef4444" }}>{error}</p><button className="btn btn-secondary" onClick={handleRetry}>Retry</button></div>;
  if (!profile) return null;

  const { client, health, churn, delivery, expansion, engagement, outcomes, plans, commitments, waitingOnUs, checkIns, renewals, issues, signals, milestones } = profile;

  const TABS: [Tab, string][] = [
    ["overview", "Overview"],
    ["outcomes", `Outcomes (${outcomes.length})`],
    ["delivery", `Delivery`],
    ["commitments", `Commitments (${commitments.length})`],
    ["renewals", `Renewals (${renewals.length})`],
    ["issues", `Issues (${issues.length})`],
    ["checkins", `Check-Ins (${checkIns.length})`],
  ];

  return (
    <div className="success-page">
      <div className="page-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <Link href="/success" style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.25rem", display: "block" }}>← Customer Success</Link>
          <h1 className="page-title">{client.name}</h1>
          {client.company && <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>{client.company}</p>}
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <span style={{ padding: "3px 10px", borderRadius: 12, background: healthColor(health.state) + "20", color: healthColor(health.state), fontSize: "0.8rem", fontWeight: 600, alignSelf: "center" }}>
            {health.state.replace(/_/g, " ")}
          </span>
          <span style={{ padding: "3px 10px", borderRadius: 12, background: churnColor(churn.state) + "20", color: churnColor(churn.state), fontSize: "0.8rem", alignSelf: "center" }}>
            churn: {churn.state}
          </span>
        </div>
      </div>

      {/* Quick metrics */}
      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
        <div className="card kpi-tile" style={{ minWidth: 100 }}>
          <div className="kpi-label">Delivery</div>
          <div style={{ fontSize: "0.8rem", fontWeight: 600, color: delivery.state === "on_track" ? "#10b981" : "#f97316" }}>{delivery.state.replace(/_/g, " ")}</div>
        </div>
        <div className="card kpi-tile" style={{ minWidth: 100 }}>
          <div className="kpi-label">Expansion</div>
          <div style={{ fontSize: "0.8rem", fontWeight: 600, color: expansion.state === "ready" ? "#10b981" : "var(--text-secondary)" }}>{expansion.state.replace(/_/g, " ")}</div>
        </div>
        <div className="card kpi-tile" style={{ minWidth: 100 }}>
          <div className="kpi-label">Engagement</div>
          <div style={{ fontSize: "0.8rem", fontWeight: 600 }}>{engagement.state}{engagement.daysSince != null ? ` (${engagement.daysSince}d)` : ""}</div>
        </div>
        <div className="card kpi-tile" style={{ minWidth: 100 }}>
          <div className="kpi-label">Open Issues</div>
          <div style={{ fontSize: "0.8rem", fontWeight: 600, color: issues.filter(i => i.status !== "resolved" && i.status !== "closed").length > 0 ? "#ef4444" : "#10b981" }}>
            {issues.filter(i => i.status !== "resolved" && i.status !== "closed").length}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap", borderBottom: "1px solid var(--border-color)", marginBottom: "1.25rem" }}>
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding: "0.5rem 0.75rem",
            fontSize: "0.8125rem",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: tab === id ? "var(--color-primary)" : "var(--text-secondary)",
            borderBottom: tab === id ? "2px solid var(--color-primary)" : "2px solid transparent",
            fontWeight: tab === id ? 600 : 400,
          }}>{label}</button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
          <div className="card">
            <h3 style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem" }}>Account Health</h3>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-primary)", marginBottom: "0.5rem" }}>{health.summary}</p>
            {health.nextSuggestedStep && <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontStyle: "italic" }}>→ {health.nextSuggestedStep}</p>}
            {health.negativeReasons.length > 0 && (
              <ul style={{ listStyle: "none", padding: 0, margin: "0.5rem 0 0", fontSize: "0.75rem" }}>
                {health.negativeReasons.map((r, i) => <li key={i} style={{ color: "#ef4444", padding: "0.15rem 0" }}>⚠ {r}</li>)}
              </ul>
            )}
            {health.positiveReasons.length > 0 && (
              <ul style={{ listStyle: "none", padding: 0, margin: "0.25rem 0 0", fontSize: "0.75rem" }}>
                {health.positiveReasons.map((r, i) => <li key={i} style={{ color: "#10b981", padding: "0.15rem 0" }}>✓ {r}</li>)}
              </ul>
            )}
          </div>

          <div className="card">
            <h3 style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem" }}>Churn Risk</h3>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-primary)", marginBottom: "0.4rem" }}>{churn.summary}</p>
            {churn.reasons.map((r, i) => <div key={i} style={{ fontSize: "0.75rem", color: "#ef4444", padding: "0.1rem 0" }}>⚠ {r}</div>)}
            {churn.mitigatingFactors.map((f, i) => <div key={i} style={{ fontSize: "0.75rem", color: "#10b981", padding: "0.1rem 0" }}>✓ {f}</div>)}
          </div>

          {waitingOnUs.length > 0 && (
            <div className="card">
              <h3 style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem", color: "#f97316" }}>Waiting On Us ({waitingOnUs.length})</h3>
              {waitingOnUs.map((w) => (
                <div key={w.id} style={{ fontSize: "0.8rem", padding: "0.3rem 0", borderBottom: "1px solid var(--border-subtle)", color: w.is_overdue ? "#ef4444" : "var(--text-primary)" }}>
                  {w.what}{w.due && ` · due ${w.due}`}{w.is_overdue && " ⚠ OVERDUE"}
                </div>
              ))}
            </div>
          )}

          {signals.length > 0 && (
            <div className="card">
              <h3 style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem" }}>Recent Signals</h3>
              {signals.slice(0, 4).map((s) => (
                <div key={s.id} style={{ fontSize: "0.8rem", padding: "0.3rem 0", borderBottom: "1px solid var(--border-subtle)" }}>
                  <div style={{ color: "var(--text-primary)" }}>{s.summary}</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>{s.signal_type.replace(/_/g, " ")} · {new Date(s.recorded_at).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          )}

          {milestones.length > 0 && (
            <div className="card">
              <h3 style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem" }}>Milestones</h3>
              {milestones.map((m) => (
                <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.3rem 0", borderBottom: "1px solid var(--border-subtle)", fontSize: "0.8rem" }}>
                  <span style={{ color: "var(--text-primary)" }}>{m.title}</span>
                  <span style={{ color: m.status === "achieved" ? "#10b981" : m.status === "missed" ? "#ef4444" : "var(--text-secondary)", fontSize: "0.72rem", fontWeight: 600 }}>{m.status}</span>
                </div>
              ))}
            </div>
          )}

          {plans.length > 0 && (
            <div className="card">
              <h3 style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem" }}>Success Plans</h3>
              {plans.map((p) => (
                <div key={p.id} style={{ padding: "0.3rem 0", borderBottom: "1px solid var(--border-subtle)", fontSize: "0.8rem" }}>
                  <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{p.title}</span>
                  <span style={{ color: "var(--text-secondary)", marginLeft: "0.5rem", fontSize: "0.72rem" }}>{p.status} · {p.period}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Outcomes tab */}
      {tab === "outcomes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
          {outcomes.length === 0 && <p style={{ color: "var(--text-secondary)" }}>No outcomes tracked for this client yet.</p>}
          {outcomes.map((o) => (
            <div key={o.id} className="card" style={{ borderLeft: `3px solid ${outcomeStatusColor(o.status)}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span style={{ fontWeight: 500, color: "var(--text-primary)", fontSize: "0.875rem" }}>{o.title}</span>
                <span style={{ padding: "1px 8px", borderRadius: 10, background: outcomeStatusColor(o.status) + "20", color: outcomeStatusColor(o.status), fontSize: "0.72rem", fontWeight: 600, whiteSpace: "nowrap", marginLeft: "0.5rem" }}>{o.status.replace(/_/g, " ")}</span>
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                Priority: {o.priority}{o.target_date && ` · Target: ${o.target_date}`}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delivery tab */}
      {tab === "delivery" && (
        <div>
          <div className="card" style={{ marginBottom: "1rem" }}>
            <h3 style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.4rem" }}>Delivery Health: <span style={{ color: delivery.state === "on_track" ? "#10b981" : "#f97316" }}>{delivery.state.replace(/_/g, " ")}</span></h3>
            {delivery.reasons.map((r, i) => <p key={i} style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>• {r}</p>)}
          </div>
          <div className="card">
            <h3 style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.4rem" }}>Expansion Readiness: <span style={{ color: expansion.state === "ready" ? "#10b981" : "var(--text-secondary)" }}>{expansion.state.replace(/_/g, " ")}</span></h3>
            {expansion.reasons.map((r, i) => <p key={i} style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>• {r}</p>)}
          </div>
        </div>
      )}

      {/* Commitments tab */}
      {tab === "commitments" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
          {commitments.length === 0 && <p style={{ color: "var(--text-secondary)" }}>No commitments tracked.</p>}
          {commitments.map((c) => (
            <div key={c.id} className="card" style={{ borderLeft: `3px solid ${c.direction === "we_owe_client" ? "#f97316" : "#3b82f6"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <span style={{ fontSize: "0.7rem", color: c.direction === "we_owe_client" ? "#f97316" : "#3b82f6", fontWeight: 600, textTransform: "uppercase" }}>
                    {c.direction === "we_owe_client" ? "We owe client" : "Client owes us"}
                  </span>
                  <p style={{ fontSize: "0.875rem", color: "var(--text-primary)", margin: "0.2rem 0 0" }}>{c.statement}</p>
                </div>
                <span style={{ fontSize: "0.72rem", color: c.status === "completed" ? "#10b981" : c.status === "open" ? "#f59e0b" : "#6b7280", fontWeight: 600, whiteSpace: "nowrap", marginLeft: "0.5rem" }}>{c.status}</span>
              </div>
              {c.due_at && <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>Due: {new Date(c.due_at).toLocaleDateString()}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Renewals tab */}
      {tab === "renewals" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
          {renewals.length === 0 && <p style={{ color: "var(--text-secondary)" }}>No renewals tracked for this client.</p>}
          {renewals.map((r) => (
            <div key={r.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{r.renewal_date}</span>
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  <span style={{ padding: "1px 8px", borderRadius: 10, background: "#3b82f620", color: "#3b82f6", fontSize: "0.72rem" }}>{r.status.replace(/_/g, " ")}</span>
                  <span style={{ padding: "1px 8px", borderRadius: 10, background: "#f59e0b20", color: "#f59e0b", fontSize: "0.72rem" }}>{r.forecast_category}</span>
                </div>
              </div>
              {r.value != null && <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>{r.currency} {r.value.toLocaleString()}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Issues tab */}
      {tab === "issues" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
          {issues.length === 0 && <p style={{ color: "var(--text-secondary)" }}>No issues recorded.</p>}
          {issues.map((i) => (
            <div key={i.id} className="card" style={{ borderLeft: `3px solid ${severityColor(i.severity)}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span style={{ fontWeight: 500, color: "var(--text-primary)", fontSize: "0.875rem" }}>{i.title}</span>
                <div style={{ display: "flex", gap: "0.4rem", marginLeft: "0.5rem" }}>
                  <span style={{ padding: "1px 6px", borderRadius: 8, background: severityColor(i.severity) + "20", color: severityColor(i.severity), fontSize: "0.7rem", fontWeight: 600, whiteSpace: "nowrap" }}>{i.severity}</span>
                  <span style={{ padding: "1px 6px", borderRadius: 8, background: "var(--border-subtle)", color: "var(--text-secondary)", fontSize: "0.7rem", whiteSpace: "nowrap" }}>{i.status.replace(/_/g, " ")}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Check-Ins tab */}
      {tab === "checkins" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
          {checkIns.length === 0 && <p style={{ color: "var(--text-secondary)" }}>No check-ins logged for this client.</p>}
          {checkIns.map((ci) => (
            <div key={ci.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span style={{ fontWeight: 500, color: "var(--text-primary)", fontSize: "0.875rem" }}>{ci.purpose}</span>
                <span style={{ fontSize: "0.72rem", color: ci.status === "completed" ? "#10b981" : "var(--text-secondary)", fontWeight: 600, whiteSpace: "nowrap", marginLeft: "0.5rem" }}>{ci.status}</span>
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                {ci.check_in_type.replace(/_/g, " ")}{ci.scheduled_at && ` · ${new Date(ci.scheduled_at).toLocaleDateString()}`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

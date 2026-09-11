"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icons } from "@/components/icons";
import { SuccessSchemaUnavailable } from "./schema-unavailable";

interface RetentionReview {
  period: "week" | "month";
  metrics: {
    totalClients: number;
    openRisksCount: number;
    criticalRisksCount: number;
    openIssuesCount: number;
    achievedOutcomesCount: number;
    upcomingRenewalsCount: number;
    renewedCount: number;
    openCommitmentsCount: number;
    upcomingRenewalValueByCurrency: Record<string, number>;
    renewedValueByCurrency: Record<string, number>;
  };
  topRisks: Array<{ id: string; client_id: string; client?: { name: string } | null; risk_type: string; severity: string; description: string; status: string }>;
  topIssues: Array<{ id: string; client_id: string; client?: { name: string } | null; title: string; severity: string; status: string }>;
  upcomingRenewals: Array<{ id: string; client_id: string; client?: { name: string } | null; renewal_date: string; status: string; forecast_category: string; value?: number | null; currency: string }>;
}

export function RetentionReviewView() {
  const [data, setData] = useState<RetentionReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schemaUnavailable, setSchemaUnavailable] = useState(false);
  const [period, setPeriod] = useState<"week" | "month">("week");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/success/reviews?period=${period}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed");
        return res.json();
      })
      .then((json) => {
        if (!cancelled) {
          setSchemaUnavailable(json.schemaStatus === "unavailable");
          setData(json.data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Retention review could not be loaded.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  function formatCurrency(byCurrency: Record<string, number>) {
    return Object.entries(byCurrency)
      .map(([cur, val]) => `${cur} ${val.toLocaleString()}`)
      .join(" / ");
  }

  function severityColor(s: string) {
    if (s === "critical") return "#ef4444";
    if (s === "high") return "#f97316";
    if (s === "medium") return "#f59e0b";
    return "#6b7280";
  }

  function forecastColor(fc: string) {
    if (fc === "committed") return "#10b981";
    if (fc === "likely") return "#3b82f6";
    if (fc === "uncertain") return "#f59e0b";
    if (fc === "at_risk") return "#ef4444";
    return "#6b7280";
  }

  return (
    <div className="success-page">
      <div className="page-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Icons.ChartNoAxesCombined size={22} /> Retention Review
        </h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={() => setPeriod("week")} className={`btn ${period === "week" ? "btn-primary" : "btn-secondary"}`} style={{ fontSize: "0.8rem" }}>This Week</button>
          <button onClick={() => setPeriod("month")} className={`btn ${period === "month" ? "btn-primary" : "btn-secondary"}`} style={{ fontSize: "0.8rem" }}>This Month</button>
          <Link href="/success" className="btn btn-secondary" style={{ fontSize: "0.8125rem" }}>← Overview</Link>
        </div>
      </div>

      {loading && <p style={{ color: "var(--text-secondary)" }}>Loading retention review…</p>}
      {error && <p style={{ color: "var(--color-red-500)" }}>{error}</p>}
      {schemaUnavailable && <SuccessSchemaUnavailable />}

      {!loading && data && (
        <>
          {/* Metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
            {[
              { label: "Active Clients", value: data.metrics.totalClients, color: undefined },
              { label: "Open Risks", value: data.metrics.openRisksCount, color: data.metrics.openRisksCount > 0 ? "#f97316" : undefined },
              { label: "Critical Risks", value: data.metrics.criticalRisksCount, color: data.metrics.criticalRisksCount > 0 ? "#ef4444" : undefined },
              { label: "Open Issues", value: data.metrics.openIssuesCount, color: data.metrics.openIssuesCount > 0 ? "#ef4444" : undefined },
              { label: "Outcomes Achieved", value: data.metrics.achievedOutcomesCount, color: "#10b981" },
              { label: "Upcoming Renewals", value: data.metrics.upcomingRenewalsCount, color: undefined },
              { label: "Renewed", value: data.metrics.renewedCount, color: "#10b981" },
              { label: "Open Commitments", value: data.metrics.openCommitmentsCount, color: data.metrics.openCommitmentsCount > 0 ? "#f59e0b" : undefined },
            ].map((m) => (
              <div key={m.label} className="card kpi-tile">
                <div className="kpi-label">{m.label}</div>
                <div className="kpi-value" style={{ color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Renewal value */}
          {Object.keys(data.metrics.upcomingRenewalValueByCurrency).length > 0 && (
            <div className="card" style={{ marginBottom: "1.25rem" }}>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Upcoming renewal value: <strong>{formatCurrency(data.metrics.upcomingRenewalValueByCurrency)}</strong></div>
              {Object.keys(data.metrics.renewedValueByCurrency).length > 0 && (
                <div style={{ fontSize: "0.8rem", color: "#10b981", marginTop: "0.25rem" }}>Already renewed: <strong>{formatCurrency(data.metrics.renewedValueByCurrency)}</strong></div>
              )}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.25rem" }}>

            {/* Top Risks */}
            <div className="card">
              <h2 className="card-title" style={{ marginBottom: "0.75rem" }}>Top Open Risks</h2>
              {data.topRisks.length === 0 ? (
                <p style={{ fontSize: "0.8rem", color: "#10b981" }}>No open risks.</p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {data.topRisks.map((r) => (
                    <li key={r.id} style={{ padding: "0.5rem 0", borderBottom: "1px solid var(--border-subtle)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ fontSize: "0.8125rem", color: "var(--text-primary)", flex: 1 }}>{r.description.slice(0, 80)}{r.description.length > 80 ? "…" : ""}</div>
                        <span style={{ padding: "1px 6px", borderRadius: 8, background: severityColor(r.severity) + "20", color: severityColor(r.severity), fontSize: "0.7rem", fontWeight: 600, marginLeft: "0.5rem", whiteSpace: "nowrap" }}>
                          {r.severity}
                        </span>
                      </div>
                      <Link href={`/success/clients/${r.client_id}`} style={{ fontSize: "0.72rem", color: "var(--color-primary)" }}>View client →</Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Top Issues */}
            <div className="card">
              <h2 className="card-title" style={{ marginBottom: "0.75rem" }}>Top Open Issues</h2>
              {data.topIssues.length === 0 ? (
                <p style={{ fontSize: "0.8rem", color: "#10b981" }}>No open issues.</p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {data.topIssues.map((i) => (
                    <li key={i.id} style={{ padding: "0.5rem 0", borderBottom: "1px solid var(--border-subtle)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ fontSize: "0.8125rem", color: "var(--text-primary)", flex: 1 }}>{i.title}</div>
                        <span style={{ padding: "1px 6px", borderRadius: 8, background: severityColor(i.severity) + "20", color: severityColor(i.severity), fontSize: "0.7rem", fontWeight: 600, marginLeft: "0.5rem", whiteSpace: "nowrap" }}>
                          {i.severity}
                        </span>
                      </div>
                      <Link href={`/success/clients/${i.client_id}`} style={{ fontSize: "0.72rem", color: "var(--color-primary)" }}>View client →</Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Upcoming Renewals */}
            <div className="card">
              <h2 className="card-title" style={{ marginBottom: "0.75rem" }}>Upcoming Renewals</h2>
              {data.upcomingRenewals.length === 0 ? (
                <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>No upcoming renewals in this period.</p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {data.upcomingRenewals.map((r) => (
                    <li key={r.id} style={{ padding: "0.5rem 0", borderBottom: "1px solid var(--border-subtle)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.8125rem", color: "var(--text-primary)" }}>{r.renewal_date}</span>
                        <span style={{ padding: "1px 6px", borderRadius: 8, background: forecastColor(r.forecast_category) + "20", color: forecastColor(r.forecast_category), fontSize: "0.7rem", fontWeight: 600 }}>
                          {r.forecast_category}
                        </span>
                      </div>
                      {r.value != null && (
                        <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>{r.currency} {r.value.toLocaleString()}</div>
                      )}
                      <Link href={`/success/clients/${r.client_id}`} style={{ fontSize: "0.72rem", color: "var(--color-primary)" }}>View client →</Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

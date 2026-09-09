"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icons } from "@/components/icons";

interface PortfolioAccount {
  client: { id: string; name: string; company?: string | null; status: string };
  health: { state: string; summary: string; nextSuggestedStep?: string };
  churn: { state: string; summary: string };
  delivery: { state: string };
  expansion: { state: string };
  engagement: { state: string; daysSince?: number | null };
  counts: {
    outcomes: number;
    openCommitments: number;
    openRisks: number;
    openIssues: number;
    renewals: number;
  };
}

interface PortfolioData {
  portfolioAccounts: PortfolioAccount[];
  nextAction: {
    action: string;
    priority: number;
    client_name?: string;
    client_id?: string;
    reason: string;
    badge?: string;
    direct_route?: string;
  } | null;
  summary: {
    totalClients: number;
    healthBreakdown: {
      healthy: number;
      needs_attention: number;
      at_risk: number;
      critical: number;
      insufficient_data: number;
    };
    highChurnRiskCount: number;
    upcomingRenewalsCount: number;
    unfulfilledCommitmentsCount: number;
    criticalIssuesCount: number;
  };
}

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

export function PortfolioHealthView() {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/success/portfolio")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load portfolio");
        return res.json();
      })
      .then((json) => {
        if (!cancelled) {
          setData(json.data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Portfolio health could not be loaded.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const accounts = data?.portfolioAccounts.filter(
    (a) => filter === "all" || a.health.state === filter
  ) ?? [];

  return (
    <div className="success-page">
      <div className="page-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Icons.ShieldCheck size={22} /> Portfolio Health
        </h1>
        <Link href="/success" className="btn btn-secondary" style={{ fontSize: "0.8125rem" }}>← Overview</Link>
      </div>

      {loading && <p style={{ color: "var(--text-secondary)", padding: "1rem 0" }}>Loading portfolio…</p>}
      {error && <p style={{ color: "var(--color-red-500)" }}>{error}</p>}

      {data && (
        <>
          {/* Summary strip */}
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
            {(["all", "critical", "at_risk", "needs_attention", "healthy"] as const).map((f) => {
              const count =
                f === "all"
                  ? data.summary.totalClients
                  : data.summary.healthBreakdown[f as keyof typeof data.summary.healthBreakdown] ?? 0;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: "0.3rem 0.75rem",
                    borderRadius: 20,
                    border: `1.5px solid ${filter === f ? healthColor(f === "all" ? "healthy" : f) : "var(--border-color)"}`,
                    background: filter === f ? (healthColor(f === "all" ? "healthy" : f) + "15") : "transparent",
                    color: filter === f ? healthColor(f === "all" ? "healthy" : f) : "var(--text-secondary)",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                    fontWeight: filter === f ? 600 : 400,
                  }}
                >
                  {f === "all" ? "All" : f.replace(/_/g, " ")} ({count})
                </button>
              );
            })}
          </div>

          {/* Accounts table */}
          {accounts.length === 0 ? (
            <p style={{ color: "var(--text-secondary)" }}>No accounts match this filter.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border-subtle)", textAlign: "left" }}>
                    <th style={{ padding: "0.6rem 0.75rem", color: "var(--text-secondary)", fontWeight: 600, fontSize: "0.75rem" }}>Client</th>
                    <th style={{ padding: "0.6rem 0.75rem", color: "var(--text-secondary)", fontWeight: 600, fontSize: "0.75rem" }}>Health</th>
                    <th style={{ padding: "0.6rem 0.75rem", color: "var(--text-secondary)", fontWeight: 600, fontSize: "0.75rem" }}>Churn Risk</th>
                    <th style={{ padding: "0.6rem 0.75rem", color: "var(--text-secondary)", fontWeight: 600, fontSize: "0.75rem" }}>Delivery</th>
                    <th style={{ padding: "0.6rem 0.75rem", color: "var(--text-secondary)", fontWeight: 600, fontSize: "0.75rem" }}>Open Items</th>
                    <th style={{ padding: "0.6rem 0.75rem", color: "var(--text-secondary)", fontWeight: 600, fontSize: "0.75rem" }}>Engagement</th>
                    <th style={{ padding: "0.6rem 0" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.client.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <td style={{ padding: "0.65rem 0.75rem" }}>
                        <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>{a.client.name}</div>
                        {a.client.company && <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>{a.client.company}</div>}
                      </td>
                      <td style={{ padding: "0.65rem 0.75rem" }}>
                        <span style={{ padding: "2px 8px", borderRadius: 10, background: healthColor(a.health.state) + "20", color: healthColor(a.health.state), fontSize: "0.72rem", fontWeight: 600 }}>
                          {a.health.state.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td style={{ padding: "0.65rem 0.75rem" }}>
                        <span style={{ padding: "2px 8px", borderRadius: 10, background: churnColor(a.churn.state) + "20", color: churnColor(a.churn.state), fontSize: "0.72rem", fontWeight: 600 }}>
                          {a.churn.state}
                        </span>
                      </td>
                      <td style={{ padding: "0.65rem 0.75rem", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                        {a.delivery.state.replace(/_/g, " ")}
                      </td>
                      <td style={{ padding: "0.65rem 0.75rem" }}>
                        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", fontSize: "0.72rem" }}>
                          {a.counts.openRisks > 0 && <span style={{ color: "#f97316" }}>{a.counts.openRisks} risk{a.counts.openRisks !== 1 ? "s" : ""}</span>}
                          {a.counts.openIssues > 0 && <span style={{ color: "#ef4444" }}>{a.counts.openIssues} issue{a.counts.openIssues !== 1 ? "s" : ""}</span>}
                          {a.counts.openCommitments > 0 && <span style={{ color: "#f59e0b" }}>{a.counts.openCommitments} commitment{a.counts.openCommitments !== 1 ? "s" : ""}</span>}
                          {a.counts.openRisks === 0 && a.counts.openIssues === 0 && a.counts.openCommitments === 0 && <span style={{ color: "#10b981" }}>Clear</span>}
                        </div>
                      </td>
                      <td style={{ padding: "0.65rem 0.75rem", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                        {a.engagement.state}
                        {a.engagement.daysSince != null && <span style={{ fontSize: "0.7rem", marginLeft: "0.3rem" }}>({a.engagement.daysSince}d)</span>}
                      </td>
                      <td style={{ padding: "0.65rem 0.5rem" }}>
                        <Link href={`/success/clients/${a.client.id}`} style={{ fontSize: "0.75rem", color: "var(--color-primary)", whiteSpace: "nowrap" }}>
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

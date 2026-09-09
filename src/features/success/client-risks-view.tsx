"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icons } from "@/components/icons";

interface ClientRisk {
  id: string;
  client_id: string;
  client?: { id: string; name: string; company?: string | null } | null;
  risk_type: string;
  severity: string;
  description: string;
  status: string;
  mitigation?: string | null;
  review_at?: string | null;
  evidence?: string | null;
}

function severityColor(s: string) {
  if (s === "critical") return "#ef4444";
  if (s === "high") return "#f97316";
  if (s === "medium") return "#f59e0b";
  return "#6b7280";
}

function statusColor(s: string) {
  if (s === "resolved" || s === "dismissed") return "#10b981";
  if (s === "mitigating") return "#3b82f6";
  if (s === "monitoring") return "#f59e0b";
  return "#f97316";
}

const SEVERITY_FILTERS = ["all", "critical", "high", "medium", "low"] as const;
const STATUS_FILTERS = ["all", "open", "monitoring", "mitigating", "resolved", "dismissed"] as const;

export function ClientRisksView() {
  const [risks, setRisks] = useState<ClientRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severity, setSeverity] = useState("all");
  const [status, setStatus] = useState("open");

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (severity !== "all") params.set("severity", severity);
    if (status !== "all") params.set("status", status);
    fetch(`/api/success/risks?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed");
        return res.json();
      })
      .then((json) => {
        if (!cancelled) {
          setRisks(json.data ?? []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Risks could not be loaded.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [severity, status]);

  return (
    <div className="success-page">
      <div className="page-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Icons.Bell size={22} /> Client Risks
        </h1>
        <Link href="/success" className="btn btn-secondary" style={{ fontSize: "0.8125rem" }}>← Overview</Link>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", alignSelf: "center" }}>Severity:</span>
        {SEVERITY_FILTERS.map((f) => (
          <button key={f} onClick={() => setSeverity(f)} className={`btn ${severity === f ? "btn-primary" : "btn-secondary"}`} style={{ fontSize: "0.75rem" }}>
            {f}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", alignSelf: "center" }}>Status:</span>
        {STATUS_FILTERS.map((f) => (
          <button key={f} onClick={() => setStatus(f)} className={`btn ${status === f ? "btn-primary" : "btn-secondary"}`} style={{ fontSize: "0.75rem" }}>
            {f}
          </button>
        ))}
      </div>

      {loading && <p style={{ color: "var(--text-secondary)" }}>Loading risks…</p>}
      {error && <p style={{ color: "var(--color-red-500)" }}>{error}</p>}

      {!loading && risks.length === 0 && (
        <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
          <p style={{ color: "var(--text-secondary)" }}>No risks match this filter.</p>
        </div>
      )}

      {!loading && risks.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {risks.map((r) => (
            <div key={r.id} className="card" style={{ borderLeft: `3px solid ${severityColor(r.severity)}` }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                <div>
                  <Link href={`/success/clients/${r.client_id}`} style={{ fontWeight: 600, color: "var(--text-primary)", textDecoration: "none", fontSize: "0.9375rem" }}>
                    {r.client?.name ?? "Client"}
                  </Link>
                  {r.client?.company && <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginLeft: "0.4rem" }}>— {r.client.company}</span>}
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <span style={{ padding: "2px 8px", borderRadius: 10, background: severityColor(r.severity) + "20", color: severityColor(r.severity), fontSize: "0.72rem", fontWeight: 600 }}>
                    {r.severity}
                  </span>
                  <span style={{ padding: "2px 8px", borderRadius: 10, background: statusColor(r.status) + "20", color: statusColor(r.status), fontSize: "0.72rem" }}>
                    {r.status}
                  </span>
                </div>
              </div>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-primary)", marginTop: "0.4rem" }}>{r.description}</p>
              <div style={{ display: "flex", gap: "1rem", marginTop: "0.3rem", flexWrap: "wrap", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                <span><strong>Type:</strong> {r.risk_type.replace(/_/g, " ")}</span>
                {r.review_at && <span><strong>Review:</strong> {r.review_at}</span>}
              </div>
              {r.mitigation && (
                <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.3rem" }}>
                  <strong>Mitigation:</strong> {r.mitigation}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

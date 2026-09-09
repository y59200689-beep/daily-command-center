"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icons } from "@/components/icons";

interface Renewal {
  id: string;
  client_id: string;
  client?: { id: string; name: string; company?: string | null } | null;
  service?: { id: string; name: string } | null;
  renewal_date: string;
  renewal_type: string;
  status: string;
  forecast_category: string;
  value?: number | null;
  currency: string;
  preparation_state: string;
  next_action?: string | null;
  notes?: string | null;
}

function forecastColor(fc: string) {
  if (fc === "committed") return "#10b981";
  if (fc === "likely") return "#3b82f6";
  if (fc === "uncertain") return "#f59e0b";
  if (fc === "at_risk") return "#ef4444";
  return "#6b7280";
}

function prepColor(state: string) {
  if (state === "ready") return "#10b981";
  if (state === "in_progress") return "#3b82f6";
  if (state === "not_started") return "#f59e0b";
  return "#6b7280";
}

const STATUS_FILTERS = ["all", "upcoming", "preparing", "discussing", "renewed", "not_renewing"] as const;

export function RenewalsView() {
  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("all");

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    fetch(`/api/success/renewals?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed");
        return res.json();
      })
      .then((json) => {
        if (!cancelled) {
          setRenewals(json.data ?? []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Renewals could not be loaded.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  return (
    <div className="success-page">
      <div className="page-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Icons.CalendarDays size={22} /> Renewals
        </h1>
        <Link href="/success" className="btn btn-secondary" style={{ fontSize: "0.8125rem" }}>← Overview</Link>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
        {STATUS_FILTERS.map((f) => (
          <button key={f} onClick={() => setStatus(f)} className={`btn ${status === f ? "btn-primary" : "btn-secondary"}`} style={{ fontSize: "0.8rem" }}>
            {f === "all" ? "All" : f.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {loading && <p style={{ color: "var(--text-secondary)" }}>Loading renewals…</p>}
      {error && <p style={{ color: "var(--color-red-500)" }}>{error}</p>}

      {!loading && renewals.length === 0 && (
        <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
          <p style={{ color: "var(--text-secondary)", marginBottom: "0.5rem" }}>No renewals found.</p>
          <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Track renewal dates for clients from the client success profile.</p>
        </div>
      )}

      {!loading && renewals.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {renewals.map((r) => (
            <div key={r.id} className="card" style={{ borderLeft: `3px solid ${forecastColor(r.forecast_category)}` }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                <div>
                  <Link href={`/success/clients/${r.client_id}`} style={{ fontWeight: 600, color: "var(--text-primary)", textDecoration: "none", fontSize: "0.9375rem" }}>
                    {r.client?.name ?? "Client"}
                  </Link>
                  {r.client?.company && <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginLeft: "0.4rem" }}>— {r.client.company}</span>}
                  {r.service && <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginLeft: "0.4rem" }}>· {r.service.name}</span>}
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ padding: "2px 8px", borderRadius: 10, background: forecastColor(r.forecast_category) + "20", color: forecastColor(r.forecast_category), fontSize: "0.72rem", fontWeight: 600 }}>
                    {r.forecast_category}
                  </span>
                  <span style={{ padding: "2px 8px", borderRadius: 10, background: prepColor(r.preparation_state) + "20", color: prepColor(r.preparation_state), fontSize: "0.72rem" }}>
                    prep: {r.preparation_state.replace(/_/g, " ")}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem", flexWrap: "wrap", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                <span><strong>Date:</strong> {r.renewal_date}</span>
                <span><strong>Type:</strong> {r.renewal_type.replace(/_/g, " ")}</span>
                <span><strong>Status:</strong> {r.status.replace(/_/g, " ")}</span>
                {r.value != null && <span><strong>Value:</strong> {r.currency} {r.value.toLocaleString()}</span>}
              </div>
              {r.next_action && (
                <p style={{ fontSize: "0.8125rem", color: "var(--text-primary)", marginTop: "0.4rem" }}>
                  <strong>Next:</strong> {r.next_action}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

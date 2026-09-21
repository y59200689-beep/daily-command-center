"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SuccessSchemaUnavailable } from "./schema-unavailable";

interface CheckIn {
  id: string;
  client_id: string;
  client?: { id: string; name: string; company?: string | null } | null;
  check_in_type: string;
  scheduled_at?: string | null;
  completed_at?: string | null;
  status: string;
  purpose: string;
  summary?: string | null;
  next_action?: string | null;
}

function statusColor(s: string) {
  if (s === "completed") return "#10b981";
  if (s === "cancelled") return "#ef4444";
  if (s === "rescheduled") return "#f59e0b";
  return "#3b82f6";
}

const STATUS_FILTERS = ["all", "scheduled", "completed", "cancelled", "rescheduled"] as const;

export function CheckInsView() {
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schemaUnavailable, setSchemaUnavailable] = useState(false);
  const [status, setStatus] = useState("all");

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    fetch(`/api/success/check-ins?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed");
        return res.json();
      })
      .then((json) => {
        if (!cancelled) {
          setSchemaUnavailable(json.schemaStatus === "unavailable");
          setCheckIns(json.data ?? []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Check-ins could not be loaded.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  return (
    <main className="domain-page success-page">
      <header className="task-context-header">
        <div>
          <nav className="task-context-header__breadcrumb" aria-label="Breadcrumb">
            <span>Business</span>
            <span>/</span>
            <Link href="/success" style={{ color: "var(--muted)", textDecoration: "none" }}>Customer Success</Link>
            <span>/</span>
            <span className="current">Check-Ins</span>
          </nav>
          <div className="task-context-header__title-row">
            <h1>Client Check-Ins</h1>
            {checkIns.length > 0 && <span className="task-context-header__total-badge">{checkIns.length} check-ins</span>}
          </div>
          <p className="task-context-header__description">Regular client check-ins, health pulses, and communication logs.</p>
        </div>
        <div className="task-context-header__actions">
          <Link href="/success">Overview</Link>
        </div>
      </header>

      <div className="filter-bar">
        <span className="filter-label">Status:</span>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setStatus(f)}
            className={`filter-pill ${status === f ? "is-active" : ""}`}
          >
            {f === "all" ? "All" : f}
          </button>
        ))}
      </div>

      {loading && <p style={{ color: "var(--text-secondary)" }}>Loading check-ins…</p>}
      {error && <p style={{ color: "var(--color-red-500)" }}>{error}</p>}
      {schemaUnavailable && <SuccessSchemaUnavailable />}

      {!loading && !schemaUnavailable && checkIns.length === 0 && (
        <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
          <p style={{ color: "var(--text-secondary)" }}>No check-ins found. Schedule client check-ins from the client profile.</p>
        </div>
      )}

      {!loading && checkIns.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {checkIns.map((ci) => (
            <div key={ci.id} className="card" style={{ borderLeft: `3px solid ${statusColor(ci.status)}` }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                <div>
                  <Link href={`/success/clients/${ci.client_id}`} style={{ fontWeight: 600, color: "var(--text-primary)", textDecoration: "none", fontSize: "0.9375rem" }}>
                    {ci.client?.name ?? "Client"}
                  </Link>
                  {ci.client?.company && <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginLeft: "0.4rem" }}>— {ci.client.company}</span>}
                </div>
                <span style={{ padding: "2px 8px", borderRadius: 10, background: statusColor(ci.status) + "20", color: statusColor(ci.status), fontSize: "0.72rem", fontWeight: 600 }}>
                  {ci.status}
                </span>
              </div>
              <p style={{ fontSize: "0.875rem", color: "var(--text-primary)", marginTop: "0.4rem", fontWeight: 500 }}>{ci.purpose}</p>
              <div style={{ display: "flex", gap: "1rem", marginTop: "0.3rem", flexWrap: "wrap", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                <span><strong>Type:</strong> {ci.check_in_type.replace(/_/g, " ")}</span>
                {ci.scheduled_at && <span><strong>Scheduled:</strong> {new Date(ci.scheduled_at).toLocaleDateString()}</span>}
                {ci.completed_at && <span><strong>Completed:</strong> {new Date(ci.completed_at).toLocaleDateString()}</span>}
              </div>
              {ci.summary && (
                <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.35rem" }}>{ci.summary}</p>
              )}
              {ci.next_action && (
                <p style={{ fontSize: "0.8125rem", color: "var(--text-primary)", marginTop: "0.25rem" }}>
                  <strong>Next:</strong> {ci.next_action}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

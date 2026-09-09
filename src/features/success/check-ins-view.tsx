"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icons } from "@/components/icons";

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
    <div className="success-page">
      <div className="page-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Icons.MessageSquareText size={22} /> Client Check-Ins
        </h1>
        <Link href="/success" className="btn btn-secondary" style={{ fontSize: "0.8125rem" }}>← Overview</Link>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
        {STATUS_FILTERS.map((f) => (
          <button key={f} onClick={() => setStatus(f)} className={`btn ${status === f ? "btn-primary" : "btn-secondary"}`} style={{ fontSize: "0.8rem" }}>
            {f === "all" ? "All" : f}
          </button>
        ))}
      </div>

      {loading && <p style={{ color: "var(--text-secondary)" }}>Loading check-ins…</p>}
      {error && <p style={{ color: "var(--color-red-500)" }}>{error}</p>}

      {!loading && checkIns.length === 0 && (
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
    </div>
  );
}

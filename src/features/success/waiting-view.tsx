"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icons } from "@/components/icons";
import { SuccessSchemaUnavailable } from "./schema-unavailable";

interface WaitingItem {
  id: string;
  client_id: string;
  client_name: string;
  what: string;
  direction: string;
  since: string;
  due?: string | null;
  reason: string;
  route: string;
  is_overdue: boolean;
}

interface WaitingData {
  waitingOnUs: WaitingItem[];
  waitingOnClient: WaitingItem[];
}

export function WaitingView() {
  const [data, setData] = useState<WaitingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schemaUnavailable, setSchemaUnavailable] = useState(false);
  const [tab, setTab] = useState<"us" | "client">("us");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/success/waiting")
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
          setError("Waiting state could not be loaded.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = tab === "us" ? (data?.waitingOnUs ?? []) : (data?.waitingOnClient ?? []);

  return (
    <div className="success-page">
      <div className="page-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Icons.Clock3 size={22} /> Client Waiting State
        </h1>
        <Link href="/success" className="btn btn-secondary" style={{ fontSize: "0.8125rem" }}>← Overview</Link>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
        <button
          onClick={() => setTab("us")}
          className={`btn ${tab === "us" ? "btn-primary" : "btn-secondary"}`}
          style={{ fontSize: "0.875rem" }}
        >
          Waiting On Us {data && `(${data.waitingOnUs.length})`}
        </button>
        <button
          onClick={() => setTab("client")}
          className={`btn ${tab === "client" ? "btn-primary" : "btn-secondary"}`}
          style={{ fontSize: "0.875rem" }}
        >
          Waiting On Client {data && `(${data.waitingOnClient.length})`}
        </button>
      </div>

      {loading && <p style={{ color: "var(--text-secondary)" }}>Loading waiting state…</p>}
      {error && <p style={{ color: "var(--color-red-500)" }}>{error}</p>}
      {schemaUnavailable && <SuccessSchemaUnavailable />}

      {!loading && !schemaUnavailable && items.length === 0 && (
        <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
          <p style={{ color: "var(--text-secondary)" }}>
            {tab === "us" ? "No outstanding commitments owed to clients." : "No client-side prerequisites blocking progress."}
          </p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
          {items.map((item) => (
            <div key={item.id} className="card" style={{
              borderLeft: `3px solid ${item.is_overdue ? "#ef4444" : tab === "us" ? "#f97316" : "#3b82f6"}`,
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "0.75rem",
              flexWrap: "wrap",
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, color: item.is_overdue ? "#ef4444" : "var(--text-primary)", fontSize: "0.875rem" }}>
                  {item.what}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.15rem" }}>
                  <Link href={item.route} style={{ color: "var(--color-primary)", textDecoration: "none" }}>{item.client_name}</Link>
                  {" "}· since {item.since}
                  {item.due && ` · due ${item.due}`}
                  {item.is_overdue && <span style={{ color: "#ef4444", marginLeft: "0.4rem", fontWeight: 600 }}>OVERDUE</span>}
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "0.1rem", fontStyle: "italic" }}>{item.reason}</div>
              </div>
              <Link href={item.route} style={{ fontSize: "0.75rem", color: "var(--color-primary)", whiteSpace: "nowrap", alignSelf: "center" }}>
                View →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

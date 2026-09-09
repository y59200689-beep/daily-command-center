"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icons } from "@/components/icons";

interface OwnershipItem {
  id: string;
  entity_type: string;
  entity_id: string;
  entity_title: string;
  primary_owner?: { id: string; name: string } | null;
  backup_owner?: { id: string; name: string } | null;
  contributors?: Array<{ id: string; name: string }>;
  status: string;
  criticality?: string;
}

export function OwnershipMap() {
  const [items, setItems] = useState<OwnershipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");

  useEffect(() => {
    fetch("/api/team/ownership")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.items) setItems(json.items);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = items.filter((i) => {
    if (filterType === "all") return true;
    if (filterType === "unowned") return !i.primary_owner;
    return i.entity_type === filterType;
  });

  return (
    <div className="page-shell team-page">
      <div className="page-header">
        <div>
          <p className="eyebrow"><Link href="/team">← Team Command Center</Link></p>
          <h1>Ownership Map</h1>
          <p className="page-description">Cross-domain operational accountability without changing database security.</p>
        </div>
      </div>

      {/* FILTER TABS */}
      <div className="pill-tabs" style={{ margin: "20px 0" }}>
        <button className={`pill-tab ${filterType === "all" ? "is-active" : ""}`} onClick={() => setFilterType("all")}>All ({items.length})</button>
        <button className={`pill-tab ${filterType === "unowned" ? "is-active" : ""}`} onClick={() => setFilterType("unowned")}>Unowned ({items.filter((i) => !i.primary_owner).length})</button>
        <button className={`pill-tab ${filterType === "responsibility" ? "is-active" : ""}`} onClick={() => setFilterType("responsibility")}>Responsibilities</button>
        <button className={`pill-tab ${filterType === "project" ? "is-active" : ""}`} onClick={() => setFilterType("project")}>Projects</button>
        <button className={`pill-tab ${filterType === "client" ? "is-active" : ""}`} onClick={() => setFilterType("client")}>Clients</button>
        <button className={`pill-tab ${filterType === "sop" ? "is-active" : ""}`} onClick={() => setFilterType("sop")}>SOPs</button>
      </div>

      {loading ? (
        <p className="muted">Loading ownership map…</p>
      ) : filtered.length === 0 ? (
        <div className="data-surface empty-hero">
          <Icons.BriefcaseBusiness size={32} />
          <h3>No records found</h3>
          <p className="muted">Adjust filter or assign owners to operational records.</p>
        </div>
      ) : (
        <div className="item-stack">
          {filtered.map((item) => (
            <div key={item.id} className="data-surface" style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                <div>
                  <span className="badge badge--muted" style={{ textTransform: "uppercase", fontSize: "10px", marginBottom: "4px" }}>
                    {item.entity_type}
                  </span>
                  <h3 style={{ margin: "4px 0", fontSize: "16px" }}>{item.entity_title}</h3>
                </div>
                {item.criticality && (
                  <span className={`badge badge--${item.criticality === "critical" ? "danger" : "info"}`}>{item.criticality}</span>
                )}
              </div>

              <div style={{ display: "flex", gap: "24px", marginTop: "12px", borderTop: "1px solid var(--line)", paddingTop: "10px", flexWrap: "wrap" }}>
                <div>
                  <small className="muted" style={{ display: "block" }}>Primary Owner</small>
                  {item.primary_owner ? (
                    <strong style={{ fontSize: "13px" }}>{item.primary_owner.name}</strong>
                  ) : (
                    <span className="badge badge--danger">Unowned</span>
                  )}
                </div>

                {item.backup_owner && (
                  <div>
                    <small className="muted" style={{ display: "block" }}>Backup Owner</small>
                    <strong style={{ fontSize: "13px" }}>{item.backup_owner.name}</strong>
                  </div>
                )}

                {item.contributors && item.contributors.length > 0 && (
                  <div>
                    <small className="muted" style={{ display: "block" }}>Contributors</small>
                    <span style={{ fontSize: "13px" }}>{item.contributors.map((c) => c.name).join(", ")}</span>
                  </div>
                )}

                <div>
                  <small className="muted" style={{ display: "block" }}>Status</small>
                  <span className="muted" style={{ fontSize: "13px" }}>{item.status}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

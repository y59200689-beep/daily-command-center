"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { Icons } from "@/components/icons";
import { Modal } from "@/components/ui/modal";

interface Responsibility {
  id: string;
  name: string;
  description?: string | null;
  criticality: string;
  status: string;
  review_cadence?: string | null;
  primary_owner?: { id: string; name: string; role_title?: string } | null;
  backup_owner?: { id: string; name: string; role_title?: string } | null;
}

interface Person {
  id: string;
  name: string;
  role_title?: string | null;
}

export function ResponsibilitiesView() {
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [criticalityFilter, setCriticalityFilter] = useState("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [criticality, setCriticality] = useState("medium");
  const [primaryOwnerId, setPrimaryOwnerId] = useState("");
  const [backupOwnerId, setBackupOwnerId] = useState("");
  const [reviewCadence, setReviewCadence] = useState("monthly");
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const loadData = useCallback(() => {
    let url = "/api/team/responsibilities?";
    if (criticalityFilter !== "all") url += `criticality=${criticalityFilter}`;

    Promise.all([
      fetch(url).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/team/people").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([respJson, peopleJson]) => {
        if (respJson?.data) setResponsibilities(respJson.data);
        if (peopleJson?.data) setPeople(peopleJson.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [criticalityFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (primaryOwnerId && backupOwnerId && primaryOwnerId === backupOwnerId) {
      setErrorMsg("Primary and backup owner cannot be the same person.");
      return;
    }
    setCreating(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/team/responsibilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          criticality,
          primary_owner_id: primaryOwnerId || null,
          backup_owner_id: backupOwnerId || null,
          review_cadence: reviewCadence,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create responsibility.");

      setCreateOpen(false);
      setName("");
      setDescription("");
      setPrimaryOwnerId("");
      setBackupOwnerId("");
      loadData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error creating responsibility.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="page-shell team-page">
      <div className="page-header">
        <div>
          <p className="eyebrow"><Link href="/team">← Team Command Center</Link></p>
          <h1>Responsibility Areas</h1>
          <p className="page-description">Ongoing organizational responsibilities and backup ownership coverage.</p>
        </div>
        <div className="header-actions">
          <button onClick={() => setCreateOpen(true)} className="button button--primary">
            <Icons.Plus size={16} /> New Responsibility
          </button>
        </div>
      </div>

      {/* FILTER */}
      <div className="filter-bar" style={{ display: "flex", gap: "12px", margin: "20px 0" }}>
        <select
          value={criticalityFilter}
          onChange={(e) => setCriticalityFilter(e.target.value)}
          className="select-input"
        >
          <option value="all">All criticalities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {loading ? (
        <p className="muted">Loading responsibilities…</p>
      ) : responsibilities.length === 0 ? (
        <div className="data-surface empty-hero">
          <Icons.Target size={32} />
          <h3>No responsibilities recorded</h3>
          <p className="muted">Map an ongoing area (e.g. Invoicing, Deployments, Support).</p>
        </div>
      ) : (
        <div className="item-stack">
          {responsibilities.map((r) => {
            const hasNoBackup = !r.backup_owner && (r.criticality === "critical" || r.criticality === "high");

            return (
              <div key={r.id} className="data-surface" style={{ padding: "18px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                  <div>
                    <h3 style={{ margin: "0 0 4px 0", fontSize: "16px" }}>{r.name}</h3>
                    {r.description && <p className="muted" style={{ fontSize: "13px", margin: "0 0 8px 0" }}>{r.description}</p>}
                  </div>
                  <span className={`badge badge--${r.criticality === "critical" ? "danger" : r.criticality === "high" ? "warning" : "info"}`}>
                    {r.criticality}
                  </span>
                </div>

                <div className="team-resp-owners-row" style={{ display: "flex", gap: "24px", marginTop: "12px", borderTop: "1px solid var(--line)", paddingTop: "12px", flexWrap: "wrap" }}>
                  <div>
                    <small className="muted" style={{ display: "block" }}>Primary Owner</small>
                    {r.primary_owner ? (
                      <Link href={`/team/people/${r.primary_owner.id}`} style={{ fontWeight: 600 }}>
                        {r.primary_owner.name}
                      </Link>
                    ) : (
                      <span className="badge badge--danger">Needs Owner</span>
                    )}
                  </div>

                  <div>
                    <small className="muted" style={{ display: "block" }}>Backup Owner</small>
                    {r.backup_owner ? (
                      <Link href={`/team/people/${r.backup_owner.id}`} style={{ fontWeight: 600 }}>
                        {r.backup_owner.name}
                      </Link>
                    ) : hasNoBackup ? (
                      <span className="badge badge--warning">Single-owner dependency</span>
                    ) : (
                      <span className="muted">None assigned</span>
                    )}
                  </div>

                  {r.review_cadence && (
                    <div>
                      <small className="muted" style={{ display: "block" }}>Review Cadence</small>
                      <span style={{ fontSize: "13px", textTransform: "capitalize" }}>{r.review_cadence}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE MODAL */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Responsibility Area">
        <form onSubmit={handleCreate} style={{ display: "grid", gap: "14px" }}>
          {errorMsg && <p className="error-text" style={{ color: "var(--danger)" }}>{errorMsg}</p>}
          <div>
            <label className="field-label">Area Name *</label>
            <input required type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Weekly Accounts Receivable" className="text-input" />
          </div>
          <div>
            <label className="field-label">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this responsibility entail?" className="text-input" rows={2} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label className="field-label">Primary Owner</label>
              <select value={primaryOwnerId} onChange={(e) => setPrimaryOwnerId(e.target.value)} className="select-input">
                <option value="">Unassigned</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} {p.role_title ? `(${p.role_title})` : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Backup Owner</label>
              <select value={backupOwnerId} onChange={(e) => setBackupOwnerId(e.target.value)} className="select-input">
                <option value="">No backup</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} {p.role_title ? `(${p.role_title})` : ""}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label className="field-label">Criticality</label>
              <select value={criticality} onChange={(e) => setCriticality(e.target.value)} className="select-input">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="field-label">Review Cadence</label>
              <select value={reviewCadence} onChange={(e) => setReviewCadence(e.target.value)} className="select-input">
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
            <button type="button" onClick={() => setCreateOpen(false)} className="button button--secondary">Cancel</button>
            <button type="submit" disabled={creating} className="button button--primary">{creating ? "Creating…" : "Create Responsibility"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

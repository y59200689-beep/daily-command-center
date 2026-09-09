"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icons } from "@/components/icons";
import { Modal } from "@/components/ui/modal";

interface TeamRisk {
  id: string;
  risk: string;
  severity: string;
  evidence: string;
  suggested_action: string;
  route: string;
}

interface Escalation {
  id: string;
  reason: string;
  severity: string;
  status: string;
  resolution?: string | null;
  person?: { id: string; name: string } | null;
  created_at: string;
}

interface Person {
  id: string;
  name: string;
}

export function TeamRisks() {
  const [risks, setRisks] = useState<TeamRisk[]>([]);
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  // New escalation modal
  const [escOpen, setEscOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [personId, setPersonId] = useState("");
  const [creating, setCreating] = useState(false);

  const loadData = () => {
    Promise.all([
      fetch("/api/team/risks").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/team/escalations").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/team/people").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([risksJson, escJson, peopleJson]) => {
        if (risksJson?.risks) setRisks(risksJson.risks);
        if (escJson?.data) setEscalations(escJson.data);
        if (peopleJson?.data) setPeople(peopleJson.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateEscalation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    setCreating(true);

    try {
      const res = await fetch("/api/team/escalations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reason.trim(),
          severity,
          person_id: personId || null,
        }),
      });
      if (res.ok) {
        setEscOpen(false);
        setReason("");
        setPersonId("");
        loadData();
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="page-shell team-page">
      <div className="page-header">
        <div>
          <p className="eyebrow"><Link href="/team">← Team Command Center</Link></p>
          <h1>Team Risks & Escalations</h1>
          <p className="page-description">
            Coordination bottlenecks, single-owner dependencies, and operational escalations.
          </p>
        </div>
        <div className="header-actions">
          <button onClick={() => setEscOpen(true)} className="button button--primary">
            <Icons.Plus size={16} /> Log Escalation
          </button>
        </div>
      </div>

      {loading ? (
        <p className="muted">Loading risks…</p>
      ) : (
        <div style={{ display: "grid", gap: "28px", marginTop: "20px" }}>
          {/* RISKS */}
          <div className="data-surface">
            <div className="section-heading section-heading--small">
              <div>
                <p className="eyebrow">Deterministic Signals</p>
                <h2>Active Coordination Risks ({risks.length})</h2>
              </div>
            </div>
            {risks.length === 0 ? (
              <p className="muted" style={{ padding: "12px 0" }}>No coordination risks detected across team members.</p>
            ) : (
              <div className="item-stack">
                {risks.map((r) => (
                  <div key={r.id} className="team-list-row">
                    <div>
                      <strong style={{ fontSize: "14px" }}>{r.risk}</strong>
                      <p className="muted" style={{ fontSize: "13px", margin: "2px 0" }}>{r.evidence}</p>
                      <small style={{ color: "var(--attention)", fontWeight: 600 }}>Suggested: {r.suggested_action}</small>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span className={`badge badge--${r.severity === "critical" ? "danger" : r.severity === "high" ? "warning" : "info"}`}>
                        {r.severity}
                      </span>
                      {r.route && (
                        <Link href={r.route} className="button button--small button--secondary">
                          View
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ESCALATIONS */}
          <div className="data-surface">
            <div className="section-heading section-heading--small">
              <div>
                <p className="eyebrow">Operational Issues</p>
                <h2>Escalations ({escalations.length})</h2>
              </div>
            </div>
            {escalations.length === 0 ? (
              <p className="muted" style={{ padding: "12px 0" }}>No escalations logged.</p>
            ) : (
              <div className="item-stack">
                {escalations.map((e) => (
                  <div key={e.id} className="team-list-row">
                    <div>
                      <strong>{e.reason}</strong>
                      <small className="muted" style={{ display: "block", marginTop: "2px" }}>
                        {e.person ? `Person: ${e.person.name} · ` : ""}Logged: {e.created_at.slice(0, 10)}
                      </small>
                      {e.resolution && <p className="muted" style={{ fontSize: "12px", marginTop: "4px" }}>Resolved: {e.resolution}</p>}
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <span className={`badge badge--${e.severity === "critical" ? "danger" : "warning"}`}>{e.severity}</span>
                      <span className={`badge badge--${e.status === "resolved" ? "healthy" : "info"}`}>{e.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE ESCALATION MODAL */}
      <Modal open={escOpen} onClose={() => setEscOpen(false)} title="Log Operational Escalation">
        <form onSubmit={handleCreateEscalation} style={{ display: "grid", gap: "14px" }}>
          <div>
            <label className="field-label">Escalation Reason *</label>
            <textarea required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Describe the operational issue requiring escalation" className="text-input" rows={3} />
          </div>
          <div>
            <label className="field-label">Related Person (Optional)</label>
            <select value={personId} onChange={(e) => setPersonId(e.target.value)} className="select-input">
              <option value="">None / System wide</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Severity</label>
            <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="select-input">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <button type="button" onClick={() => setEscOpen(false)} className="button button--secondary">Cancel</button>
            <button type="submit" disabled={creating || !reason.trim()} className="button button--primary">{creating ? "Logging…" : "Log Escalation"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

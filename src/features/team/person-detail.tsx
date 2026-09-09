"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { Icons } from "@/components/icons";
import { Modal } from "@/components/ui/modal";

interface PersonDetailProps {
  id: string;
}

interface Person {
  id: string;
  name: string;
  display_name?: string | null;
  role_title?: string | null;
  company_team?: string | null;
  email?: string | null;
  phone?: string | null;
  relationship_type: string;
  status: string;
  timezone?: string | null;
  working_hours?: string | null;
  notes?: string | null;
}

interface Delegation {
  id: string;
  title: string;
  expected_outcome: string;
  status: string;
  priority: string;
  due_at?: string | null;
}

interface Responsibility {
  id: string;
  name: string;
  criticality: string;
  status: string;
  primary_owner_id?: string | null;
}

interface Commitment {
  id: string;
  statement: string;
  status: string;
  due_at?: string | null;
}

export function PersonDetail({ id }: PersonDetailProps) {
  const [person, setPerson] = useState<Person | null>(null);
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([]);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [capacity, setCapacity] = useState<{ capacity_state: string; reasons: string[] } | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [companyTeam, setCompanyTeam] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("active");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // New delegation modal
  const [delOpen, setDelOpen] = useState(false);
  const [delTitle, setDelTitle] = useState("");
  const [delOutcome, setDelOutcome] = useState("");
  const [delPriority, setDelPriority] = useState("medium");
  const [delDue, setDelDue] = useState("");
  const [creatingDel, setCreatingDel] = useState(false);

  const loadData = useCallback(() => {
    Promise.all([
      fetch(`/api/team/people/${id}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/team/people/${id}/workload`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([detailJson, workloadJson]) => {
        if (detailJson?.person) {
          setPerson(detailJson.person);
          setName(detailJson.person.name);
          setRoleTitle(detailJson.person.role_title || "");
          setCompanyTeam(detailJson.person.company_team || "");
          setEmail(detailJson.person.email || "");
          setStatus(detailJson.person.status);
          setNotes(detailJson.person.notes || "");
          setDelegations(detailJson.delegations ?? []);
          setResponsibilities(detailJson.responsibilities ?? []);
          setCommitments(detailJson.commitments ?? []);
        }
        if (workloadJson?.capacity) {
          setCapacity(workloadJson.capacity);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/team/people/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          role_title: roleTitle.trim() || null,
          company_team: companyTeam.trim() || null,
          email: email.trim() || null,
          status,
          notes: notes.trim() || null,
        }),
      });
      if (res.ok) {
        setEditOpen(false);
        loadData();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCreateDelegation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!delTitle.trim() || !delOutcome.trim()) return;
    setCreatingDel(true);
    try {
      const res = await fetch("/api/team/delegations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: delTitle.trim(),
          expected_outcome: delOutcome.trim(),
          delegated_to_person_id: id,
          priority: delPriority,
          due_at: delDue || null,
        }),
      });
      if (res.ok) {
        setDelOpen(false);
        setDelTitle("");
        setDelOutcome("");
        setDelDue("");
        loadData();
      }
    } finally {
      setCreatingDel(false);
    }
  };

  if (loading) {
    return <div className="page-shell"><p className="muted">Loading person detail…</p></div>;
  }

  if (!person) {
    return (
      <div className="page-shell">
        <p className="error-text">Person not found.</p>
        <Link href="/team/people">← Return to directory</Link>
      </div>
    );
  }

  return (
    <div className="page-shell team-page">
      <div className="page-header">
        <div>
          <p className="eyebrow"><Link href="/team/people">← People Directory</Link></p>
          <h1>{person.name}</h1>
          <p className="page-description">
            {person.role_title || "Team Member"} {person.company_team ? `· ${person.company_team}` : ""}
          </p>
        </div>
        <div className="header-actions">
          <button onClick={() => setEditOpen(true)} className="button button--secondary">
            Edit
          </button>
          <Link href={`/team/1on1?person_id=${id}`} className="button button--secondary">
            <Icons.MessageSquareText size={16} /> 1:1 Prep
          </Link>
          <button onClick={() => setDelOpen(true)} className="button button--primary">
            <Icons.Plus size={16} /> Delegate Work
          </button>
        </div>
      </div>

      {/* OVERVIEW CARDS */}
      <div className="team-dashboard-grid" style={{ marginBottom: "24px" }}>
        {/* CAPACITY & METADATA */}
        <div className="data-surface">
          <div className="section-heading section-heading--small">
            <div>
              <p className="eyebrow">Workload Context</p>
              <h2>Capacity State</h2>
            </div>
            {capacity && (
              <span className={`badge badge--${capacity.capacity_state === "overloaded" ? "danger" : capacity.capacity_state === "busy" ? "warning" : "healthy"}`}>
                {capacity.capacity_state}
              </span>
            )}
          </div>
          {capacity && (
            <ul style={{ margin: "10px 0 16px 18px", padding: 0 }}>
              {capacity.reasons.map((r, i) => (
                <li key={i} className="muted" style={{ fontSize: "13px" }}>{r}</li>
              ))}
            </ul>
          )}
          <div className="detail-meta-list" style={{ borderTop: "1px solid var(--line)", paddingTop: "12px", display: "grid", gap: "6px" }}>
            <div><small className="muted">Relationship: </small><strong>{person.relationship_type.replace("_", " ")}</strong></div>
            {person.email && <div><small className="muted">Email: </small><strong>{person.email}</strong></div>}
            {person.phone && <div><small className="muted">Phone: </small><strong>{person.phone}</strong></div>}
            {person.timezone && <div><small className="muted">Timezone: </small><strong>{person.timezone}</strong></div>}
            {person.working_hours && <div><small className="muted">Hours: </small><strong>{person.working_hours}</strong></div>}
            {person.notes && <p className="muted" style={{ fontSize: "12px", marginTop: "8px" }}>{person.notes}</p>}
          </div>
        </div>

        {/* RESPONSIBILITY AREAS */}
        <div className="data-surface">
          <div className="section-heading section-heading--small">
            <div>
              <p className="eyebrow">Ongoing Scope</p>
              <h2>Responsibilities ({responsibilities.length})</h2>
            </div>
            <Link href="/team/responsibilities">All areas</Link>
          </div>
          {responsibilities.length === 0 ? (
            <p className="muted" style={{ padding: "12px 0" }}>No responsibilities assigned to {person.name}.</p>
          ) : (
            <div className="item-stack">
              {responsibilities.map((r) => (
                <div key={r.id} className="team-list-row">
                  <div>
                    <strong>{r.name}</strong>
                    <small className="muted" style={{ display: "block" }}>
                      {r.primary_owner_id === person.id ? "Primary Owner" : "Backup Owner"}
                    </small>
                  </div>
                  <span className={`badge badge--${r.criticality === "critical" ? "danger" : "info"}`}>
                    {r.criticality}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ACTIVE DELEGATIONS */}
      <div className="data-surface" style={{ marginBottom: "24px" }}>
        <div className="section-heading section-heading--small">
          <div>
            <p className="eyebrow">Expected Outcomes</p>
            <h2>Delegated Work ({delegations.length})</h2>
          </div>
          <button onClick={() => setDelOpen(true)} className="button button--small button--primary">
            + New
          </button>
        </div>
        {delegations.length === 0 ? (
          <p className="muted" style={{ padding: "12px 0" }}>No work currently delegated to this person.</p>
        ) : (
          <div className="item-stack">
            {delegations.map((d) => (
              <div key={d.id} className="team-list-row">
                <div>
                  <strong>{d.title}</strong>
                  <p className="muted" style={{ fontSize: "12px", margin: "2px 0" }}>{d.expected_outcome}</p>
                  <small className="muted">{d.due_at ? `Due: ${d.due_at.slice(0, 10)}` : "No due date"}</small>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span className={`badge badge--${d.priority === "critical" ? "danger" : "info"}`}>
                    {d.priority}
                  </span>
                  <span className={`badge badge--${d.status === "completed" ? "healthy" : d.status === "blocked" ? "danger" : "warning"}`}>
                    {d.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* COMMITMENTS */}
      <div className="data-surface">
        <div className="section-heading section-heading--small">
          <div>
            <p className="eyebrow">Explicit Agreements</p>
            <h2>Commitments ({commitments.length})</h2>
          </div>
        </div>
        {commitments.length === 0 ? (
          <p className="muted" style={{ padding: "12px 0" }}>No commitments recorded.</p>
        ) : (
          <div className="item-stack">
            {commitments.map((c) => (
              <div key={c.id} className="team-list-row">
                <div>
                  <strong>{c.statement}</strong>
                  <small className="muted" style={{ display: "block" }}>{c.due_at ? `Target: ${c.due_at.slice(0, 10)}` : "Ongoing"}</small>
                </div>
                <span className={`badge badge--${c.status === "done" ? "healthy" : "warning"}`}>{c.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* EDIT MODAL */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Person">
        <form onSubmit={handleSaveEdit} style={{ display: "grid", gap: "14px" }}>
          <div>
            <label className="field-label">Name</label>
            <input required type="text" value={name} onChange={(e) => setName(e.target.value)} className="text-input" />
          </div>
          <div>
            <label className="field-label">Role / Title</label>
            <input type="text" value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} className="text-input" />
          </div>
          <div>
            <label className="field-label">Company / Team</label>
            <input type="text" value={companyTeam} onChange={(e) => setCompanyTeam(e.target.value)} className="text-input" />
          </div>
          <div>
            <label className="field-label">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="text-input" />
          </div>
          <div>
            <label className="field-label">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="select-input">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="external">External</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div>
            <label className="field-label">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="text-input" rows={3} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <button type="button" onClick={() => setEditOpen(false)} className="button button--secondary">Cancel</button>
            <button type="submit" disabled={saving} className="button button--primary">{saving ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </Modal>

      {/* DELEGATE WORK MODAL */}
      <Modal open={delOpen} onClose={() => setDelOpen(false)} title={`Delegate Work to ${person.name}`}>
        <form onSubmit={handleCreateDelegation} style={{ display: "grid", gap: "14px" }}>
          <div>
            <label className="field-label">Delegation Title *</label>
            <input required type="text" value={delTitle} onChange={(e) => setDelTitle(e.target.value)} placeholder="e.g. Audit supplier invoice discrepancies" className="text-input" />
          </div>
          <div>
            <label className="field-label">Expected Outcome *</label>
            <textarea required value={delOutcome} onChange={(e) => setDelOutcome(e.target.value)} placeholder="Clear description of the expected result or deliverable" className="text-input" rows={3} />
          </div>
          <div>
            <label className="field-label">Priority</label>
            <select value={delPriority} onChange={(e) => setDelPriority(e.target.value)} className="select-input">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div>
            <label className="field-label">Target Due Date</label>
            <input type="date" value={delDue} onChange={(e) => setDelDue(e.target.value)} className="text-input" />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <button type="button" onClick={() => setDelOpen(false)} className="button button--secondary">Cancel</button>
            <button type="submit" disabled={creatingDel} className="button button--primary">{creatingDel ? "Delegating…" : "Delegate"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { Icons } from "@/components/icons";
import { Modal } from "@/components/ui/modal";

interface Delegation {
  id: string;
  title: string;
  description?: string | null;
  expected_outcome: string;
  delegated_to_person_id: string;
  delegated_to?: { id: string; name: string; role_title?: string; avatar_url?: string | null } | null;
  status: string;
  priority: string;
  due_at?: string | null;
  review_at?: string | null;
  blocked_reason?: string | null;
  completion_summary?: string | null;
}

interface Person {
  id: string;
  name: string;
  role_title?: string | null;
}

export function DelegationsView() {
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "waiting_team" | "waiting_me" | "blocked" | "completed">("all");

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [expectedOutcome, setExpectedOutcome] = useState("");
  const [personId, setPersonId] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [creating, setCreating] = useState(false);

  // Reassign modal
  const [reassignOpen, setReassignOpen] = useState(false);
  const [targetDelegation, setTargetDelegation] = useState<Delegation | null>(null);
  const [newPersonId, setNewPersonId] = useState("");
  const [reassignReason, setReassignReason] = useState("");
  const [reassigning, setReassigning] = useState(false);

  // Blocker modal
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [blocking, setBlocking] = useState(false);

  const loadData = useCallback(() => {
    let url = "/api/team/delegations?";
    if (tab === "waiting_team") url += "waiting=team&";
    else if (tab === "waiting_me") url += "waiting=me&";
    else if (tab === "blocked") url += "status=blocked&";
    else if (tab === "completed") url += "status=completed&";

    Promise.all([
      fetch(url).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/team/people").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([delJson, peopleJson]) => {
        if (delJson?.data) setDelegations(delJson.data);
        if (peopleJson?.data) setPeople(peopleJson.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [tab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !expectedOutcome.trim() || !personId) return;
    setCreating(true);

    try {
      const res = await fetch("/api/team/delegations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          expected_outcome: expectedOutcome.trim(),
          delegated_to_person_id: personId,
          priority,
          due_at: dueDate || null,
        }),
      });
      if (res.ok) {
        setCreateOpen(false);
        setTitle("");
        setExpectedOutcome("");
        setDueDate("");
        loadData();
      }
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string, blockedReason?: string) => {
    await fetch(`/api/team/delegations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: newStatus,
        blocked_reason: blockedReason || null,
      }),
    });
    loadData();
  };

  const handleReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDelegation || !newPersonId) return;
    setReassigning(true);

    try {
      const res = await fetch(`/api/team/delegations/${targetDelegation.id}/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          new_person_id: newPersonId,
          reason: reassignReason.trim() || null,
        }),
      });
      if (res.ok) {
        setReassignOpen(false);
        setTargetDelegation(null);
        setNewPersonId("");
        setReassignReason("");
        loadData();
      }
    } finally {
      setReassigning(false);
    }
  };

  const handleBlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDelegation) return;
    setBlocking(true);
    try {
      await handleUpdateStatus(targetDelegation.id, "blocked", blockReason);
      setBlockOpen(false);
      setTargetDelegation(null);
      setBlockReason("");
    } finally {
      setBlocking(false);
    }
  };

  return (
    <div className="page-shell team-page">
      <div className="page-header">
        <div>
          <p className="eyebrow"><Link href="/team">← Team Command Center</Link></p>
          <h1>Delegations</h1>
          <p className="page-description">Manage responsibility for outcomes delegated to people.</p>
        </div>
        <div className="header-actions">
          <button onClick={() => setCreateOpen(true)} className="button button--primary">
            <Icons.Plus size={16} /> New Delegation
          </button>
        </div>
      </div>

      {/* TABS */}
      <div className="pill-tabs" style={{ margin: "20px 0" }}>
        <button className={`pill-tab ${tab === "all" ? "is-active" : ""}`} onClick={() => setTab("all")}>All</button>
        <button className={`pill-tab ${tab === "waiting_team" ? "is-active" : ""}`} onClick={() => setTab("waiting_team")}>Waiting on Team</button>
        <button className={`pill-tab ${tab === "waiting_me" ? "is-active" : ""}`} onClick={() => setTab("waiting_me")}>Waiting on Me</button>
        <button className={`pill-tab ${tab === "blocked" ? "is-active" : ""}`} onClick={() => setTab("blocked")}>Blocked</button>
        <button className={`pill-tab ${tab === "completed" ? "is-active" : ""}`} onClick={() => setTab("completed")}>Completed</button>
      </div>

      {loading ? (
        <p className="muted">Loading delegations…</p>
      ) : delegations.length === 0 ? (
        <div className="data-surface empty-hero">
          <Icons.ListTodo size={32} />
          <h3>No delegations in this view</h3>
          <p className="muted">Delegate an outcome or switch tabs.</p>
        </div>
      ) : (
        <div className="item-stack">
          {delegations.map((d) => (
            <div key={d.id} className="data-surface" style={{ padding: "18px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                <div>
                  <h3 style={{ margin: "0 0 4px 0", fontSize: "16px" }}>{d.title}</h3>
                  <p className="muted" style={{ fontSize: "13px", margin: "0 0 8px 0" }}>
                    <strong>Outcome:</strong> {d.expected_outcome}
                  </p>
                  {d.blocked_reason && (
                    <p style={{ color: "var(--danger)", fontSize: "12px", margin: "0 0 6px 0" }}>
                      <strong>Blocked:</strong> {d.blocked_reason}
                    </p>
                  )}
                  <small className="muted">
                    Delegated to:{" "}
                    {d.delegated_to ? (
                      <Link href={`/team/people/${d.delegated_to.id}`} style={{ fontWeight: 600 }}>
                        {d.delegated_to.name}
                      </Link>
                    ) : (
                      "Assignee"
                    )}{" "}
                    · {d.due_at ? `Due: ${d.due_at.slice(0, 10)}` : "Ongoing"}
                  </small>
                </div>

                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span className={`badge badge--${d.priority === "critical" ? "danger" : "info"}`}>{d.priority}</span>
                  <span className={`badge badge--${d.status === "completed" ? "healthy" : d.status === "blocked" ? "danger" : "warning"}`}>{d.status}</span>
                </div>
              </div>

              {/* ACTIONS STRIP */}
              <div style={{ display: "flex", gap: "8px", marginTop: "14px", borderTop: "1px solid var(--line)", paddingTop: "12px", flexWrap: "wrap" }}>
                {d.status === "assigned" && (
                  <button onClick={() => handleUpdateStatus(d.id, "in_progress")} className="button button--small button--secondary">
                    Mark In Progress
                  </button>
                )}
                {d.status === "in_progress" && (
                  <button onClick={() => handleUpdateStatus(d.id, "needs_review")} className="button button--small button--secondary">
                    Mark Ready for Review
                  </button>
                )}
                {d.status === "needs_review" && (
                  <button onClick={() => handleUpdateStatus(d.id, "completed")} className="button button--small button--primary">
                    Accept & Complete
                  </button>
                )}
                {d.status !== "blocked" && d.status !== "completed" && (
                  <button
                    onClick={() => {
                      setTargetDelegation(d);
                      setBlockOpen(true);
                    }}
                    className="button button--small button--secondary"
                  >
                    Raise Blocker
                  </button>
                )}
                {d.status === "blocked" && (
                  <button onClick={() => handleUpdateStatus(d.id, "in_progress")} className="button button--small button--primary">
                    Unblock
                  </button>
                )}
                {d.status !== "completed" && (
                  <button
                    onClick={() => {
                      setTargetDelegation(d);
                      setReassignOpen(true);
                    }}
                    className="button button--small button--secondary"
                  >
                    Reassign…
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE MODAL */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Delegation">
        <form onSubmit={handleCreate} style={{ display: "grid", gap: "14px" }}>
          <div>
            <label className="field-label">Title *</label>
            <input required type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Set up weekly inventory sync" className="text-input" />
          </div>
          <div>
            <label className="field-label">Expected Outcome *</label>
            <textarea required value={expectedOutcome} onChange={(e) => setExpectedOutcome(e.target.value)} placeholder="What specific result will confirm this is complete?" className="text-input" rows={3} />
          </div>
          <div>
            <label className="field-label">Delegate To *</label>
            <select required value={personId} onChange={(e) => setPersonId(e.target.value)} className="select-input">
              <option value="">Select person</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.name} {p.role_title ? `(${p.role_title})` : ""}</option>
              ))}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label className="field-label">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="select-input">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="field-label">Due Date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="text-input" />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
            <button type="button" onClick={() => setCreateOpen(false)} className="button button--secondary">Cancel</button>
            <button type="submit" disabled={creating || !personId} className="button button--primary">{creating ? "Creating…" : "Delegate"}</button>
          </div>
        </form>
      </Modal>

      {/* REASSIGN MODAL */}
      <Modal open={reassignOpen} onClose={() => setReassignOpen(false)} title="Reassign Delegation">
        <form onSubmit={handleReassign} style={{ display: "grid", gap: "14px" }}>
          <p className="muted" style={{ fontSize: "13px" }}>
            Reassigning <strong>{targetDelegation?.title}</strong> will preserve history and record the transfer.
          </p>
          <div>
            <label className="field-label">New Assignee *</label>
            <select required value={newPersonId} onChange={(e) => setNewPersonId(e.target.value)} className="select-input">
              <option value="">Select new person</option>
              {people.filter((p) => p.id !== targetDelegation?.delegated_to_person_id).map((p) => (
                <option key={p.id} value={p.id}>{p.name} {p.role_title ? `(${p.role_title})` : ""}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Reason for Reassignment</label>
            <textarea value={reassignReason} onChange={(e) => setReassignReason(e.target.value)} placeholder="e.g. Workload rebalancing, specialist handover" className="text-input" rows={2} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <button type="button" onClick={() => setReassignOpen(false)} className="button button--secondary">Cancel</button>
            <button type="submit" disabled={reassigning || !newPersonId} className="button button--primary">{reassigning ? "Reassigning…" : "Confirm Reassign"}</button>
          </div>
        </form>
      </Modal>

      {/* BLOCK MODAL */}
      <Modal open={blockOpen} onClose={() => setBlockOpen(false)} title="Record Blocker">
        <form onSubmit={handleBlockSubmit} style={{ display: "grid", gap: "14px" }}>
          <div>
            <label className="field-label">Blocker Reason *</label>
            <textarea required value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="What is blocking this outcome from proceeding?" className="text-input" rows={3} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <button type="button" onClick={() => setBlockOpen(false)} className="button button--secondary">Cancel</button>
            <button type="submit" disabled={blocking || !blockReason.trim()} className="button button--primary">{blocking ? "Saving…" : "Save Blocker"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

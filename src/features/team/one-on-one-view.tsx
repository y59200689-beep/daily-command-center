"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Icons } from "@/components/icons";
import { TeamSchemaUnavailable } from "./team-schema-unavailable";

interface PersonOption {
  id: string;
  name: string;
  role_title?: string | null;
}

interface PrepData {
  person: { id: string; name: string; role_title?: string | null };
  openDelegations: Array<{ id: string; title: string; priority: string; status: string; due_at?: string | null }>;
  blockedDelegations: Array<{ id: string; title: string; blocked_reason?: string | null }>;
  completedRecently: Array<{ id: string; title: string }>;
  commitments: Array<{ id: string; statement: string }>;
  pastNotes: Array<{ id: string; meeting_date: string; topics_discussed?: string | null; action_items?: string | null }>;
  suggestedTopics: string[];
}

export function OneOnOneView() {
  const searchParams = useSearchParams();
  const initialPersonId = searchParams.get("person_id") || "";

  const [people, setPeople] = useState<PersonOption[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState(initialPersonId);
  const [prep, setPrep] = useState<PrepData | null>(null);
  const [loading, setLoading] = useState(false);
  const [schemaUnavailable, setSchemaUnavailable] = useState(false);

  // Form
  const [meetingDate, setMeetingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [topics, setTopics] = useState("");
  const [actionItems, setActionItems] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/team/1on1")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        setSchemaUnavailable(json?.schemaStatus === "unavailable");
        if (json?.people) {
          setPeople(json.people);
          if (json.people.length > 0) {
            setSelectedPersonId((prev) => prev || json.people[0].id);
          }
        }
      });
  }, []);

  useEffect(() => {
    if (!selectedPersonId) return;
    let active = true;
    fetch(`/api/team/1on1?person_id=${selectedPersonId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!active) return;
        if (json) setPrep(json);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedPersonId]);

  const refreshPrep = (personId: string) => {
    if (!personId) return;
    fetch(`/api/team/1on1?person_id=${personId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json) setPrep(json);
      });
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPersonId) return;
    setSaving(true);
    setSavedSuccess(false);

    try {
      const res = await fetch("/api/team/1on1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          person_id: selectedPersonId,
          meeting_date: meetingDate,
          topics_discussed: topics.trim() || null,
          action_items: actionItems.trim() || null,
          note_content: noteContent.trim() || null,
        }),
      });
      if (res.ok) {
        setSavedSuccess(true);
        setTopics("");
        setActionItems("");
        setNoteContent("");
        refreshPrep(selectedPersonId);
      }
    } finally {
      setSaving(false);
    }
  };

  if (schemaUnavailable) return <TeamSchemaUnavailable title="1:1 Preparation & Follow-through" description="Objective meeting context, open loops, and operational follow-through without subjective employee ranking." />;

  return (
    <div className="page-shell team-page">
      <div className="page-header">
        <div>
          <p className="eyebrow"><Link href="/team">← Team Command Center</Link></p>
          <h1>1:1 Preparation & Follow-through</h1>
          <p className="page-description">
            Objective meeting context, open loops, and operational follow-through without subjective employee ranking.
          </p>
        </div>
      </div>

      {/* PERSON SELECTOR */}
      <div style={{ margin: "20px 0", maxWidth: "340px" }}>
        <label className="field-label">Select Team Member</label>
        <select
          value={selectedPersonId}
          onChange={(e) => {
            setSelectedPersonId(e.target.value);
            setLoading(true);
            setSavedSuccess(false);
          }}
          className="select-input"
        >
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.name} {p.role_title ? `(${p.role_title})` : ""}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="muted">Loading 1:1 context…</p>
      ) : !prep ? (
        <div className="data-surface empty-hero">
          <Icons.MessageSquareText size={32} />
          <h3>Select a person to prepare a 1:1</h3>
        </div>
      ) : (
        <div className="team-dashboard-grid" style={{ alignItems: "start" }}>
          {/* LEFT: CONTEXT & OPEN LOOPS */}
          <div style={{ display: "grid", gap: "20px" }}>
            {/* SUGGESTED TOPICS */}
            <div className="data-surface">
              <div className="section-heading section-heading--small">
                <div>
                  <p className="eyebrow">Deterministic Discussion Points</p>
                  <h2>Suggested Topics</h2>
                </div>
              </div>
              <ul style={{ margin: "8px 0 0 18px", padding: 0 }}>
                {prep.suggestedTopics.map((t, idx) => (
                  <li key={idx} style={{ fontSize: "13px", lineHeight: "1.6" }}>{t}</li>
                ))}
              </ul>
            </div>

            {/* BLOCKED ITEMS */}
            {prep.blockedDelegations.length > 0 && (
              <div className="data-surface" style={{ borderColor: "var(--danger)" }}>
                <div className="section-heading section-heading--small">
                  <div>
                    <p className="eyebrow" style={{ color: "var(--danger)" }}>Needs Immediate Help</p>
                    <h2>Blocked Work ({prep.blockedDelegations.length})</h2>
                  </div>
                </div>
                <div className="item-stack">
                  {prep.blockedDelegations.map((d) => (
                    <div key={d.id} className="team-list-row">
                      <div>
                        <strong>{d.title}</strong>
                        <p style={{ fontSize: "12px", color: "var(--danger)", margin: "2px 0" }}>{d.blocked_reason || "Blocked"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* OPEN DELEGATIONS */}
            <div className="data-surface">
              <div className="section-heading section-heading--small">
                <div>
                  <p className="eyebrow">Active Deliverables</p>
                  <h2>Open Delegations ({prep.openDelegations.length})</h2>
                </div>
              </div>
              {prep.openDelegations.length === 0 ? (
                <p className="muted" style={{ padding: "8px 0" }}>No open delegations.</p>
              ) : (
                <div className="item-stack">
                  {prep.openDelegations.map((d) => (
                    <div key={d.id} className="team-list-row">
                      <div>
                        <strong>{d.title}</strong>
                        <small className="muted" style={{ display: "block" }}>{d.due_at ? `Due: ${d.due_at.slice(0, 10)}` : "Ongoing"}</small>
                      </div>
                      <span className={`badge badge--${d.status === "in_progress" ? "info" : "warning"}`}>{d.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* COMMITMENTS */}
            {prep.commitments.length > 0 && (
              <div className="data-surface">
                <div className="section-heading section-heading--small">
                  <div>
                    <p className="eyebrow">Agreements</p>
                    <h2>Commitments ({prep.commitments.length})</h2>
                  </div>
                </div>
                <div className="item-stack">
                  {prep.commitments.map((c) => (
                    <div key={c.id} className="team-list-row">
                      <span>{c.statement}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: RECORD 1:1 NOTES */}
          <div className="data-surface">
            <div className="section-heading section-heading--small">
              <div>
                <p className="eyebrow">Record 1:1</p>
                <h2>Meeting Follow-through</h2>
              </div>
            </div>
            {savedSuccess && (
              <p style={{ color: "var(--success)", fontSize: "13px", margin: "8px 0" }}>
                ✓ 1:1 meeting note preserved and linked to Notes library.
              </p>
            )}
            <form onSubmit={handleSaveNote} style={{ display: "grid", gap: "14px" }}>
              <div>
                <label className="field-label">Meeting Date</label>
                <input
                  type="date"
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  className="text-input"
                />
              </div>
              <div>
                <label className="field-label">Topics Discussed</label>
                <textarea
                  value={topics}
                  onChange={(e) => setTopics(e.target.value)}
                  placeholder="Key items, blockers discussed, or alignment reached…"
                  className="text-input"
                  rows={3}
                />
              </div>
              <div>
                <label className="field-label">Action Items / Decisions</label>
                <textarea
                  value={actionItems}
                  onChange={(e) => setActionItems(e.target.value)}
                  placeholder="Specific follow-up actions agreed upon…"
                  className="text-input"
                  rows={3}
                />
              </div>
              <div>
                <label className="field-label">General Meeting Notes</label>
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Optional additional notes to store with the meeting note…"
                  className="text-input"
                  rows={3}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="submit" disabled={saving || (!topics && !actionItems && !noteContent)} className="button button--primary">
                  {saving ? "Saving…" : "Save 1:1 Note"}
                </button>
              </div>
            </form>

            {/* PREVIOUS NOTES */}
            {prep.pastNotes.length > 0 && (
              <div style={{ marginTop: "24px", borderTop: "1px solid var(--line)", paddingTop: "16px" }}>
                <p className="eyebrow">Past 1:1 Notes ({prep.pastNotes.length})</p>
                <div className="item-stack" style={{ marginTop: "8px" }}>
                  {prep.pastNotes.slice(0, 3).map((n) => (
                    <div key={n.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                      <strong style={{ fontSize: "13px" }}>{n.meeting_date}</strong>
                      {n.topics_discussed && <p className="muted" style={{ fontSize: "12px", margin: "4px 0" }}>{n.topics_discussed}</p>}
                      {n.action_items && <p style={{ fontSize: "12px", margin: "2px 0", color: "var(--attention)" }}>Actions: {n.action_items}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

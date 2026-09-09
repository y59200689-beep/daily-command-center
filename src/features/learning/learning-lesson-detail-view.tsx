"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import "./learning.css";

interface LessonDetailProps {
  id: string;
}

interface LessonData {
  id: string;
  title: string;
  statement: string;
  status: string;
  confidence_state: string;
  domain: string;
  scope: string;
  why_proposed?: string;
  suggested_use?: string;
  evidence_count?: number;
  last_reviewed_at?: string;
  review_at?: string;
  superseded_by?: string;
  freshness?: string;
}

interface EvidenceRecord {
  id: string;
  evidence_type: string;
  evidence_id?: string;
  description?: string;
  source_context?: string;
  source_table?: string;
  source_quality?: string;
  is_counterexample?: boolean;
  created_at: string;
}

interface AuditRecord {
  id: string;
  action: string;
  notes?: string;
  reviewed_at: string;
}

interface LessonDetailData {
  lesson: LessonData;
  evidence: EvidenceRecord[];
  entities?: Record<string, unknown>[];
  auditLog: AuditRecord[];
}

export function LearningLessonDetailView({ id }: LessonDetailProps) {
  const [detail, setDetail] = useState<LessonDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editStatement, setEditStatement] = useState("");
  const [actionError, setActionError] = useState("");
  const [processing, setProcessing] = useState(false);

  const loadData = React.useCallback(() => {
    fetch(`/api/learning/lessons/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setDetail(data);
        if (data.lesson) {
          setEditStatement(data.lesson.statement);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load lesson detail", err);
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAction = async (action: string, extraPayload: Record<string, unknown> = {}) => {
    setProcessing(true);
    setActionError("");

    try {
      const res = await fetch(`/api/learning/lessons/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extraPayload }),
      });

      const json = await res.json();
      if (!res.ok) {
        setActionError(json.error || "Action failed.");
      } else {
        setShowAcceptModal(false);
        setShowEditModal(false);
        loadData();
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="learning-container">
        <p style={{ color: "#94a3b8" }}>Loading lesson detail...</p>
      </div>
    );
  }

  if (!detail || !detail.lesson) {
    return (
      <div className="learning-container">
        <div className="learning-card">
          <h2>Lesson Not Found</h2>
          <Link href="/learning/lessons" className="learning-btn-secondary">
            &larr; Back to Lessons
          </Link>
        </div>
      </div>
    );
  }

  const { lesson, evidence, auditLog } = detail;

  return (
    <div className="learning-container">
      <div className="learning-hero">
        <div className="learning-hero-header">
          <div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem" }}>
              <span className={`learning-badge badge-${lesson.status === "accepted" ? "current" : "review_soon"}`}>
                {lesson.status}
              </span>
              <span className={`learning-badge badge-${lesson.confidence_state}`}>
                {lesson.confidence_state} confidence
              </span>
              <span style={{ fontSize: "0.8rem", textTransform: "uppercase", color: "#94a3b8" }}>
                {lesson.domain} ({lesson.scope})
              </span>
            </div>
            <h1 className="learning-title">{lesson.title}</h1>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {lesson.status === "proposed" && (
              <button
                onClick={() => setShowAcceptModal(true)}
                className="learning-btn-primary"
              >
                Accept Into Memory
              </button>
            )}
            {lesson.status === "accepted" && (
              <button
                onClick={() => handleAction("retire")}
                className="learning-btn-danger"
              >
                Retire Lesson
              </button>
            )}
            <button
              onClick={() => setShowEditModal(true)}
              className="learning-btn-secondary"
            >
              Edit Statement
            </button>
            <Link href="/learning/lessons" className="learning-btn-secondary">
              &larr; Lessons
            </Link>
          </div>
        </div>
      </div>

      {actionError && (
        <div style={{ padding: "0.75rem", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "0.5rem", color: "#f87171" }}>
          {actionError}
        </div>
      )}

      {/* Statement & Guidance */}
      <section className="learning-section">
        <div className="learning-section-title">
          <span>Operating Statement &amp; Rationale</span>
        </div>
        <div className="learning-card">
          <p style={{ fontSize: "1.1rem", lineHeight: 1.6, margin: 0 }}>
            {lesson.statement}
          </p>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "0.75rem", marginTop: "0.5rem" }}>
            <strong style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Why Proposed (Empirical Basis):</strong>
            <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.9rem", color: "#cbd5e1" }}>
              {lesson.why_proposed}
            </p>
          </div>
          {lesson.suggested_use && (
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "0.75rem", marginTop: "0.5rem" }}>
              <strong style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Suggested Operating Use:</strong>
              <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.9rem", color: "#cbd5e1" }}>
                {lesson.suggested_use}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Evidence & Counterexamples */}
      <section className="learning-section">
        <div className="learning-section-title">
          <span>Evidence Ledger ({evidence.length})</span>
        </div>
        {evidence.length === 0 ? (
          <div className="learning-card" style={{ color: "#94a3b8" }}>
            No individual historical evidence links attached to this lesson.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {evidence.map(item => (
              <div key={item.id} className="learning-card" style={{ padding: "0.85rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className={`learning-badge ${item.is_counterexample ? "badge-conflicting" : "badge-current"}`}>
                    {item.is_counterexample ? "Counterexample" : "Supporting Evidence"}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{item.source_table} ({item.source_quality})</span>
                </div>
                <p style={{ margin: "0.35rem 0 0 0", fontSize: "0.875rem" }}>{item.description}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Audit Log */}
      <section className="learning-section">
        <div className="learning-section-title">
          <span>Audit History ({auditLog.length})</span>
        </div>
        <div className="learning-card" style={{ padding: "0.75rem" }}>
          {auditLog.map(log => (
            <div key={log.id} style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div>
                <strong style={{ textTransform: "uppercase", fontSize: "0.8rem", marginRight: "0.5rem" }}>{log.action}</strong>
                <span style={{ fontSize: "0.85rem", color: "#cbd5e1" }}>{log.notes}</span>
              </div>
              <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{new Date(log.reviewed_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Safety Acceptance Modal */}
      {showAcceptModal && (
        <div className="learning-modal-overlay">
          <div className="learning-modal-content">
            <h2 style={{ fontSize: "1.25rem", margin: 0 }}>Human Acceptance Confirmation</h2>
            <div style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: "0.5rem", padding: "0.75rem", color: "#fbbf24", fontSize: "0.85rem" }}>
              <strong>Operational Impact Preview:</strong>
              <p style={{ margin: "0.25rem 0 0 0" }}>
                Accepting this lesson will add it to the active Operating Memory for domain <strong>{lesson.domain}</strong>.
                AI agents and workflow suggestions will treat this statement as institutional guidance.
              </p>
            </div>

            <div className="learning-card" style={{ background: "#1e293b", padding: "0.85rem" }}>
              <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Lesson statement:</span>
              <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.9rem" }}>{lesson.statement}</p>
            </div>

            <p style={{ fontSize: "0.8rem", color: "#94a3b8", margin: 0 }}>
              Review cadence: automatically scheduled for review in 90 days. You can supersede or retire this lesson at any time.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
              <button
                type="button"
                onClick={() => setShowAcceptModal(false)}
                className="learning-btn-secondary"
                disabled={processing}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleAction("accept")}
                className="learning-btn-primary"
                disabled={processing}
              >
                {processing ? "Accepting..." : "Confirm & Accept"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="learning-modal-overlay">
          <div className="learning-modal-content">
            <h2 style={{ fontSize: "1.25rem", margin: 0 }}>Edit Operating Statement</h2>
            <textarea
              rows={4}
              value={editStatement}
              onChange={(e) => setEditStatement(e.target.value)}
              style={{ width: "100%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "0.375rem", padding: "0.5rem", color: "#f8fafc" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="learning-btn-secondary"
                disabled={processing}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleAction("edit", { statement: editStatement })}
                className="learning-btn-primary"
                disabled={processing}
              >
                {processing ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

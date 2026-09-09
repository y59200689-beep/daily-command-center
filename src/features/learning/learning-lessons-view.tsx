"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { OperatingLesson } from "@/lib/learning";
import "./learning.css";

export function LearningLessonsView() {
  const [lessons, setLessons] = useState<OperatingLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [showProposeModal, setShowProposeModal] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [statement, setStatement] = useState("");
  const [whyProposed, setWhyProposed] = useState("");
  const [domain, setDomain] = useState("operations");
  const [scope, setScope] = useState("business");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const loadLessons = () => {
    fetch("/api/learning/lessons")
      .then((res) => res.json())
      .then((data) => {
        setLessons(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load lessons", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadLessons();
  }, []);

  const handlePropose = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/learning/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          statement,
          why_proposed: whyProposed,
          domain,
          scope,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error || "Failed to propose lesson.");
      } else {
        setShowProposeModal(false);
        setTitle("");
        setStatement("");
        setWhyProposed("");
        loadLessons();
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = lessons.filter((l) => {
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="learning-container">
      <div className="learning-hero">
        <div className="learning-hero-header">
          <div>
            <h1 className="learning-title">Lesson Library</h1>
            <p className="learning-subtitle">
              Auditable repository of empirical lessons, counterexamples, and operational insights.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button onClick={() => setShowProposeModal(true)} className="learning-btn-primary">
              + Propose Lesson
            </button>
            <Link href="/learning" className="learning-btn-secondary">
              &larr; Command Center
            </Link>
          </div>
        </div>

        {/* Status Filter */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
          {["all", "proposed", "accepted", "needs_review", "superseded", "retired", "rejected"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`learning-nav-btn ${statusFilter === s ? "active" : ""}`}
            >
              {s.replace(/_/g, " ").toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Lesson List */}
      <section className="learning-section">
        {loading ? (
          <p style={{ color: "#94a3b8" }}>Loading lessons...</p>
        ) : filtered.length === 0 ? (
          <div className="learning-card" style={{ color: "#94a3b8" }}>
            No lessons match status filter &quot;{statusFilter}&quot;.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {filtered.map((l) => (
              <div key={l.id} className="learning-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.35rem" }}>
                      <span className={`learning-badge badge-${l.status === "accepted" ? "current" : l.status === "proposed" ? "review_soon" : "stale"}`}>
                        {l.status}
                      </span>
                      <span className={`learning-badge badge-${l.confidence_state}`}>
                        {l.confidence_state} confidence
                      </span>
                      <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#94a3b8" }}>
                        {l.domain}
                      </span>
                    </div>
                    <strong style={{ fontSize: "1rem" }}>{l.title}</strong>
                    <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.9rem", color: "#cbd5e1" }}>
                      {l.statement}
                    </p>
                    <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.8rem", color: "#94a3b8" }}>
                      <em>Why proposed:</em> {l.why_proposed}
                    </p>
                  </div>
                  <Link href={`/learning/lessons/${l.id}`} className="learning-btn-secondary" style={{ flexShrink: 0 }}>
                    Inspect
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Propose Modal */}
      {showProposeModal && (
        <div className="learning-modal-overlay">
          <div className="learning-modal-content">
            <h2 style={{ fontSize: "1.25rem", margin: 0 }}>Propose Operating Lesson</h2>
            <p style={{ fontSize: "0.85rem", color: "#94a3b8", margin: 0 }}>
              Operating lessons require human review before they are accepted into active institutional memory.
            </p>

            {errorMsg && (
              <div style={{ padding: "0.75rem", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "0.5rem", color: "#f87171", fontSize: "0.85rem" }}>
                {errorMsg}
              </div>
            )}

            <form onSubmit={handlePropose} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <div>
                <label style={{ fontSize: "0.8rem", color: "#94a3b8", display: "block", marginBottom: "0.25rem" }}>
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Client onboarding SLA buffer required"
                  style={{ width: "100%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "0.375rem", padding: "0.5rem", color: "#f8fafc" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", color: "#94a3b8", display: "block", marginBottom: "0.25rem" }}>
                  Statement (Operational Guidance)
                </label>
                <textarea
                  required
                  rows={3}
                  value={statement}
                  onChange={(e) => setStatement(e.target.value)}
                  placeholder="What operational behavior or guideline should be followed based on evidence?"
                  style={{ width: "100%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "0.375rem", padding: "0.5rem", color: "#f8fafc" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", color: "#94a3b8", display: "block", marginBottom: "0.25rem" }}>
                  Why Proposed (Empirical Evidence Basis)
                </label>
                <textarea
                  required
                  rows={2}
                  value={whyProposed}
                  onChange={(e) => setWhyProposed(e.target.value)}
                  placeholder="Observed across 4 customer deployments that 2 weeks buffer was needed."
                  style={{ width: "100%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "0.375rem", padding: "0.5rem", color: "#f8fafc" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.8rem", color: "#94a3b8", display: "block", marginBottom: "0.25rem" }}>
                    Domain
                  </label>
                  <select
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    style={{ width: "100%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "0.375rem", padding: "0.5rem", color: "#f8fafc" }}
                  >
                    <option value="operations">Operations</option>
                    <option value="team">Team</option>
                    <option value="success">Success</option>
                    <option value="commerce">Commerce</option>
                    <option value="finance">Finance</option>
                    <option value="growth">Growth</option>
                    <option value="executive">Executive</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", color: "#94a3b8", display: "block", marginBottom: "0.25rem" }}>
                    Scope
                  </label>
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                    style={{ width: "100%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "0.375rem", padding: "0.5rem", color: "#f8fafc" }}
                  >
                    <option value="business">Business</option>
                    <option value="personal">Personal</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setShowProposeModal(false)}
                  className="learning-btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="learning-btn-primary"
                  disabled={submitting}
                >
                  {submitting ? "Submitting..." : "Propose Lesson"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

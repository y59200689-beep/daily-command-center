"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import "./learning.css";

interface RetrospectiveSummary {
  id: string;
  status: string;
  retro_type: string;
  domain: string;
  title: string;
  period?: string;
  actual_summary?: string;
}

export function LearningRetrospectivesView() {
  const [retros, setRetros] = useState<RetrospectiveSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [retroType, setRetroType] = useState("project");
  const [domain, setDomain] = useState("operations");
  const [period, setPeriod] = useState("");
  const [expectedSummary, setExpectedSummary] = useState("");
  const [actualSummary, setActualSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadRetros = () => {
    fetch("/api/learning/retrospectives")
      .then((res) => res.json())
      .then((data) => {
        setRetros(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load retrospectives", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadRetros();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/learning/retrospectives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          retro_type: retroType,
          domain,
          period,
          expected_summary: expectedSummary,
          actual_summary: actualSummary,
        }),
      });
      if (res.ok) {
        setShowCreateModal(false);
        setTitle("");
        setExpectedSummary("");
        setActualSummary("");
        loadRetros();
      }
    } catch (err) {
      console.error("Failed to create retrospective", err);
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = retros.filter((r) => {
    if (typeFilter !== "all" && r.retro_type !== typeFilter) return false;
    return true;
  });

  return (
    <div className="learning-container">
      <div className="learning-hero">
        <div className="learning-hero-header">
          <div>
            <h1 className="learning-title">Retrospective Intelligence</h1>
            <p className="learning-subtitle">
              Structured post-mortems and milestone reviews across projects, client relationships, and incidents.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button onClick={() => setShowCreateModal(true)} className="learning-btn-primary">
              + New Retrospective
            </button>
            <Link href="/learning" className="learning-btn-secondary">
              &larr; Command Center
            </Link>
          </div>
        </div>

        {/* Type Filter */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
          {["all", "project", "client", "incident", "campaign", "decision", "quarter"].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`learning-nav-btn ${typeFilter === t ? "active" : ""}`}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <section className="learning-section">
        {loading ? (
          <p style={{ color: "#94a3b8" }}>Loading retrospectives...</p>
        ) : filtered.length === 0 ? (
          <div className="learning-card" style={{ color: "#94a3b8" }}>
            No retrospectives match filter &quot;{typeFilter}&quot;.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {filtered.map((r) => (
              <div key={r.id} className="learning-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.35rem" }}>
                      <span className={`learning-badge ${r.status === "completed" ? "badge-current" : "badge-review_soon"}`}>
                        {r.status}
                      </span>
                      <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#94a3b8" }}>
                        {r.retro_type} &bull; {r.domain}
                      </span>
                    </div>
                    <strong style={{ fontSize: "1rem" }}>{r.title}</strong>
                    {r.period && (
                      <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.8rem", color: "#94a3b8" }}>Period: {r.period}</p>
                    )}
                    {r.actual_summary && (
                      <p style={{ margin: "0.35rem 0 0 0", fontSize: "0.9rem", color: "#cbd5e1" }}>{r.actual_summary}</p>
                    )}
                  </div>
                  <Link href={`/learning/retrospectives/${r.id}`} className="learning-btn-secondary">
                    View Retro
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="learning-modal-overlay">
          <div className="learning-modal-content">
            <h2 style={{ fontSize: "1.25rem", margin: 0 }}>Start Structured Retrospective</h2>
            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div>
                <label style={{ fontSize: "0.8rem", color: "#94a3b8", display: "block", marginBottom: "0.25rem" }}>
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Q3 Project Titan Launch Retrospective"
                  style={{ width: "100%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "0.375rem", padding: "0.5rem", color: "#f8fafc" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.8rem", color: "#94a3b8", display: "block", marginBottom: "0.25rem" }}>
                    Type
                  </label>
                  <select
                    value={retroType}
                    onChange={(e) => setRetroType(e.target.value)}
                    style={{ width: "100%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "0.375rem", padding: "0.5rem", color: "#f8fafc" }}
                  >
                    <option value="project">Project</option>
                    <option value="client">Client</option>
                    <option value="incident">Incident</option>
                    <option value="campaign">Campaign</option>
                    <option value="decision">Decision</option>
                    <option value="quarter">Quarter</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
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
                    <option value="executive">Executive</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", color: "#94a3b8", display: "block", marginBottom: "0.25rem" }}>
                    Period
                  </label>
                  <input
                    type="text"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    placeholder="e.g. 2026-Q3"
                    style={{ width: "100%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "0.375rem", padding: "0.5rem", color: "#f8fafc" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", color: "#94a3b8", display: "block", marginBottom: "0.25rem" }}>
                  Expected Plan (What was supposed to happen)
                </label>
                <textarea
                  rows={2}
                  value={expectedSummary}
                  onChange={(e) => setExpectedSummary(e.target.value)}
                  placeholder="Summarize initial assumptions, deliverables, and targets."
                  style={{ width: "100%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "0.375rem", padding: "0.5rem", color: "#f8fafc" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", color: "#94a3b8", display: "block", marginBottom: "0.25rem" }}>
                  Observed Reality (What actually happened)
                </label>
                <textarea
                  rows={2}
                  value={actualSummary}
                  onChange={(e) => setActualSummary(e.target.value)}
                  placeholder="Summarize actual outcomes, delays, and discoveries."
                  style={{ width: "100%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "0.375rem", padding: "0.5rem", color: "#f8fafc" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
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
                  {submitting ? "Creating..." : "Create Retrospective"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

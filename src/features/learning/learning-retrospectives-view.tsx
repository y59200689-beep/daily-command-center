"use client";

import { Modal } from "@/components/ui/modal";
import { StyledSelect } from "@/components/ui/styled-select";

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
          <p style={{ color: "var(--muted)" }}>Loading retrospectives...</p>
        ) : filtered.length === 0 ? (
          <div className="learning-card" style={{ color: "var(--muted)" }}>
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
                      <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--muted)" }}>
                        {r.retro_type} &bull; {r.domain}
                      </span>
                    </div>
                    <strong style={{ fontSize: "1rem" }}>{r.title}</strong>
                    {r.period && (
                      <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.8rem", color: "var(--muted)" }}>Period: {r.period}</p>
                    )}
                    {r.actual_summary && (
                      <p style={{ margin: "0.35rem 0 0 0", fontSize: "0.9rem", color: "var(--ink)" }}>{r.actual_summary}</p>
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
      <Modal open={showCreateModal} onClose={() => { if (!submitting) setShowCreateModal(false); }} title="Start Structured Retrospective">
            <form className="learning-editor" noValidate onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div>
                <label htmlFor="learning-title" style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "0.25rem" }}>
                  Title
                </label>
                <input id="learning-title"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Q3 Project Titan Launch Retrospective"
                  style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: "0.375rem", padding: "0.5rem", color: "var(--ink)" }}
                />
              </div>

              <div className="learning-editor__grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "0.25rem" }}>
                    Type
                  </label>
                  <StyledSelect menuMinWidth={180} value={retroType} onChange={setRetroType} label="Retrospective type" options={[{ value: "project", label: "Project" }, { value: "client", label: "Client" }, { value: "incident", label: "Incident" }, { value: "campaign", label: "Campaign" }, { value: "decision", label: "Decision" }, { value: "quarter", label: "Quarter" }, { value: "custom", label: "Custom" }]} />
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "0.25rem" }}>
                    Domain
                  </label>
                  <StyledSelect menuMinWidth={180} value={domain} onChange={setDomain} label="Domain" options={[{ value: "operations", label: "Operations" }, { value: "team", label: "Team" }, { value: "success", label: "Success" }, { value: "commerce", label: "Commerce" }, { value: "finance", label: "Finance" }, { value: "executive", label: "Executive" }]} />
                </div>
                <div>
                  <label htmlFor="learning-period" style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "0.25rem" }}>
                    Period
                  </label>
                  <input id="learning-period"
                    type="text"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    placeholder="e.g. 2026-Q3"
                    style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: "0.375rem", padding: "0.5rem", color: "var(--ink)" }}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="learning-expected-plan-what-was-supposed-to-happen" style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "0.25rem" }}>
                  Expected Plan (What was supposed to happen)
                </label>
                <textarea id="learning-expected-plan-what-was-supposed-to-happen" className="resize-none"
                  rows={2}
                  value={expectedSummary}
                  onChange={(e) => setExpectedSummary(e.target.value)}
                  placeholder="Summarize initial assumptions, deliverables, and targets."
                  style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: "0.375rem", padding: "0.5rem", color: "var(--ink)" }}
                />
              </div>

              <div>
                <label htmlFor="learning-observed-reality-what-actually-happened" style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "0.25rem" }}>
                  Observed Reality (What actually happened)
                </label>
                <textarea id="learning-observed-reality-what-actually-happened" className="resize-none"
                  rows={2}
                  value={actualSummary}
                  onChange={(e) => setActualSummary(e.target.value)}
                  placeholder="Summarize actual outcomes, delays, and discoveries."
                  style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: "0.375rem", padding: "0.5rem", color: "var(--ink)" }}
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
      </Modal>
    </div>
  );
}

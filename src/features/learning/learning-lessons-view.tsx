"use client";

import { Modal } from "@/components/ui/modal";
import { StyledSelect } from "@/components/ui/styled-select";

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
          <p style={{ color: "var(--muted)" }}>Loading lessons...</p>
        ) : filtered.length === 0 ? (
          <div className="learning-card" style={{ color: "var(--muted)" }}>
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
                      <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--muted)" }}>
                        {l.domain}
                      </span>
                    </div>
                    <strong style={{ fontSize: "1rem" }}>{l.title}</strong>
                    <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.9rem", color: "var(--ink)" }}>
                      {l.statement}
                    </p>
                    <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.8rem", color: "var(--muted)" }}>
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
      <Modal open={showProposeModal} onClose={() => { if (!submitting) setShowProposeModal(false); }} title="Propose Operating Lesson" description="Operating lessons require human review before they are accepted into active institutional memory.">
            {errorMsg && (
              <div role="alert" style={{ padding: "0.75rem", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "0.5rem", color: "#f87171", fontSize: "0.85rem" }}>
                {errorMsg}
              </div>
            )}

            <form className="learning-editor" noValidate onSubmit={handlePropose} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <div>
                <label htmlFor="learning-title" style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "0.25rem" }}>
                  Title
                </label>
                <input id="learning-title"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Client onboarding SLA buffer required"
                  style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: "0.375rem", padding: "0.5rem", color: "var(--ink)" }}
                />
              </div>

              <div>
                <label htmlFor="learning-statement-operational-guidance" style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "0.25rem" }}>
                  Statement (Operational Guidance)
                </label>
                <textarea id="learning-statement-operational-guidance" className="resize-none"
                  required
                  rows={3}
                  value={statement}
                  onChange={(e) => setStatement(e.target.value)}
                  placeholder="What operational behavior or guideline should be followed based on evidence?"
                  style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: "0.375rem", padding: "0.5rem", color: "var(--ink)" }}
                />
              </div>

              <div>
                <label htmlFor="learning-why-proposed-empirical-evidence-basis" style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "0.25rem" }}>
                  Why Proposed (Empirical Evidence Basis)
                </label>
                <textarea id="learning-why-proposed-empirical-evidence-basis" className="resize-none"
                  required
                  rows={2}
                  value={whyProposed}
                  onChange={(e) => setWhyProposed(e.target.value)}
                  placeholder="Observed across 4 customer deployments that 2 weeks buffer was needed."
                  style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: "0.375rem", padding: "0.5rem", color: "var(--ink)" }}
                />
              </div>

              <div className="learning-editor__grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "0.25rem" }}>
                    Domain
                  </label>
                  <StyledSelect menuMinWidth={180} value={domain} onChange={setDomain} label="Domain" options={[{ value: "operations", label: "Operations" }, { value: "team", label: "Team" }, { value: "success", label: "Success" }, { value: "commerce", label: "Commerce" }, { value: "finance", label: "Finance" }, { value: "growth", label: "Growth" }, { value: "executive", label: "Executive" }]} />
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "0.25rem" }}>
                    Scope
                  </label>
                  <StyledSelect menuMinWidth={180} value={scope} onChange={setScope} label="Scope" options={[{ value: "business", label: "Business" }, { value: "personal", label: "Personal" }]} />
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
      </Modal>
    </div>
  );
}

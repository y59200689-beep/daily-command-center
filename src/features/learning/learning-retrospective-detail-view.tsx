"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import "./learning.css";

interface RetroDetailProps {
  id: string;
}

interface RetroItem {
  id: string;
  category: string;
  content: string;
}

interface RetroData {
  id: string;
  title: string;
  retro_type: string;
  domain: string;
  status: string;
  expected_summary?: string;
  actual_summary?: string;
}

interface RetroDetailData {
  retrospective: RetroData | null;
  items: RetroItem[];
}

export function LearningRetrospectiveDetailView({ id }: RetroDetailProps) {
  const [detail, setDetail] = useState<RetroDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("went_well");
  const [content, setContent] = useState("");
  const [addingItem, setAddingItem] = useState(false);

  const loadData = React.useCallback(() => {
    fetch(`/api/learning/retrospectives/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setDetail(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load retro detail", err);
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingItem(true);
    try {
      const res = await fetch(`/api/learning/retrospectives/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          new_item: {
            category,
            content,
          },
        }),
      });
      if (res.ok) {
        setContent("");
        loadData();
      }
    } catch (err) {
      console.error("Failed to add retro item", err);
    } finally {
      setAddingItem(false);
    }
  };

  const handleComplete = async () => {
    await fetch(`/api/learning/retrospectives/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    loadData();
  };

  if (loading) {
    return (
      <div className="learning-container">
        <p style={{ color: "#94a3b8" }}>Loading retrospective...</p>
      </div>
    );
  }

  if (!detail || !detail.retrospective) {
    return (
      <div className="learning-container">
        <div className="learning-card">
          <h2>Retrospective Not Found</h2>
          <Link href="/learning/retrospectives" className="learning-btn-secondary">
            &larr; Back to Retrospectives
          </Link>
        </div>
      </div>
    );
  }

  const { retrospective, items } = detail;
  const wentWell = items.filter(i => i.category === "went_well");
  const didntGoWell = items.filter(i => i.category === "didnt_go_well");
  const surprises = items.filter(i => i.category === "surprise");
  const actionItems = items.filter(i => i.category === "action_item");
  const lessonCandidates = items.filter(i => i.category === "lesson_candidate");

  return (
    <div className="learning-container">
      <div className="learning-hero">
        <div className="learning-hero-header">
          <div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem" }}>
              <span className={`learning-badge ${retrospective.status === "completed" ? "badge-current" : "badge-review_soon"}`}>
                {retrospective.status}
              </span>
              <span style={{ fontSize: "0.8rem", textTransform: "uppercase", color: "#94a3b8" }}>
                {retrospective.retro_type} &bull; {retrospective.domain}
              </span>
            </div>
            <h1 className="learning-title">{retrospective.title}</h1>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {retrospective.status !== "completed" && (
              <button onClick={handleComplete} className="learning-btn-primary">
                Complete Retro
              </button>
            )}
            <Link href="/learning/retrospectives" className="learning-btn-secondary">
              &larr; Retrospectives
            </Link>
          </div>
        </div>
      </div>

      {/* Plan vs Reality */}
      <section className="learning-section">
        <div className="learning-section-title">
          <span>Expected Plan vs Observed Reality</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div className="learning-card">
            <strong style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Expected Plan:</strong>
            <p style={{ margin: "0.35rem 0 0 0", fontSize: "0.95rem" }}>
              {retrospective.expected_summary || "No expected plan documented."}
            </p>
          </div>
          <div className="learning-card">
            <strong style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Observed Reality:</strong>
            <p style={{ margin: "0.35rem 0 0 0", fontSize: "0.95rem" }}>
              {retrospective.actual_summary || "No reality summary recorded."}
            </p>
          </div>
        </div>
      </section>

      {/* Categories Columns */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
        {/* Went Well */}
        <div className="learning-card">
          <strong style={{ fontSize: "0.9rem", color: "#34d399" }}>Went Well ({wentWell.length})</strong>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.5rem" }}>
            {wentWell.map((w) => (
              <div key={w.id} style={{ background: "rgba(16,185,129,0.08)", padding: "0.5rem", borderRadius: "0.375rem", fontSize: "0.85rem" }}>
                {w.content}
              </div>
            ))}
          </div>
        </div>

        {/* Didn't Go Well */}
        <div className="learning-card">
          <strong style={{ fontSize: "0.9rem", color: "#fb7185" }}>Didn&apos;t Go Well ({didntGoWell.length})</strong>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.5rem" }}>
            {didntGoWell.map((d) => (
              <div key={d.id} style={{ background: "rgba(244,63,94,0.08)", padding: "0.5rem", borderRadius: "0.375rem", fontSize: "0.85rem" }}>
                {d.content}
              </div>
            ))}
          </div>
        </div>

        {/* Surprises */}
        <div className="learning-card">
          <strong style={{ fontSize: "0.9rem", color: "#fbbf24" }}>Surprises &amp; Unknowns ({surprises.length})</strong>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.5rem" }}>
            {surprises.map((s) => (
              <div key={s.id} style={{ background: "rgba(245,158,11,0.08)", padding: "0.5rem", borderRadius: "0.375rem", fontSize: "0.85rem" }}>
                {s.content}
              </div>
            ))}
          </div>
        </div>

        {/* Action Items */}
        <div className="learning-card">
          <strong style={{ fontSize: "0.9rem", color: "#60a5fa" }}>Action Items &amp; Followups ({actionItems.length})</strong>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.5rem" }}>
            {actionItems.map((a) => (
              <div key={a.id} style={{ background: "rgba(59,130,246,0.08)", padding: "0.5rem", borderRadius: "0.375rem", fontSize: "0.85rem" }}>
                {a.content}
              </div>
            ))}
          </div>
        </div>

        {/* Lesson Candidates */}
        {lessonCandidates.length > 0 && (
          <div className="learning-card">
            <strong style={{ fontSize: "0.9rem", color: "#a78bfa" }}>Lesson Candidates ({lessonCandidates.length})</strong>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.5rem" }}>
              {lessonCandidates.map((c) => (
                <div key={c.id} style={{ background: "rgba(167,139,250,0.08)", padding: "0.5rem", borderRadius: "0.375rem", fontSize: "0.85rem" }}>
                  {c.content}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Item Form */}
      <section className="learning-section">
        <div className="learning-section-title">
          <span>Add Retrospective Observation</span>
        </div>
        <form onSubmit={handleAddItem} className="learning-card" style={{ flexDirection: "row", gap: "0.75rem", alignItems: "flex-end" }}>
          <div style={{ flex: "0 0 160px" }}>
            <label style={{ fontSize: "0.75rem", color: "#94a3b8", display: "block", marginBottom: "0.25rem" }}>
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{ width: "100%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "0.375rem", padding: "0.45rem", color: "#f8fafc", fontSize: "0.85rem" }}
            >
              <option value="went_well">Went Well</option>
              <option value="didnt_go_well">Didn&apos;t Go Well</option>
              <option value="surprise">Surprise</option>
              <option value="action_item">Action Item</option>
              <option value="lesson_candidate">Lesson Candidate</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: "0.75rem", color: "#94a3b8", display: "block", marginBottom: "0.25rem" }}>
              Observation or Insight
            </label>
            <input
              type="text"
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="e.g., Client communication was 3 days faster via dedicated Slack channel"
              style={{ width: "100%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "0.375rem", padding: "0.45rem", color: "#f8fafc", fontSize: "0.85rem" }}
            />
          </div>
          <button type="submit" className="learning-btn-primary" disabled={addingItem}>
            {addingItem ? "Adding..." : "Add Item"}
          </button>
        </form>
      </section>
    </div>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import "./learning.css";

interface PatternSummary {
  id: string;
  confidence: string;
  domain: string;
  title: string;
  description: string;
  observation_count: number;
  counterexample_count: number;
}

export function LearningPatternsView() {
  const [patterns, setPatterns] = useState<PatternSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [domainFilter, setDomainFilter] = useState("all");

  useEffect(() => {
    fetch("/api/learning/patterns")
      .then((res) => res.json())
      .then((data) => {
        setPatterns(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load patterns", err);
        setLoading(false);
      });
  }, []);

  const filtered = patterns.filter((p) => {
    if (domainFilter !== "all" && p.domain !== domainFilter) return false;
    return true;
  });

  return (
    <div className="learning-container">
      <div className="learning-hero">
        <div className="learning-hero-header">
          <div>
            <h1 className="learning-title">Operating Patterns</h1>
            <p className="learning-subtitle">
              Empirical recurring patterns detected across workflows, handoffs, and performance metrics.
            </p>
          </div>
          <Link href="/learning" className="learning-btn-secondary">
            &larr; Command Center
          </Link>
        </div>

        {/* Domain Filter */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
          {["all", "operations", "team", "success", "commerce", "finance", "executive"].map((d) => (
            <button
              key={d}
              onClick={() => setDomainFilter(d)}
              className={`learning-nav-btn ${domainFilter === d ? "active" : ""}`}
            >
              {d.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <section className="learning-section">
        {loading ? (
          <p style={{ color: "#94a3b8" }}>Loading patterns...</p>
        ) : filtered.length === 0 ? (
          <div className="learning-card" style={{ color: "#94a3b8" }}>
            No operating patterns recorded in this view.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "0.75rem" }}>
            {filtered.map((pat) => (
              <div key={pat.id} className="learning-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className={`learning-badge badge-${pat.confidence}`}>
                    {pat.confidence} confidence
                  </span>
                  <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#94a3b8" }}>
                    {pat.domain}
                  </span>
                </div>
                <strong style={{ fontSize: "1rem" }}>{pat.title}</strong>
                <p style={{ margin: 0, fontSize: "0.875rem", color: "#cbd5e1" }}>
                  {pat.description}
                </p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "0.5rem", marginTop: "0.25rem" }}>
                  <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                    {pat.observation_count} observations &bull; {pat.counterexample_count} counterexamples
                  </span>
                  <Link href={`/learning/patterns/${pat.id}`} style={{ fontSize: "0.85rem", color: "#f59e0b" }}>
                    Details &rarr;
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

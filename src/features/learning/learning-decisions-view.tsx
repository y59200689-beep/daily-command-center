"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import "./learning.css";

interface DecisionRecord {
  id: string;
  created_at: string;
  title: string;
  decision: string;
}

export function LearningDecisionsView() {
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/learning/decisions")
      .then((res) => res.json())
      .then((data) => {
        setDecisions(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load decision learning", err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="learning-container">
      <div className="learning-hero">
        <div className="learning-hero-header">
          <div>
            <h1 className="learning-title">Decision Learning</h1>
            <p className="learning-subtitle">
              Disentangling decision process quality from outcome luck. Comparing original assumptions with observed reality.
            </p>
          </div>
          <Link href="/learning" className="learning-btn-secondary">
            &larr; Command Center
          </Link>
        </div>
      </div>

      <section className="learning-section">
        <div className="learning-section-title">
          <span>Tracked Operating Decisions ({decisions.length})</span>
        </div>
        {loading ? (
          <p style={{ color: "#94a3b8" }}>Loading decisions...</p>
        ) : decisions.length === 0 ? (
          <div className="learning-card" style={{ color: "#94a3b8" }}>
            No evaluated decisions recorded yet. Decisions will populate as outcome review dates are reached.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {decisions.map((d) => (
              <div key={d.id} className="learning-card">
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="learning-badge badge-current">Decision</span>
                  <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                    {new Date(d.created_at).toLocaleDateString()}
                  </span>
                </div>
                <strong style={{ fontSize: "1rem" }}>{d.title}</strong>
                <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.875rem", color: "#cbd5e1" }}>
                  {d.decision}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import "./learning.css";

interface PatternDetailProps {
  id: string;
}

interface PatternData {
  id: string;
  domain: string;
  pattern_type: string;
  confidence: string;
  title: string;
  description: string;
  suggested_action?: string;
}

interface EvidenceItem {
  id: string;
  observation_text: string;
  observed_at: string;
}

interface CounterexampleItem {
  id: string;
  reason: string;
  observed_at: string;
}

interface PatternDetailData {
  pattern: PatternData | null;
  evidence: EvidenceItem[];
  counterexamples: CounterexampleItem[];
}

export function LearningPatternDetailView({ id }: PatternDetailProps) {
  const [detail, setDetail] = useState<PatternDetailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/learning/patterns/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setDetail(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load pattern detail", err);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="learning-container">
        <p style={{ color: "#94a3b8" }}>Loading pattern detail...</p>
      </div>
    );
  }

  if (!detail || !detail.pattern) {
    return (
      <div className="learning-container">
        <div className="learning-card">
          <h2>Pattern Not Found</h2>
          <Link href="/learning/patterns" className="learning-btn-secondary">
            &larr; Back to Patterns
          </Link>
        </div>
      </div>
    );
  }

  const { pattern, evidence, counterexamples } = detail;

  return (
    <div className="learning-container">
      <div className="learning-hero">
        <div className="learning-hero-header">
          <div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem" }}>
              <span className={`learning-badge badge-${pattern.confidence}`}>
                {pattern.confidence}
              </span>
              <span style={{ fontSize: "0.8rem", textTransform: "uppercase", color: "#94a3b8" }}>
                {pattern.domain} &bull; {pattern.pattern_type}
              </span>
            </div>
            <h1 className="learning-title">{pattern.title}</h1>
          </div>
          <Link href="/learning/patterns" className="learning-btn-secondary">
            &larr; Patterns
          </Link>
        </div>
      </div>

      <section className="learning-section">
        <div className="learning-section-title">
          <span>Pattern Description &amp; Suggested Action</span>
        </div>
        <div className="learning-card">
          <p style={{ fontSize: "1.05rem", lineHeight: 1.5, margin: 0 }}>
            {pattern.description}
          </p>
          {pattern.suggested_action && (
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "0.75rem", marginTop: "0.5rem" }}>
              <strong style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Suggested Operating Action:</strong>
              <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.9rem", color: "#cbd5e1" }}>
                {pattern.suggested_action}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Observations */}
      <section className="learning-section">
        <div className="learning-section-title">
          <span>Supporting Observations ({evidence.length})</span>
        </div>
        {evidence.length === 0 ? (
          <div className="learning-card" style={{ color: "#94a3b8" }}>
            No individual observation records logged yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {evidence.map(item => (
              <div key={item.id} className="learning-card" style={{ padding: "0.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.875rem" }}>{item.observation_text}</span>
                  <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                    {new Date(item.observed_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Counterexamples */}
      <section className="learning-section">
        <div className="learning-section-title">
          <span>Counterexamples &amp; Exceptions ({counterexamples.length})</span>
        </div>
        {counterexamples.length === 0 ? (
          <div className="learning-card" style={{ color: "#94a3b8" }}>
            No counterexamples observed for this pattern.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {counterexamples.map(cnt => (
              <div key={cnt.id} className="learning-card" style={{ padding: "0.75rem", borderColor: "rgba(244,63,94,0.3)" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.875rem", color: "#fb7185" }}>{cnt.reason}</span>
                  <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                    {new Date(cnt.observed_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

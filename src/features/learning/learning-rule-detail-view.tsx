"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import "./learning.css";

interface RuleDetailProps {
  id: string;
}

interface RuleDetailData {
  id: string;
  title: string;
  rule_type: string;
  domain: string;
  status: string;
  current_value: unknown;
  proposed_value: unknown;
  expected_effect: string;
  rollback_path: string;
}

export function LearningRuleDetailView({ id }: RuleDetailProps) {
  const [rule, setRule] = useState<RuleDetailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/learning/rules/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setRule(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load rule detail", err);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="learning-container">
        <p style={{ color: "#94a3b8" }}>Loading rule detail...</p>
      </div>
    );
  }

  if (!rule) {
    return (
      <div className="learning-container">
        <div className="learning-card">
          <h2>Rule Not Found</h2>
          <Link href="/learning/rules" className="learning-btn-secondary">
            &larr; Back to Rules
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="learning-container">
      <div className="learning-hero">
        <div className="learning-hero-header">
          <div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem" }}>
              <span className={`learning-badge ${rule.status === "accepted" ? "badge-current" : "badge-review_soon"}`}>
                {rule.status}
              </span>
              <span style={{ fontSize: "0.8rem", textTransform: "uppercase", color: "#94a3b8" }}>
                {rule.domain} &bull; {rule.rule_type}
              </span>
            </div>
            <h1 className="learning-title">{rule.title}</h1>
          </div>
          <Link href="/learning/rules" className="learning-btn-secondary">
            &larr; Rules
          </Link>
        </div>
      </div>

      <section className="learning-section">
        <div className="learning-section-title">
          <span>Impact Preview &amp; Operating Parameters</span>
        </div>
        <div className="learning-card">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div style={{ background: "#1e293b", padding: "1rem", borderRadius: "0.5rem" }}>
              <strong style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Current Value:</strong>
              <pre style={{ margin: "0.5rem 0 0 0", color: "#cbd5e1" }}>
                {JSON.stringify(rule.current_value, null, 2)}
              </pre>
            </div>
            <div style={{ background: "#1e293b", padding: "1rem", borderRadius: "0.5rem", border: "1px solid rgba(245,158,11,0.3)" }}>
              <strong style={{ fontSize: "0.85rem", color: "#fbbf24" }}>Proposed Value:</strong>
              <pre style={{ margin: "0.5rem 0 0 0", color: "#f8fafc" }}>
                {JSON.stringify(rule.proposed_value, null, 2)}
              </pre>
            </div>
          </div>

          <div style={{ marginTop: "1rem" }}>
            <strong style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Expected Operational Effect:</strong>
            <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.95rem" }}>{rule.expected_effect}</p>
          </div>

          <div style={{ marginTop: "1rem" }}>
            <strong style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Rollback Procedure:</strong>
            <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.9rem", color: "#cbd5e1" }}>{rule.rollback_path}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

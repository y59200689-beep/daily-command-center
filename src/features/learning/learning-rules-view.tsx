"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import "./learning.css";

interface RuleProposalItem {
  id: string;
  domain: string;
  rule_type: string;
  title: string;
  status: string;
  expected_effect: string;
  current_value: unknown;
  proposed_value: unknown;
}

export function LearningRulesView() {
  const [rules, setRules] = useState<RuleProposalItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRules = () => {
    fetch("/api/learning/rules")
      .then((res) => res.json())
      .then((data) => {
        setRules(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load rules", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handleAction = async (id: string, action: string) => {
    try {
      const res = await fetch(`/api/learning/rules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        loadRules();
      }
    } catch (err) {
      console.error("Failed to update rule", err);
    }
  };

  const proposed = rules.filter((r) => r.status === "proposed");
  const accepted = rules.filter((r) => r.status === "accepted");

  return (
    <div className="learning-container">
      <div className="learning-hero">
        <div className="learning-hero-header">
          <div>
            <h1 className="learning-title">Operating Rules &amp; Proposals</h1>
            <p className="learning-subtitle">
              Configurable operating parameters, safety thresholds, and planning buffers. Explicit acceptance required.
            </p>
          </div>
          <Link href="/learning" className="learning-btn-secondary">
            &larr; Command Center
          </Link>
        </div>
      </div>

      {/* Proposed Rules */}
      <section className="learning-section">
        <div className="learning-section-title">
          <span>Proposed Rule Modifications ({proposed.length})</span>
        </div>
        {loading ? (
          <p style={{ color: "#94a3b8" }}>Loading rules...</p>
        ) : proposed.length === 0 ? (
          <div className="learning-card" style={{ color: "#94a3b8" }}>
            No pending rule proposals awaiting acceptance.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {proposed.map((r) => (
              <div key={r.id} className="learning-card" style={{ borderColor: "rgba(245, 158, 11, 0.3)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.35rem" }}>
                      <span className="learning-badge badge-review_soon">Proposed</span>
                      <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#94a3b8" }}>
                        {r.domain} &bull; {r.rule_type}
                      </span>
                    </div>
                    <strong style={{ fontSize: "1rem" }}>{r.title}</strong>
                    <p style={{ margin: "0.35rem 0 0 0", fontSize: "0.9rem", color: "#cbd5e1" }}>
                      {r.expected_effect}
                    </p>
                    <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem", fontSize: "0.85rem" }}>
                      <span><strong>Current:</strong> {JSON.stringify(r.current_value)}</span>
                      <span><strong>Proposed:</strong> {JSON.stringify(r.proposed_value)}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      onClick={() => handleAction(r.id, "accept")}
                      className="learning-btn-primary"
                    >
                      Accept Rule
                    </button>
                    <button
                      onClick={() => handleAction(r.id, "reject")}
                      className="learning-btn-danger"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Active Rules */}
      <section className="learning-section">
        <div className="learning-section-title">
          <span>Active Operating Rules ({accepted.length})</span>
        </div>
        {accepted.length === 0 ? (
          <div className="learning-card" style={{ color: "#94a3b8" }}>
            No active operating rules.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "0.75rem" }}>
            {accepted.map((r) => (
              <div key={r.id} className="learning-card">
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="learning-badge badge-current">Active</span>
                  <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#94a3b8" }}>{r.domain}</span>
                </div>
                <strong style={{ fontSize: "0.95rem" }}>{r.title}</strong>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#94a3b8" }}>{r.expected_effect}</p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem" }}>
                  <span style={{ fontSize: "0.8rem", color: "#cbd5e1" }}>Value: {JSON.stringify(r.proposed_value)}</span>
                  <button
                    onClick={() => handleAction(r.id, "retire")}
                    className="learning-btn-secondary"
                    style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                  >
                    Retire
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

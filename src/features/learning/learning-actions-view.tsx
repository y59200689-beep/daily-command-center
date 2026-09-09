"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import "./learning.css";

interface ActionOutcomeItem {
  id: string;
  achieved?: boolean;
  outcome_state: string;
  action_id?: string;
  recommendation_id?: string;
  notes?: string;
}

export function LearningActionsView() {
  const [data, setData] = useState<{ outcomes: ActionOutcomeItem[]; executions: Record<string, unknown>[] }>({ outcomes: [], executions: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/learning/actions")
      .then((res) => res.json())
      .then((res) => {
        setData({
          outcomes: res.outcomes || [],
          executions: res.executions || [],
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load action learning", err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="learning-container">
      <div className="learning-hero">
        <div className="learning-hero-header">
          <div>
            <h1 className="learning-title">Action Learning &amp; Receipts</h1>
            <p className="learning-subtitle">
              Strictly separating technical execution success from realized business outcome success.
            </p>
          </div>
          <Link href="/learning" className="learning-btn-secondary">
            &larr; Command Center
          </Link>
        </div>
      </div>

      <section className="learning-section">
        <div className="learning-section-title">
          <span>Action Outcome Verifications ({data.outcomes.length})</span>
        </div>
        {loading ? (
          <p style={{ color: "#94a3b8" }}>Loading action outcomes...</p>
        ) : data.outcomes.length === 0 ? (
          <div className="learning-card" style={{ color: "#94a3b8" }}>
            No verified action outcomes recorded yet. Executed V17 actions track business impact following their observational windows.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {data.outcomes.map((item) => (
              <div key={item.id} className="learning-card">
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className={`learning-badge ${item.achieved ? "badge-current" : "badge-conflicting"}`}>
                    Outcome: {item.outcome_state}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                    Action Ref: {item.action_id || item.recommendation_id}
                  </span>
                </div>
                <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.9rem", color: "#cbd5e1" }}>
                  {item.notes || "Action executed mechanically. Evaluating downstream impact."}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

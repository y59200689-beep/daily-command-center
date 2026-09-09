"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import "./learning.css";

interface ForecastItem {
  id: string;
  direction: string;
  variance_percentage: number;
  domain: string;
  metric: string;
  expected_value: number;
  actual_value: number;
  variance: number;
  calibration_proposal?: string;
}

export function LearningForecastView() {
  const [forecasts, setForecasts] = useState<ForecastItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/learning/forecasts")
      .then((res) => res.json())
      .then((data) => {
        setForecasts(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load forecast evaluations", err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="learning-container">
      <div className="learning-hero">
        <div className="learning-hero-header">
          <div>
            <h1 className="learning-title">Forecast Learning &amp; Calibration</h1>
            <p className="learning-subtitle">
              Evaluating historical predictions against observed outcomes to dampen systemic planning bias.
            </p>
          </div>
          <Link href="/learning" className="learning-btn-secondary">
            &larr; Command Center
          </Link>
        </div>
      </div>

      <section className="learning-section">
        <div className="learning-section-title">
          <span>Evaluated Forecast Snapshots ({forecasts.length})</span>
        </div>
        {loading ? (
          <p style={{ color: "#94a3b8" }}>Loading forecast evaluations...</p>
        ) : forecasts.length === 0 ? (
          <div className="learning-card" style={{ color: "#94a3b8" }}>
            No forecast evaluation records recorded yet. Forecast learning requires historical snapshots prior to actual observations.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {forecasts.map((f) => (
              <div key={f.id} className="learning-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.25rem" }}>
                      <span className={`learning-badge ${f.direction === "accurate" ? "badge-current" : f.direction === "over" ? "badge-review_soon" : "badge-conflicting"}`}>
                        {f.direction.toUpperCase()} ({f.variance_percentage > 0 ? `+${f.variance_percentage}%` : `${f.variance_percentage}%`})
                      </span>
                      <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#94a3b8" }}>{f.domain}</span>
                    </div>
                    <strong style={{ fontSize: "1rem" }}>{f.metric}</strong>
                    <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.5rem", fontSize: "0.85rem", color: "#cbd5e1" }}>
                      <span><strong>Expected:</strong> {f.expected_value}</span>
                      <span><strong>Observed Actual:</strong> {f.actual_value}</span>
                      <span><strong>Variance:</strong> {f.variance > 0 ? `+${f.variance}` : f.variance}</span>
                    </div>
                    {f.calibration_proposal && (
                      <div style={{ marginTop: "0.75rem", padding: "0.65rem", background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: "0.5rem" }}>
                        <strong style={{ fontSize: "0.8rem", color: "#fbbf24" }}>Calibration Proposal:</strong>
                        <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.85rem", color: "#f8fafc" }}>
                          {f.calibration_proposal}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

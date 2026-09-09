"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import "./learning.css";

interface LearningOverview {
  acceptedLessonsCount: number;
  proposedLessonsCount: number;
  activePatternsCount: number;
  activeRulesCount: number;
  staleMemoriesCount: number;
  conflictsCount: number;
  reviewQueue: Array<{
    id: string;
    itemType: string;
    priority: number;
    title: string;
    domain: string;
    urgency: string;
    reason: string;
    targetPath: string;
  }>;
  topSignal?: {
    type: string;
    title: string;
    description: string;
    path: string;
  };
  recentLessons: Array<{
    id: string;
    title: string;
    domain: string;
    status: string;
    confidence_state: string;
  }>;
  recentPatterns: Array<{
    patternKey: string;
    title: string;
    domain: string;
    confidence: string;
    observationCount: number;
  }>;
}

export function LearningHome() {
  const [data, setData] = useState<LearningOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/learning/overview")
      .then((res) => res.json())
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load learning overview", err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="learning-container">
      {/* Hero Block */}
      <div className="learning-hero">
        <div className="learning-hero-header">
          <div>
            <h1 className="learning-title">Operating Memory &amp; Learning System</h1>
            <p className="learning-subtitle">
              Human-auditable institutional memory, pattern detection, and retrospective intelligence.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Link href="/learning/lessons" className="learning-btn-primary">
              Propose Lesson
            </Link>
            <Link href="/learning/retrospectives" className="learning-btn-secondary">
              New Retrospective
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="learning-stats-grid">
          <div className="learning-stat-card">
            <span className="learning-stat-value">{data?.acceptedLessonsCount ?? 0}</span>
            <span className="learning-stat-label">Accepted Lessons</span>
          </div>
          <div className="learning-stat-card">
            <span className="learning-stat-value">{data?.activePatternsCount ?? 0}</span>
            <span className="learning-stat-label">Active Patterns</span>
          </div>
          <div className="learning-stat-card">
            <span className="learning-stat-value">{data?.activeRulesCount ?? 0}</span>
            <span className="learning-stat-label">Operating Rules</span>
          </div>
          <div className="learning-stat-card">
            <span className="learning-stat-value">{data?.reviewQueue.length ?? 0}</span>
            <span className="learning-stat-label">Needs Review</span>
          </div>
          <div className="learning-stat-card">
            <span className="learning-stat-value">{data?.staleMemoriesCount ?? 0}</span>
            <span className="learning-stat-label">Stale Lessons</span>
          </div>
        </div>
      </div>

      {/* Nav Sub-Bar */}
      <div className="learning-nav-bar">
        <Link href="/learning" className="learning-nav-btn active">Command Center</Link>
        <Link href="/learning/memory" className="learning-nav-btn">Operating Memory</Link>
        <Link href="/learning/lessons" className="learning-nav-btn">Lessons</Link>
        <Link href="/learning/patterns" className="learning-nav-btn">Patterns</Link>
        <Link href="/learning/forecasts" className="learning-nav-btn">Forecasts</Link>
        <Link href="/learning/decisions" className="learning-nav-btn">Decisions</Link>
        <Link href="/learning/actions" className="learning-nav-btn">Actions</Link>
        <Link href="/learning/rules" className="learning-nav-btn">Rules</Link>
        <Link href="/learning/retrospectives" className="learning-nav-btn">Retrospectives</Link>
        <Link href="/learning/review" className="learning-nav-btn">Review Queue</Link>
        <Link href="/learning/review/monthly" className="learning-nav-btn">Monthly</Link>
        <Link href="/learning/review/quarterly" className="learning-nav-btn">Quarterly</Link>
      </div>

      {/* Top Signal Banner */}
      {data?.topSignal && (
        <div className="learning-signal-banner">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
              <span className="learning-badge badge-conflicting">Urgent Signal</span>
              <strong style={{ fontSize: "0.95rem" }}>{data.topSignal.title}</strong>
            </div>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#cbd5e1" }}>
              {data.topSignal.description}
            </p>
          </div>
          <Link href={data.topSignal.path} className="learning-btn-secondary" style={{ flexShrink: 0 }}>
            Resolve Now
          </Link>
        </div>
      )}

      {/* Review Queue (Needs Review) */}
      <section className="learning-section">
        <div className="learning-section-title">
          <span>Needs Review ({data?.reviewQueue.length ?? 0})</span>
        </div>
        {loading ? (
          <p style={{ color: "#94a3b8", fontSize: "0.9rem" }}>Loading learning context...</p>
        ) : data?.reviewQueue.length === 0 ? (
          <div className="learning-card" style={{ color: "#94a3b8", fontSize: "0.875rem" }}>
            Operating memory is currently fresh. No pending conflicts or unreviewed proposals.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {data?.reviewQueue.map((item) => (
              <div key={item.id} className="learning-card" style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.25rem" }}>
                    <span className={`learning-badge ${item.urgency === "critical" ? "badge-conflicting" : "badge-review_soon"}`}>
                      {item.urgency}
                    </span>
                    <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#94a3b8" }}>
                      {item.domain}
                    </span>
                    <strong style={{ fontSize: "0.9rem" }}>{item.title}</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "#94a3b8" }}>{item.reason}</p>
                </div>
                <Link href={item.targetPath} className="learning-btn-secondary">
                  Review
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recurring Patterns */}
      <section className="learning-section">
        <div className="learning-section-title">
          <span>Recurring Operating Patterns</span>
        </div>
        {data?.recentPatterns.length === 0 ? (
          <div className="learning-card" style={{ color: "#94a3b8", fontSize: "0.875rem" }}>
            No recurrent cross-domain patterns detected yet.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.75rem" }}>
            {data?.recentPatterns.map((pat) => (
              <div key={pat.patternKey} className="learning-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className={`learning-badge badge-${pat.confidence}`}>{pat.confidence}</span>
                  <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{pat.observationCount} observations</span>
                </div>
                <strong style={{ fontSize: "0.95rem" }}>{pat.title}</strong>
                <Link href="/learning/patterns" style={{ fontSize: "0.8rem", color: "#f59e0b" }}>
                  View observations &rarr;
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

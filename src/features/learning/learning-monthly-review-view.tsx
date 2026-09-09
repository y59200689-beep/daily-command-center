"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { MonthlyReview } from "@/lib/learning";
import "./learning.css";

export function LearningMonthlyReviewView() {
  const [review, setReview] = useState<MonthlyReview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/learning/review/monthly")
      .then((res) => res.json())
      .then((data) => {
        setReview(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load monthly review", err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="learning-container">
      <div className="learning-hero">
        <div className="learning-hero-header">
          <div>
            <h1 className="learning-title">Monthly Operating Learning Review</h1>
            <p className="learning-subtitle">
              Monthly synthesis of accepted institutional memory, recurring pattern trends, and operational rule proposals.
            </p>
          </div>
          <Link href="/learning" className="learning-btn-secondary">
            &larr; Command Center
          </Link>
        </div>

        {/* Month Summary Stats */}
        {review && (
          <div className="learning-stats-grid">
            <div className="learning-stat-card">
              <span className="learning-stat-value">{review.totalNewLessons}</span>
              <span className="learning-stat-label">Total Lessons</span>
            </div>
            <div className="learning-stat-card">
              <span className="learning-stat-value">{review.acceptedLessons}</span>
              <span className="learning-stat-label">Accepted</span>
            </div>
            <div className="learning-stat-card">
              <span className="learning-stat-value">{review.recurringPatterns?.length || 0}</span>
              <span className="learning-stat-label">Active Patterns</span>
            </div>
            <div className="learning-stat-card">
              <span className="learning-stat-value">{review.ruleProposals?.length || 0}</span>
              <span className="learning-stat-label">Rule Proposals</span>
            </div>
            <div className="learning-stat-card">
              <span className="learning-stat-value">{review.staleMemoriesCount}</span>
              <span className="learning-stat-label">Stale Lessons</span>
            </div>
          </div>
        )}
      </div>

      <section className="learning-section">
        <div className="learning-section-title">
          <span>Monthly Highlights &amp; Insights</span>
        </div>
        {loading ? (
          <p style={{ color: "#94a3b8" }}>Loading monthly review...</p>
        ) : (
          <div className="learning-card">
            <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "#cbd5e1", lineHeight: 1.6 }}>
              {review?.highlights?.map((h: string, idx: number) => (
                <li key={idx}>{h}</li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

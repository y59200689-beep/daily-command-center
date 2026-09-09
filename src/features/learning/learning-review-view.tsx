"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { ReviewQueueItem } from "@/lib/learning";
import "./learning.css";

export function LearningReviewView() {
  const [queue, setQueue] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/learning/overview")
      .then((res) => res.json())
      .then((data) => {
        setQueue(data.reviewQueue || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load review queue", err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="learning-container">
      <div className="learning-hero">
        <div className="learning-hero-header">
          <div>
            <h1 className="learning-title">Learning Review Queue</h1>
            <p className="learning-subtitle">
              Prioritized institutional governance queue: resolving guidance conflicts, reviewing rule proposals, and refreshing stale lessons.
            </p>
          </div>
          <Link href="/learning" className="learning-btn-secondary">
            &larr; Command Center
          </Link>
        </div>
      </div>

      <section className="learning-section">
        <div className="learning-section-title">
          <span>Actionable Review Items ({queue.length})</span>
        </div>
        {loading ? (
          <p style={{ color: "#94a3b8" }}>Loading queue...</p>
        ) : queue.length === 0 ? (
          <div className="learning-card" style={{ color: "#94a3b8" }}>
            Review queue is clear. No conflicting memories or overdue reviews.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {queue.map((item) => (
              <div key={item.id} className="learning-card" style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.25rem" }}>
                    <span className={`learning-badge ${item.urgency === "critical" ? "badge-conflicting" : "badge-review_soon"}`}>
                      {item.urgency}
                    </span>
                    <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#94a3b8" }}>
                      {item.domain}
                    </span>
                    <strong style={{ fontSize: "0.95rem" }}>{item.title}</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "#cbd5e1" }}>{item.reason}</p>
                </div>
                <Link href={item.targetPath} className="learning-btn-secondary" style={{ flexShrink: 0 }}>
                  Take Action &rarr;
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

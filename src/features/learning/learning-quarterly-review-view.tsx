"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { QuarterlyReview } from "@/lib/learning";
import "./learning.css";

export function LearningQuarterlyReviewView() {
  const [review, setReview] = useState<QuarterlyReview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/learning/review/quarterly")
      .then((res) => res.json())
      .then((data) => {
        setReview(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load quarterly review", err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="learning-container">
      <div className="learning-hero">
        <div className="learning-hero-header">
          <div>
            <h1 className="learning-title">Quarterly Institutional Memory Review</h1>
            <p className="learning-subtitle">
              Strategic retrospective: assessing what has become predictable vs unpredictable, calibrating core assumptions, and retiring obsolete knowledge.
            </p>
          </div>
          <Link href="/learning" className="learning-btn-secondary">
            &larr; Command Center
          </Link>
        </div>
      </div>

      {loading ? (
        <p style={{ color: "#94a3b8" }}>Loading quarterly review...</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1rem" }}>
          {/* Predictable vs Unpredictable */}
          <div className="learning-card">
            <strong style={{ fontSize: "0.95rem", color: "#34d399" }}>What Became Predictable</strong>
            <ul style={{ margin: "0.5rem 0 0 0", paddingLeft: "1.2rem", fontSize: "0.85rem", color: "#cbd5e1" }}>
              {review?.whatBecamePredictable?.length === 0 ? (
                <li>No strong predictability trends stabilized this quarter.</li>
              ) : (
                review?.whatBecamePredictable?.map((p: string, idx: number) => <li key={idx}>{p}</li>)
              )}
            </ul>
          </div>

          <div className="learning-card">
            <strong style={{ fontSize: "0.95rem", color: "#fb7185" }}>What Stayed Unpredictable</strong>
            <ul style={{ margin: "0.5rem 0 0 0", paddingLeft: "1.2rem", fontSize: "0.85rem", color: "#cbd5e1" }}>
              {review?.whatStayedUnpredictable?.length === 0 ? (
                <li>Variance contained across primary domains.</li>
              ) : (
                review?.whatStayedUnpredictable?.map((u: string, idx: number) => <li key={idx}>{u}</li>)
              )}
            </ul>
          </div>

          {/* Repeated Mistakes vs Successes */}
          <div className="learning-card">
            <strong style={{ fontSize: "0.95rem", color: "#fbbf24" }}>Repeated Operating Mistakes</strong>
            <ul style={{ margin: "0.5rem 0 0 0", paddingLeft: "1.2rem", fontSize: "0.85rem", color: "#cbd5e1" }}>
              {review?.repeatedMistakes?.length === 0 ? (
                <li>No repeating failure patterns detected.</li>
              ) : (
                review?.repeatedMistakes?.map((m: string, idx: number) => <li key={idx}>{m}</li>)
              )}
            </ul>
          </div>

          <div className="learning-card">
            <strong style={{ fontSize: "0.95rem", color: "#60a5fa" }}>Repeated Successes</strong>
            <ul style={{ margin: "0.5rem 0 0 0", paddingLeft: "1.2rem", fontSize: "0.85rem", color: "#cbd5e1" }}>
              {review?.repeatedSuccesses?.length === 0 ? (
                <li>Documented baseline executions.</li>
              ) : (
                review?.repeatedSuccesses?.map((s: string, idx: number) => <li key={idx}>{s}</li>)
              )}
            </ul>
          </div>

          {/* Rules & Knowledge to Retire */}
          <div className="learning-card">
            <strong style={{ fontSize: "0.95rem", color: "#a78bfa" }}>Rules to Review</strong>
            <ul style={{ margin: "0.5rem 0 0 0", paddingLeft: "1.2rem", fontSize: "0.85rem", color: "#cbd5e1" }}>
              {review?.rulesToReview?.length === 0 ? (
                <li>Current operating rules remain aligned.</li>
              ) : (
                review?.rulesToReview?.map((r: string, idx: number) => <li key={idx}>{r}</li>)
              )}
            </ul>
          </div>

          <div className="learning-card">
            <strong style={{ fontSize: "0.95rem", color: "#94a3b8" }}>Knowledge to Retire</strong>
            <ul style={{ margin: "0.5rem 0 0 0", paddingLeft: "1.2rem", fontSize: "0.85rem", color: "#cbd5e1" }}>
              {review?.knowledgeToRetire?.length === 0 ? (
                <li>No stale lessons identified for retirement.</li>
              ) : (
                review?.knowledgeToRetire?.map((k: string, idx: number) => <li key={idx}>{k}</li>)
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { StyledSelect } from "@/components/ui/styled-select";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import "./learning.css";

interface MemoryItem {
  id: string;
  title: string;
  statement: string;
  domain: string;
  confidence_state: string;
  freshness: "current" | "review_soon" | "review_due" | "stale" | "superseded" | "retired";
  last_reviewed_at?: string;
  review_at?: string;
}

interface OperatingRuleSummary {
  id: string;
  title: string;
  domain: string;
  expected_effect?: string;
}

export function LearningMemoryView() {
  const [lessons, setLessons] = useState<MemoryItem[]>([]);
  const [rules, setRules] = useState<OperatingRuleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [domainFilter, setDomainFilter] = useState("all");
  const [freshnessFilter, setFreshnessFilter] = useState("all");

  useEffect(() => {
    fetch("/api/learning/memory")
      .then((res) => res.json())
      .then((data) => {
        setLessons(data.lessons || []);
        setRules(data.rules || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load operating memory", err);
        setLoading(false);
      });
  }, []);

  const filteredLessons = lessons.filter((l) => {
    if (domainFilter !== "all" && l.domain !== domainFilter) return false;
    if (freshnessFilter !== "all" && l.freshness !== freshnessFilter) return false;
    return true;
  });

  return (
    <div className="learning-container">
      <div className="learning-hero">
        <div className="learning-hero-header">
          <div>
            <h1 className="learning-title">Operating Memory</h1>
            <p className="learning-subtitle">
              Institutional knowledge repository: active lessons, verified operating rules, and confirmed patterns.
            </p>
          </div>
          <Link href="/learning" className="learning-btn-secondary">
            &larr; Command Center
          </Link>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
          <div>
            <label style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block", marginBottom: "0.25rem" }}>
              Filter Domain
            </label>
            <StyledSelect menuMinWidth={180} value={domainFilter} onChange={setDomainFilter} label="Filter domain" options={[{ value: "all", label: "All Domains" }, { value: "operations", label: "Operations" }, { value: "team", label: "Team" }, { value: "success", label: "Success" }, { value: "commerce", label: "Commerce" }, { value: "finance", label: "Finance" }, { value: "executive", label: "Executive" }]} />
          </div>
          <div>
            <label style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block", marginBottom: "0.25rem" }}>
              Filter Freshness
            </label>
            <StyledSelect menuMinWidth={180} value={freshnessFilter} onChange={setFreshnessFilter} label="Filter freshness" options={[{ value: "all", label: "All States" }, { value: "current", label: "Current" }, { value: "review_soon", label: "Review Soon" }, { value: "review_due", label: "Review Due" }, { value: "stale", label: "Stale (>180d)" }, { value: "superseded", label: "Superseded" }, { value: "retired", label: "Retired" }]} />
          </div>
        </div>
      </div>

      {/* Accepted Lessons */}
      <section className="learning-section">
        <div className="learning-section-title">
          <span>Active Institutional Lessons ({filteredLessons.length})</span>
        </div>
        {loading ? (
          <p style={{ color: "var(--muted)" }}>Loading operating memory...</p>
        ) : filteredLessons.length === 0 ? (
          <div className="learning-card" style={{ color: "var(--muted)" }}>
            No operating lessons match selected filters.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {filteredLessons.map((lesson) => (
              <div key={lesson.id} className="learning-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.35rem" }}>
                      <span className={`learning-badge badge-${lesson.freshness}`}>
                        {lesson.freshness.replace(/_/g, " ")}
                      </span>
                      <span className={`learning-badge badge-${lesson.confidence_state}`}>
                        {lesson.confidence_state}
                      </span>
                      <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--muted)" }}>
                        {lesson.domain}
                      </span>
                    </div>
                    <strong style={{ fontSize: "1rem" }}>{lesson.title}</strong>
                    <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.9rem", color: "var(--ink)" }}>
                      {lesson.statement}
                    </p>
                  </div>
                  <Link href={`/learning/lessons/${lesson.id}`} className="learning-btn-secondary" style={{ flexShrink: 0 }}>
                    Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Active Rules */}
      <section className="learning-section">
        <div className="learning-section-title">
          <span>Codified Operating Rules ({rules.length})</span>
        </div>
        {rules.length === 0 ? (
          <div className="learning-card" style={{ color: "var(--muted)" }}>
            No operating rules activated yet.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "0.75rem" }}>
            {rules.map((rule) => (
              <div key={rule.id} className="learning-card">
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="learning-badge badge-current">Active Rule</span>
                  <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--muted)" }}>{rule.domain}</span>
                </div>
                <strong style={{ fontSize: "0.95rem" }}>{rule.title}</strong>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>{rule.expected_effect}</p>
                <Link href={`/learning/rules/${rule.id}`} style={{ fontSize: "0.8rem", color: "#f59e0b" }}>
                  View Rule &rarr;
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

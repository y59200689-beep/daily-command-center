"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import "./executive.css";
import type { DecisionBrief } from "@/lib/executive";

export function ExecutiveDecisionsView() {
  const [decisions, setDecisions] = useState<DecisionBrief[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/executive/decisions");
        if (!res.ok) throw new Error("Failed to load decisions.");
        const json = await res.json();
        if (active) setDecisions(json.decisions ?? []);
      } catch {
        if (active) setDecisions([]);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="executive-surface">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Executive Decision Queue</h1>
          <p className="text-sm text-slate-400">Decisions awaiting executive alignment, tradeoff analysis, and action</p>
        </div>
        <Link href="/executive" className="text-sm text-blue-400 hover:underline">
          ← Back to Executive Command Center
        </Link>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-400">Loading decision queue...</div>
      ) : decisions.length === 0 ? (
        <div className="p-8 text-center text-slate-400 bg-slate-900/40 border border-slate-800 rounded-lg">
          No active decisions in queue.
        </div>
      ) : (
        <div className="space-y-4">
          {decisions.map((d) => (
            <div key={d.decisionId} className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="executive-badge executive-badge-ready">{d.readiness}</span>
                  <span className="text-xs font-semibold text-slate-400">Impact: {d.impact}</span>
                  <span className="text-xs text-amber-400">· Urgency: {d.urgency}</span>
                </div>
                <Link
                  href={`/executive/decisions/${d.decisionId}/brief`}
                  className="text-xs font-semibold text-blue-400 hover:underline"
                >
                  Open Decision Brief →
                </Link>
              </div>
              <h3 className="text-base font-semibold text-white mb-1">{d.title}</h3>
              <p className="text-sm text-slate-300 mb-3">{d.whyNow}</p>
              <div className="text-xs text-slate-500">
                Reversibility: {d.reversibility} · Cost of Delay: {d.costOfDelay}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

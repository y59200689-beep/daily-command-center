"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import "./executive.css";
import type { DecisionBrief } from "@/lib/executive";

export function DecisionBriefView({ decisionId }: { decisionId: string }) {
  const [brief, setBrief] = useState<DecisionBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch(`/api/executive/decisions/${decisionId}/brief`);
        if (!res.ok) throw new Error("Decision brief not found.");
        const json = await res.json();
        if (active) setBrief(json.brief);
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [decisionId]);

  if (loading) return <div className="executive-surface p-8 text-center text-slate-400">Loading decision brief...</div>;
  if (error || !brief) {
    return (
      <div className="executive-surface p-6 bg-red-950/40 border border-red-800 rounded-lg text-red-200">
        {error ?? "Brief unavailable."}
      </div>
    );
  }

  return (
    <div className="executive-surface">
      <div className="flex items-center justify-between mb-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Executive Decision Brief</span>
          <h1 className="text-2xl font-bold text-white tracking-tight mt-1">{brief.title}</h1>
        </div>
        <Link href="/executive/decisions" className="text-sm text-blue-400 hover:underline">
          ← Back to Decision Queue
        </Link>
      </div>

      {/* Meta Header */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-900 border border-slate-800 rounded-lg mb-6 text-xs">
        <div>
          <span className="text-slate-400">Readiness</span>
          <div className="font-semibold text-green-400 mt-0.5">{brief.readiness}</div>
        </div>
        <div>
          <span className="text-slate-400">Impact</span>
          <div className="font-semibold text-white mt-0.5">{brief.impact}</div>
        </div>
        <div>
          <span className="text-slate-400">Reversibility</span>
          <div className="font-semibold text-slate-300 mt-0.5 capitalize">{brief.reversibility}</div>
        </div>
        <div>
          <span className="text-slate-400">Cost of Delay</span>
          <div className="font-semibold text-amber-400 mt-0.5 capitalize">{brief.costOfDelay}</div>
        </div>
      </div>

      {/* Why Now */}
      <div className="mb-6">
        <h2 className="text-base font-semibold text-white mb-2">1. Why Now & Context</h2>
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg text-sm text-slate-300">
          {brief.whyNow}
        </div>
      </div>

      {/* Structured Alternatives */}
      <div className="mb-6">
        <h2 className="text-base font-semibold text-white mb-2">2. Alternatives & Tradeoffs</h2>
        <div className="space-y-3">
          {brief.alternatives.map((alt, i) => (
            <div key={i} className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg">
              <h3 className="font-semibold text-white mb-2">Option {i + 1}: {alt.name}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 bg-green-950/20 border border-green-900/40 rounded">
                  <div className="font-semibold text-green-400 mb-1">Pros</div>
                  <ul className="list-disc pl-4 space-y-0.5 text-slate-300">
                    {alt.pros.map((p, idx) => <li key={idx}>{p}</li>)}
                  </ul>
                </div>
                <div className="p-2.5 bg-red-950/20 border border-red-900/40 rounded">
                  <div className="font-semibold text-red-400 mb-1">Cons</div>
                  <ul className="list-disc pl-4 space-y-0.5 text-slate-300">
                    {alt.cons.map((c, idx) => <li key={idx}>{c}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Grounded Evidence & Unknowns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg">
          <h2 className="text-sm font-semibold text-white mb-2">3. Grounded Evidence</h2>
          <ul className="list-disc pl-4 space-y-1 text-xs text-slate-300">
            {brief.evidence.map((e, idx) => <li key={idx}>{e}</li>)}
          </ul>
        </div>
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg">
          <h2 className="text-sm font-semibold text-white mb-2">4. Key Unknowns & Risks</h2>
          <ul className="list-disc pl-4 space-y-1 text-xs text-slate-300">
            {brief.unknowns.concat(brief.risks).map((u, idx) => <li key={idx}>{u}</li>)}
          </ul>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-lg">
        <div className="text-xs text-slate-400">Decision records are stored in canonical Decision Log</div>
        <Link href={brief.route} className="executive-btn executive-btn-primary">
          Open in Decision Log →
        </Link>
      </div>
    </div>
  );
}

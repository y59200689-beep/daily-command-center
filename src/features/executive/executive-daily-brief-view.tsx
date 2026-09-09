"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import "./executive.css";

type DailyBriefData = {
  date: string;
  headline: string;
  executiveSummary: string;
  recommendedFocus: string;
  topPriorities: { title: string; domain: string; why: string; route: string }[];
  keyChanges: { domain: string; change: string }[];
  openDecisions: { title: string; readiness: string; route: string }[];
  criticalRisks: { title: string; domain: string; action: string }[];
  whatCanWait: { title: string; reason: string }[];
  domainHealth: Record<string, { status: string; reason: string }>;
  scope: string;
};

export function ExecutiveDailyBriefView({ scope = "business" }: { scope?: string }) {
  const [data, setData] = useState<DailyBriefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch(`/api/executive/brief?scope=${scope}`);
        if (!res.ok) throw new Error("Daily brief unavailable.");
        const json = await res.json();
        if (active) setData(json);
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [scope]);

  if (loading) return <div className="executive-surface"><div className="p-8 text-center text-slate-400">Building your daily brief...</div></div>;
  if (error || !data) return (
    <div className="executive-surface">
      <div className="p-6 bg-red-950/40 border border-red-800 rounded-lg text-red-200">{error ?? "Brief unavailable."}</div>
    </div>
  );

  return (
    <div className="executive-surface">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-1">Daily Executive Brief</div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{data.headline}</h1>
          <p className="text-sm text-slate-400 mt-1">{data.date} · {data.scope.toUpperCase()} scope</p>
        </div>
        <Link href="/executive" className="text-sm text-blue-400 hover:underline">← Executive Center</Link>
      </div>

      {/* Executive Summary */}
      <div className="executive-memo-card mb-8">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Executive Summary</div>
        <p className="text-sm text-slate-200 leading-relaxed">{data.executiveSummary}</p>
        <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-blue-300">
          <span className="font-bold text-blue-400">Recommended Focus:</span> {data.recommendedFocus}
        </div>
      </div>

      {/* Two-column: Priorities + Open Decisions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Top Priorities */}
        <div>
          <div className="executive-section-title">
            <span>Top Priorities</span>
            <Link href="/executive" className="text-xs text-blue-400 hover:underline font-normal">View All</Link>
          </div>
          <div className="space-y-3">
            {data.topPriorities.length === 0 ? (
              <p className="text-sm text-slate-400">No priorities identified.</p>
            ) : data.topPriorities.map((p, i) => (
              <div key={i} className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <span className="executive-badge executive-badge-critical">#{i + 1}</span>
                  <span className="executive-badge executive-badge-domain">{p.domain}</span>
                </div>
                <div className="font-medium text-white text-sm">{p.title}</div>
                <div className="text-xs text-slate-400 mt-0.5 mb-2">{p.why}</div>
                <Link href={p.route} className="text-xs text-blue-400 hover:underline">Act →</Link>
              </div>
            ))}
          </div>
        </div>

        {/* Open Decisions */}
        <div>
          <div className="executive-section-title">
            <span>Decisions Awaiting You</span>
            <Link href="/executive/decisions" className="text-xs text-blue-400 hover:underline font-normal">Queue →</Link>
          </div>
          <div className="space-y-3">
            {data.openDecisions.length === 0 ? (
              <p className="text-sm text-slate-400">No pending decisions.</p>
            ) : data.openDecisions.map((d, i) => (
              <div key={i} className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-medium text-white text-sm">{d.title}</div>
                  <span className="executive-badge executive-badge-ready">{d.readiness}</span>
                </div>
                <Link href={d.route} className="text-xs text-blue-400 hover:underline">Open Brief →</Link>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Key Changes */}
      {data.keyChanges.length > 0 && (
        <div className="mb-8">
          <div className="executive-section-title">
            <span>Material Changes Since Yesterday</span>
            <Link href="/executive/changes" className="text-xs text-blue-400 hover:underline font-normal">Full Log →</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {data.keyChanges.map((c, i) => (
              <div key={i} className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg flex items-start gap-3">
                <span className="executive-badge executive-badge-domain shrink-0">{c.domain}</span>
                <span className="text-sm text-slate-300">{c.change}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Critical Risks */}
      {data.criticalRisks.length > 0 && (
        <div className="mb-8">
          <div className="executive-section-title">
            <span>Critical Risks</span>
            <Link href="/executive/risks" className="text-xs text-blue-400 hover:underline font-normal">Risk Radar →</Link>
          </div>
          <div className="space-y-2">
            {data.criticalRisks.map((r, i) => (
              <div key={i} className="p-3 bg-red-950/30 border border-red-800/50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <span className="executive-badge executive-badge-domain">{r.domain}</span>
                </div>
                <div className="font-medium text-red-200 text-sm">{r.title}</div>
                <div className="text-xs text-red-300/80 mt-1">Action: {r.action}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* What Can Wait + Domain Health */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div>
          <div className="executive-section-title"><span>What Can Safely Wait</span></div>
          {data.whatCanWait.length === 0 ? (
            <p className="text-sm text-slate-400">Everything requires near-term attention.</p>
          ) : (
            <div className="space-y-2">
              {data.whatCanWait.map((w, i) => (
                <div key={i} className="p-3 bg-slate-900/40 border border-slate-800/80 rounded-lg">
                  <div className="text-sm font-medium text-slate-300">{w.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{w.reason}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="executive-section-title"><span>Domain Health Snapshot</span></div>
          <div className="space-y-1.5">
            {Object.entries(data.domainHealth).map(([domain, h]) => (
              <div key={domain} className="flex items-center justify-between p-2 bg-slate-900/40 border border-slate-800 rounded">
                <span className="text-xs font-medium text-slate-300 capitalize">{domain}</span>
                <span className={`text-xs font-bold ${
                  h.status === "healthy" ? "text-green-400" : h.status === "at_risk" ? "text-red-400" : "text-amber-400"
                }`}>
                  {h.status.replace("_", " ").toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

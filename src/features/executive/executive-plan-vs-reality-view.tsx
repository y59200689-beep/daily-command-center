"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import "./executive.css";

type PlanVsRealityDomain = {
  domain: string;
  plan: string;
  actual: string;
  delta: "ahead" | "on_track" | "behind" | "stalled" | "unknown";
  deltaNote: string;
  keyRisk?: string;
  route: string;
};

type PlanVsRealityData = {
  asOf: string;
  horizon: string;
  domains: PlanVsRealityDomain[];
  summary: string;
  overallDelta: "ahead" | "on_track" | "behind" | "mixed";
};

const DELTA_COLORS: Record<string, string> = {
  ahead: "text-green-400",
  on_track: "text-blue-400",
  behind: "text-red-400",
  stalled: "text-amber-400",
  mixed: "text-amber-400",
  unknown: "text-slate-400",
};

const DELTA_ICONS: Record<string, string> = {
  ahead: "↑",
  on_track: "→",
  behind: "↓",
  stalled: "⏸",
  unknown: "?",
  mixed: "~",
};

export function ExecutivePlanVsRealityView() {
  const [data, setData] = useState<PlanVsRealityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/executive/plan-vs-reality");
        if (!res.ok) throw new Error("Failed.");
        const json = await res.json();
        if (active) setData(json);
      } catch {
        if (active) setData(null);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  return (
    <div className="executive-surface">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Plan vs. Reality</h1>
          <p className="text-sm text-slate-400">
            {data ? `${data.horizon} · as of ${data.asOf}` : "Cross-domain commitment tracking"}
          </p>
        </div>
        <Link href="/executive" className="text-sm text-blue-400 hover:underline">← Executive Center</Link>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-400">Loading plan vs. reality...</div>
      ) : !data ? (
        <div className="p-6 bg-red-950/30 border border-red-800 rounded-lg text-red-200">
          Plan vs. reality data is unavailable.
        </div>
      ) : (
        <>
          {/* Overall Status */}
          <div className="executive-memo-card mb-8">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Overall Status</div>
            <div className={`text-2xl font-bold mb-2 ${DELTA_COLORS[data.overallDelta]}`}>
              {DELTA_ICONS[data.overallDelta]} {data.overallDelta.replace("_", " ").toUpperCase()}
            </div>
            <p className="text-sm text-slate-300">{data.summary}</p>
          </div>

          {/* Per-Domain Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.domains.map((d) => (
              <div key={d.domain} className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="executive-badge executive-badge-domain">{d.domain}</span>
                  <span className={`text-sm font-bold ${DELTA_COLORS[d.delta]}`}>
                    {DELTA_ICONS[d.delta]} {d.delta.replace("_", " ")}
                  </span>
                </div>

                <div className="space-y-2 mb-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-slate-500 mb-0.5 uppercase font-bold tracking-wider">Planned</div>
                      <div className="text-slate-300">{d.plan || "No target set"}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 mb-0.5 uppercase font-bold tracking-wider">Actual</div>
                      <div className="text-slate-200 font-medium">{d.actual || "No data"}</div>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 pt-2 border-t border-slate-800">{d.deltaNote}</div>
                </div>

                {d.keyRisk && (
                  <div className="p-2 bg-red-950/30 border border-red-800/40 rounded text-xs text-red-300 mb-3">
                    ⚠ {d.keyRisk}
                  </div>
                )}

                <Link href={d.route} className="text-xs text-blue-400 hover:underline font-semibold">
                  Open {d.domain} →
                </Link>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

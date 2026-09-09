"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import "./executive.css";
import type { RiskCluster, ExecutiveSignal } from "@/lib/executive";

export function ExecutiveRisksView() {
  const [clusters, setClusters] = useState<RiskCluster[]>([]);
  const [risks, setRisks] = useState<ExecutiveSignal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/executive/risks");
        if (!res.ok) throw new Error("Failed to load risks.");
        const json = await res.json();
        if (active) {
          setClusters(json.riskClusters ?? []);
          setRisks(json.risks ?? []);
        }
      } catch {
        if (active) {
          setClusters([]);
          setRisks([]);
        }
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
          <h1 className="text-2xl font-bold text-white tracking-tight">Executive Risk Radar</h1>
          <p className="text-sm text-slate-400">Cross-domain risk clusters and high-exposure operational vulnerabilities</p>
        </div>
        <Link href="/executive" className="text-sm text-blue-400 hover:underline">
          ← Back to Executive Command Center
        </Link>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-400">Loading risk radar...</div>
      ) : (
        <>
          {/* Risk Clusters */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-3">Cross-Domain Risk Clusters</h2>
            {clusters.length === 0 ? (
              <div className="p-6 text-center text-slate-400 bg-slate-900/40 border border-slate-800 rounded-lg">
                No cross-domain risk clusters detected.
              </div>
            ) : (
              <div className="space-y-4">
                {clusters.map((c) => (
                  <div key={c.id} className="executive-cluster-card">
                    <div className="flex items-center justify-between mb-1">
                      <div className="executive-cluster-title">{c.name}</div>
                      <span className="executive-badge executive-badge-critical">{c.severity}</span>
                    </div>
                    <p className="text-sm text-slate-300 mb-2">{c.summary}</p>
                    <div className="flex items-center gap-2 mb-3">
                      {c.domains.map((d) => (
                        <span key={d} className="executive-badge executive-badge-domain">{d}</span>
                      ))}
                    </div>
                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-xs text-slate-400">Action: {c.recommendedAction}</span>
                      <Link href={c.route} className="text-xs font-semibold text-blue-400 hover:underline">
                        Investigate →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Individual Domain Risks */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-3">Individual Domain Risks</h2>
            <div className="space-y-3">
              {risks.map((r) => (
                <div key={r.id} className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="executive-badge executive-badge-domain">{r.domain}</span>
                      <span className="text-xs font-semibold text-red-400 uppercase">{r.severity}</span>
                    </div>
                    <Link href={r.route} className="text-xs text-blue-400 hover:underline font-semibold">
                      Open Domain Record →
                    </Link>
                  </div>
                  <h3 className="font-semibold text-white mb-1">{r.title}</h3>
                  <p className="text-xs text-slate-400">{r.reason}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

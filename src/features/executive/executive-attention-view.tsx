"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import "./executive.css";

type AttentionItem = {
  id: string;
  domain: string;
  title: string;
  reason: string;
  urgency: "now" | "today" | "this_week";
  route: string;
  canDelegate?: boolean;
  delegateTo?: string;
};

type AttentionData = {
  immediate: AttentionItem[];
  today: AttentionItem[];
  thisWeek: AttentionItem[];
  delegationCandidates: { taskTitle: string; suggestedOwner?: string; reason: string }[];
};

export function ExecutiveAttentionView() {
  const [data, setData] = useState<AttentionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/executive/attention");
        if (!res.ok) throw new Error("Failed.");
        const json = await res.json();
        if (active) setData(json);
      } catch {
        if (active) setData({ immediate: [], today: [], thisWeek: [], delegationCandidates: [] });
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
          <h1 className="text-2xl font-bold text-white tracking-tight">Attention Allocation</h1>
          <p className="text-sm text-slate-400">Where your attention should go — and what can safely be delegated</p>
        </div>
        <Link href="/executive" className="text-sm text-blue-400 hover:underline">← Executive Center</Link>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-400">Loading attention data...</div>
      ) : !data ? null : (
        <>
          {/* Immediate */}
          <section className="mb-8">
            <div className="executive-section-title">
              <span>🔴 Requires Immediate Attention</span>
              <span className="text-xs text-red-400 font-normal">{data.immediate.length} items</span>
            </div>
            {data.immediate.length === 0 ? (
              <p className="text-sm text-slate-400">No immediate-urgency items.</p>
            ) : (
              <div className="space-y-3">
                {data.immediate.map((item) => (
                  <div key={item.id} className="p-4 bg-red-950/30 border border-red-800/60 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="executive-badge executive-badge-critical">NOW</span>
                        <span className="executive-badge executive-badge-domain">{item.domain}</span>
                      </div>
                      <Link href={item.route} className="text-xs font-semibold text-blue-400 hover:underline">Act →</Link>
                    </div>
                    <h3 className="font-semibold text-white mb-1">{item.title}</h3>
                    <p className="text-xs text-slate-400">{item.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Today */}
          <section className="mb-8">
            <div className="executive-section-title">
              <span>🟡 Handle Today</span>
              <span className="text-xs text-amber-400 font-normal">{data.today.length} items</span>
            </div>
            {data.today.length === 0 ? (
              <p className="text-sm text-slate-400">Nothing else due today.</p>
            ) : (
              <div className="space-y-3">
                {data.today.map((item) => (
                  <div key={item.id} className="p-4 bg-amber-950/20 border border-amber-800/40 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="executive-badge" style={{ background: "#78350f20", color: "#fbbf24" }}>TODAY</span>
                        <span className="executive-badge executive-badge-domain">{item.domain}</span>
                      </div>
                      <Link href={item.route} className="text-xs font-semibold text-blue-400 hover:underline">Open →</Link>
                    </div>
                    <h3 className="font-semibold text-slate-200 mb-1">{item.title}</h3>
                    <p className="text-xs text-slate-400">{item.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* This Week */}
          <section className="mb-8">
            <div className="executive-section-title">
              <span>🔵 This Week</span>
              <span className="text-xs text-blue-400 font-normal">{data.thisWeek.length} items</span>
            </div>
            {data.thisWeek.length === 0 ? (
              <p className="text-sm text-slate-400">Nothing queued for this week.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.thisWeek.map((item) => (
                  <div key={item.id} className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="executive-badge executive-badge-domain">{item.domain}</span>
                    </div>
                    <div className="font-medium text-slate-200 text-sm">{item.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{item.reason}</div>
                    <Link href={item.route} className="text-xs text-blue-400 hover:underline mt-2 inline-block">View →</Link>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Delegation */}
          {data.delegationCandidates.length > 0 && (
            <section className="mb-6">
              <div className="executive-section-title">
                <span>🤝 Delegation Candidates</span>
                <Link href="/team/delegations" className="text-xs text-blue-400 hover:underline font-normal">Open Delegations →</Link>
              </div>
              <div className="space-y-2">
                {data.delegationCandidates.map((dc, idx) => (
                  <div key={idx} className="p-3 bg-slate-900/50 border border-slate-800 rounded-lg flex items-start justify-between">
                    <div>
                      <div className="text-sm font-medium text-slate-200">{dc.taskTitle}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{dc.reason}</div>
                      {dc.suggestedOwner && (
                        <div className="text-xs text-green-400 mt-1">→ Suggested: {dc.suggestedOwner}</div>
                      )}
                    </div>
                    <Link href="/team/delegations" className="text-xs text-blue-400 hover:underline ml-4 shrink-0">Delegate →</Link>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

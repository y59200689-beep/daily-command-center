"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icons } from "@/components/icons";
import "./executive.css";
import type { ExecutiveContext } from "@/lib/executive-server";

export function ExecutiveHome() {
  const [data, setData] = useState<ExecutiveContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"business" | "personal" | "combined">("business");
  const [error, setError] = useState<string | null>(null);
  const [learningSignal, setLearningSignal] = useState<{ title: string; description: string; path: string } | null>(null);

  useEffect(() => {
    fetch("/api/learning/overview")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.topSignal) {
          setLearningSignal(json.topSignal);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch(`/api/executive/overview?scope=${scope}`);
        if (!res.ok) throw new Error("Failed to load executive intelligence.");
        const json = await res.json();
        if (active) setData(json);
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
  }, [scope]);

  if (loading) {
    return (
      <div className="domain-page executive-page">
        <div className="loading-state" aria-live="polite">
          <span className="loading-spinner" />
          <p>Loading executive briefing…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="domain-page executive-page">
        <div className="inline-error" role="alert">
          <p>{error ?? "Executive briefing unavailable."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="domain-page executive-page">
      <header className="task-context-header executive-context-header">
        <div>
          <div className="task-context-header__path">
            <Icons.BriefcaseBusiness size={15} />
            <span>Intelligence</span>
            <Icons.ChevronRight size={13} />
            <strong>Executive</strong>
          </div>
          <h1>Executive Command Center</h1>
          <p>Cross-domain intelligence briefing · {data.today}</p>
        </div>
        <div className="task-context-header__actions">
          <div className="view-switch" aria-label="Executive scope">
            {(["business", "personal", "combined"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setLoading(true);
                  setScope(s);
                }}
                className={scope === s ? "active" : ""}
                aria-pressed={scope === s}
              >
                {s.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Today's Executive Memo */}
      <div className="executive-memo-card">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs uppercase font-bold tracking-wider text-blue-400">Executive Memo</span>
          <span className="text-xs text-slate-400">· Private Briefing</span>
        </div>
        <div className="executive-memo-headline">{data.brief.headline}</div>
        <div className="executive-memo-focus">Recommended Focus: {data.brief.recommendedFocus}</div>
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800/80">
          <Link href="/executive/brief/daily" className="text-xs text-blue-400 hover:underline">
            Open Daily Brief →
          </Link>
          <span className="text-slate-600">·</span>
          <Link href="/executive/focus" className="text-xs text-slate-400 hover:text-white">
            Focus Mode
          </Link>
          <span className="text-slate-600">·</span>
          <Link href="/executive/reports" className="text-xs text-slate-400 hover:text-white">
            Reports Hub
          </Link>
        </div>
      </div>

      {/* Top 5 Bounded Priorities */}
      <div className="executive-section-title">
        <span>Top Priorities</span>
        <span className="text-xs text-slate-400 font-normal">Ranked by impact and cross-domain urgency</span>
      </div>
      <div className="executive-priority-grid">
        {data.priorities.map((item) => (
          <div key={item.id} className="executive-priority-card">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="executive-badge executive-badge-critical">Rank #{item.rank}</span>
                <span className="executive-badge executive-badge-domain">{item.domain}</span>
              </div>
              <h3 className="font-semibold text-white mb-1">{item.title}</h3>
              <p className="text-sm text-slate-300 mb-3">{item.why}</p>
            </div>
            <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between">
              <span className="text-xs text-amber-400">{item.impact}</span>
              <Link href={item.route} className="text-xs font-semibold text-blue-400 hover:underline">
                Act →
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Cross-Domain Risk Clusters */}
      {data.riskClusters.length > 0 && (
        <div className="mb-8">
          <div className="executive-section-title">
            <span>Cross-Domain Risk Clusters</span>
            <Link href="/executive/risks" className="text-xs text-blue-400 hover:underline font-normal">
              View All Risks →
            </Link>
          </div>
          {data.riskClusters.slice(0, 3).map((cluster) => (
            <div key={cluster.id} className="executive-cluster-card">
              <div className="flex items-center justify-between mb-1">
                <div className="executive-cluster-title">{cluster.name}</div>
                <span className="executive-badge executive-badge-critical">{cluster.severity}</span>
              </div>
              <p className="text-sm text-slate-300 mb-2">{cluster.summary}</p>
              <div className="text-xs text-slate-400 mb-3">Action: {cluster.recommendedAction}</div>
              <div className="flex items-center gap-3">
                <Link href={cluster.route} className="text-xs font-semibold text-blue-400 hover:underline">
                  Investigate Cluster →
                </Link>
                <Link href={`/chief-of-staff/inbox?source=executive_cluster&title=${encodeURIComponent(cluster.recommendedAction)}`} className="text-xs font-semibold text-purple-400 hover:underline">
                  Prepare Action →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Material Changes & Decision Queue */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Material Changes */}
        <div>
          <div className="executive-section-title">
            <span>What Changed</span>
            <Link href="/executive/changes" className="text-xs text-blue-400 hover:underline font-normal">
              Changes Log →
            </Link>
          </div>
          <div className="space-y-3">
            {data.changes.length === 0 ? (
              <p className="text-sm text-slate-400">No material changes since previous snapshot.</p>
            ) : (
              data.changes.slice(0, 4).map((c) => (
                <div key={c.id} className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="executive-badge executive-badge-domain">{c.domain}</span>
                    <span className="text-xs font-medium text-amber-400 uppercase">{c.type}</span>
                  </div>
                  <div className="text-sm font-medium text-white">{c.title}</div>
                  <div className="text-xs text-slate-400 mt-1">{c.reason}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Decision Queue */}
        <div>
          <div className="executive-section-title">
            <span>Decisions Awaiting Action</span>
            <Link href="/executive/decisions" className="text-xs text-blue-400 hover:underline font-normal">
              Decision Queue →
            </Link>
          </div>
          <div className="space-y-3">
            {data.decisions.length === 0 ? (
              <p className="text-sm text-slate-400">No pending decisions.</p>
            ) : (
              data.decisions.slice(0, 4).map((d) => (
                <div key={d.decisionId} className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-white">{d.title}</span>
                    <span className="executive-badge executive-badge-ready">{d.readiness}</span>
                  </div>
                  <div className="text-xs text-slate-400 mb-2">{d.whyNow}</div>
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800">
                    <span className="text-slate-500">Impact: {d.impact}</span>
                    <div className="flex items-center gap-3">
                      <Link href={`/executive/decisions/${d.decisionId}/brief`} className="text-blue-400 hover:underline font-semibold">
                        Open Brief →
                      </Link>
                      <Link href={`/chief-of-staff/inbox?source=decision&title=${encodeURIComponent("Execute decision: " + d.title)}`} className="text-purple-400 hover:underline font-semibold">
                        Prepare Action →
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* What Can Wait & Attention */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div>
          <div className="executive-section-title">
            <span>What Can Safely Wait</span>
            <span className="text-xs text-slate-500 font-normal">Non-blocking / low urgency</span>
          </div>
          <div className="space-y-2">
            {data.canWait.length === 0 ? (
              <p className="text-sm text-slate-400">All current items require near-term attention.</p>
            ) : (
              data.canWait.map((w, idx) => (
                <div key={idx} className="p-3 bg-slate-900/40 border border-slate-800/80 rounded-lg">
                  <div className="text-sm font-medium text-slate-300">{w.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{w.reason}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <div className="executive-section-title">
            <span>Delegation Candidates</span>
            <Link href="/executive/attention" className="text-xs text-blue-400 hover:underline font-normal">
              Attention Allocation →
            </Link>
          </div>
          <div className="space-y-2">
            {data.delegationCandidates.length === 0 ? (
              <p className="text-sm text-slate-400">No automatic delegation candidates identified.</p>
            ) : (
              data.delegationCandidates.map((dc, idx) => (
                <div key={idx} className="p-3 bg-slate-900/40 border border-slate-800/80 rounded-lg">
                  <div className="text-sm font-medium text-slate-300">{dc.taskTitle}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{dc.reason}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Curated Domain Health */}
      <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-lg mb-8">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Domain Health Categorization</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 text-xs">
          {Object.entries(data.domainHealth).map(([domain, h]) => (
            <div key={domain} className="p-2.5 bg-slate-950/60 border border-slate-800 rounded">
              <div className="font-semibold text-slate-200 capitalize">{domain}</div>
              <div className={`mt-1 font-medium ${
                h.status === "healthy" ? "text-green-400" : h.status === "at_risk" ? "text-red-400" : "text-amber-400"
              }`}>
                {h.status.replace("_", " ").toUpperCase()}
              </div>
              <div className="text-slate-500 text-[10px] mt-0.5 truncate">{h.reason}</div>
            </div>
          ))}
        </div>
      </div>

      {/* V18 Operating Learning Signal (Max 1) */}
      {learningSignal && (
        <div className="p-4 bg-slate-900/60 border border-amber-500/30 rounded-lg mb-8 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-1">
              Operating Learning Signal
            </div>
            <div className="text-sm font-medium text-slate-200">{learningSignal.title}</div>
            <div className="text-xs text-slate-400 mt-0.5">{learningSignal.description}</div>
          </div>
          <Link href={learningSignal.path} className="text-xs px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-md transition-colors flex-shrink-0">
            Review in Memory →
          </Link>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { SignalRow } from "@/features/founder-os/state-view";
import type { Signal } from "@/lib/founder-os/intelligence";
import {
  AlertTriangle,
  Clock,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  RotateCcw,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import "./chief-of-staff.css";

type ChiefState = {
  founderRecommendations?: Signal[];
  nextAction: {
    title: string;
    whyNow: string;
    risk: string;
    approvalRequirement: string;
    route: string;
    actionId?: string;
    readiness: string;
  };
  topMetrics: {
    preparedCount: number;
    awaitingApprovalCount: number;
    readyToExecuteCount: number;
    inProgressCount: number;
    needsAttentionCount: number;
    recentlyCompletedCount: number;
    failedCount: number;
  };
  approvals: Array<{
    id: string;
    title: string;
    summary: string;
    action_type: string;
    risk_level: string;
    status: string;
    payload: Record<string, unknown>;
    payload_hash?: string;
    created_at: string;
  }>;
  executions: Array<{
    id: string;
    action_type: string;
    status: string;
    risk_level: string;
    error_message?: string;
    started_at?: string;
    completed_at?: string;
  }>;
  escalations: Array<{
    id: string;
    title: string;
    reason: string;
    severity: string;
    status: string;
  }>;
  proposals?: Array<{
    id: string;
    title: string;
    reason?: string;
    risk_level: string;
    status: string;
  }>;
  dailyBrief?: {
    whatChanged: Array<{ id: string; title: string; route: string; why: string }>;
    whatMatters: Array<{ id: string; title: string; route: string; why: string }>;
    whatNeedsYou: Array<{ id: string; title: string; route: string; why: string }>;
    whatCanWait: Array<{ id: string; title: string; route: string; why: string }>;
    whatShouldBeDelegated: Array<{ id: string; title: string; route: string; why: string }>;
    whatShouldBeLearned: Array<{ id: string; title: string; route: string; why: string }>;
  };
};

export function ChiefOfStaffHome() {
  const [data, setData] = useState<ChiefState | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [learningContext, setLearningContext] = useState<{ title: string; description: string; path: string } | null>(null);

  useEffect(() => {
    fetch("/api/learning/overview")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.topSignal) {
          setLearningContext(json.topSignal);
        } else if (json?.recentLessons?.length > 0) {
          const top = json.recentLessons[0];
          setLearningContext({
            title: top.title,
            description: `Operating guideline from accepted memory (${top.domain}).`,
            path: `/learning/lessons/${top.id}`,
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    async function fetchOverview() {
      try {
        const res = await fetch("/api/chief-of-staff/overview");
        if (!res.ok) throw new Error("Could not load Chief of Staff overview.");
        const json = await res.json();
        if (active) setData(json);
      } catch (err: unknown) {
        if (active) setMessage(err instanceof Error ? err.message : "Error loading data");
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchOverview();
    return () => {
      active = false;
    };
  }, []);

  async function handleApprove(approvalId: string, payload: Record<string, unknown>) {
    setActionInProgress(approvalId);
    try {
      const res = await fetch(`/api/chief-of-staff/approvals/${approvalId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewed_payload: payload }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Approval failed.");
      setMessage(`Action executed safely: ${result.message || "Done"}`);
      // Refresh
      const refreshRes = await fetch("/api/chief-of-staff/overview");
      if (refreshRes.ok) setData(await refreshRes.json());
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleReject(approvalId: string) {
    setActionInProgress(approvalId);
    try {
      const res = await fetch(`/api/chief-of-staff/approvals/${approvalId}/reject`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Rejection failed.");
      setMessage("Action rejected and archived.");
      const refreshRes = await fetch("/api/chief-of-staff/overview");
      if (refreshRes.ok) setData(await refreshRes.json());
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Rejection failed.");
    } finally {
      setActionInProgress(null);
    }
  }

  if (loading) {
    return (
      <div className="chief-container py-12 text-center text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
        <p>Loading Chief of Staff command center...</p>
      </div>
    );
  }

  const metrics = data?.topMetrics || {
    preparedCount: 0,
    awaitingApprovalCount: 0,
    readyToExecuteCount: 0,
    inProgressCount: 0,
    needsAttentionCount: 0,
    recentlyCompletedCount: 0,
    failedCount: 0,
  };

  const pendingApprovals = (data?.approvals || []).filter((a) => a.status === "pending");
  const failedExecutions = (data?.executions || []).filter((e) => e.status === "failed");
  const completedExecutions = (data?.executions || []).filter((e) => e.status === "executed" || e.status === "verified");

  return (
    <div className="chief-container">
      {data?.founderRecommendations?.length ? <section className="founder-state"><h2>Founder recommendations</h2><p className="founder-muted">Review the source and prepare a next step. Actions continue through the existing approval workflow.</p>{data.founderRecommendations.map(signal => <SignalRow key={signal.id} signal={signal} />)}</section> : null}
      {/* ClickUp Context Header */}
      <header className="task-context-header">
        <div>
          <nav className="task-context-header__breadcrumb" aria-label="Breadcrumb">
            <span>Operate</span>
            <span>/</span>
            <span className="current">Chief of Staff</span>
          </nav>
          <div className="task-context-header__title-row">
            <h1><ShieldAlert className="w-5 h-5" style={{ display: "inline", verticalAlign: "middle", marginRight: "0.375rem" }} />Chief of Staff</h1>
            {metrics.awaitingApprovalCount > 0 && (
              <span className="task-context-header__total-badge task-context-header__total-badge--warning">
                {metrics.awaitingApprovalCount} need approval
              </span>
            )}
          </div>
          <p className="task-context-header__description">
            {metrics.preparedCount} actions prepared · {metrics.inProgressCount} in progress · {metrics.recentlyCompletedCount} completed
          </p>
        </div>
        <div className="task-context-header__actions">
          <Link
            href="/chief-of-staff/approvals"
            className="chief-primary-link px-3.5 py-1.5 rounded-lg text-xs font-medium transition"
          >
            Approval Center ({metrics.awaitingApprovalCount})
          </Link>
          <Link
            href="/chief-of-staff/plans"
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium border transition"
            style={{ borderColor: "var(--line)", color: "var(--ink)", background: "var(--surface)" }}
          >
            Action Plans
          </Link>
          <Link
            href="/chief-of-staff/history"
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium border transition"
            style={{ borderColor: "var(--line)", color: "var(--ink)", background: "var(--surface)" }}
          >
            Audit History
          </Link>
        </div>
      </header>

      {/* Remaining hero card content (next action, learning context) */}
      <div className="chief-hero-card">

        {/* Message Banner */}
        {message && (
          <div className="mt-4 p-3 rounded-lg bg-slate-800/80 border border-indigo-500/30 text-xs text-indigo-200 flex items-center justify-between">
            <span>{message}</span>
            <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Recommended Next Action */}
        {data?.nextAction && (
          <div className="chief-next-action mt-5 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="chief-next-action-label text-xs font-bold uppercase tracking-wider">Recommended Next Action</span>
                <span className={`chief-badge chief-badge-${data.nextAction.risk}`}>
                  {data.nextAction.risk}
                </span>
              </div>
              <h2 className="chief-next-action-title text-sm font-semibold">{data.nextAction.title}</h2>
              <p className="chief-next-action-copy text-xs mt-0.5">{data.nextAction.whyNow}</p>
            </div>
            {data.nextAction.readiness !== "complete" ? <Link
              href={data.nextAction.route}
              className="chief-next-action-cta inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-xs whitespace-nowrap transition"
            >
              Take Action <ArrowRight className="w-3.5 h-3.5" />
            </Link> : <Link href="/chief-of-staff/inbox" className="chief-next-action-cta inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-xs whitespace-nowrap transition">Review action inbox <ArrowRight className="w-3.5 h-3.5" /></Link>}
          </div>
        )}

        {/* V18 Operating Learning Context Banner (Informational Context) */}
        {learningContext && (
          <div className="mt-4 p-3.5 rounded-xl bg-slate-900/70 border border-indigo-500/25 flex items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block mb-0.5">
                Operating Memory Context
              </span>
              <strong className="text-xs text-slate-200">{learningContext.title}</strong>
              <p className="text-[11px] text-slate-400 mt-0.5 mb-0">{learningContext.description}</p>
            </div>
            <Link
              href={learningContext.path}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium whitespace-nowrap"
            >
              Review Context →
            </Link>
          </div>
        )}
      </div>

      {/* Chief of Staff Daily Brief */}
      {data?.dailyBrief && (
        <section className="chief-hero-card chief-daily-brief mt-6 p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block mb-0.5">Synthesis Brief</span>
              <h2 className="text-base font-semibold text-white">Chief of Staff Daily Brief</h2>
            </div>
            <span className="text-xs text-slate-400">Contextual priorities for executive focus</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* What Changed */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-300 block mb-2">What changed</span>
              {data.dailyBrief.whatChanged.length ? data.dailyBrief.whatChanged.map(item => (
                <Link key={item.id} href={item.route} className="block text-xs py-1 text-slate-400 hover:text-white transition">
                  <strong className="text-slate-200 block truncate">{item.title}</strong>
                  <span className="text-[10px] text-slate-500 block truncate">{item.why}</span>
                </Link>
              )) : <p className="text-[11px] text-slate-500">No material changes detected.</p>}
            </div>

            {/* What Matters */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-[11px] font-semibold text-amber-300 block mb-2">What matters</span>
              {data.dailyBrief.whatMatters.length ? data.dailyBrief.whatMatters.map(item => (
                <Link key={item.id} href={item.route} className="block text-xs py-1 text-slate-400 hover:text-white transition">
                  <strong className="text-slate-200 block truncate">{item.title}</strong>
                  <span className="text-[10px] text-slate-500 block truncate">{item.why}</span>
                </Link>
              )) : <p className="text-[11px] text-slate-500">All primary health metrics steady.</p>}
            </div>

            {/* What Needs You */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-[11px] font-semibold text-rose-300 block mb-2">What needs you</span>
              {data.dailyBrief.whatNeedsYou.length ? data.dailyBrief.whatNeedsYou.map(item => (
                <Link key={item.id} href={item.route} className="block text-xs py-1 text-slate-400 hover:text-white transition">
                  <strong className="text-slate-200 block truncate">{item.title}</strong>
                  <span className="text-[10px] text-slate-500 block truncate">{item.why}</span>
                </Link>
              )) : <p className="text-[11px] text-slate-500">No pending founder gates.</p>}
            </div>

            {/* What Can Wait */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-400 block mb-2">What can wait</span>
              {data.dailyBrief.whatCanWait.length ? data.dailyBrief.whatCanWait.map(item => (
                <Link key={item.id} href={item.route} className="block text-xs py-1 text-slate-400 hover:text-white transition">
                  <strong className="text-slate-200 block truncate">{item.title}</strong>
                  <span className="text-[10px] text-slate-500 block truncate">{item.why}</span>
                </Link>
              )) : <p className="text-[11px] text-slate-500">Queue is clear.</p>}
            </div>

            {/* What Should Be Delegated */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-[11px] font-semibold text-indigo-300 block mb-2">What to delegate</span>
              {data.dailyBrief.whatShouldBeDelegated.length ? data.dailyBrief.whatShouldBeDelegated.map(item => (
                <Link key={item.id} href={item.route} className="block text-xs py-1 text-slate-400 hover:text-white transition">
                  <strong className="text-slate-200 block truncate">{item.title}</strong>
                  <span className="text-[10px] text-slate-500 block truncate">{item.why}</span>
                </Link>
              )) : <p className="text-[11px] text-slate-500">No recurring bottlenecks identified.</p>}
            </div>

            {/* What Should Be Learned */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-[11px] font-semibold text-cyan-300 block mb-2">What to learn</span>
              {data.dailyBrief.whatShouldBeLearned.length ? data.dailyBrief.whatShouldBeLearned.map(item => (
                <Link key={item.id} href={item.route} className="block text-xs py-1 text-slate-400 hover:text-white transition">
                  <strong className="text-slate-200 block truncate">{item.title}</strong>
                  <span className="text-[10px] text-slate-500 block truncate">{item.why}</span>
                </Link>
              )) : <p className="text-[11px] text-slate-500">All experiments & forecasts current.</p>}
            </div>
          </div>
        </section>
      )}

      {/* Awaiting Your Approval Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" /> Awaiting Your Approval ({pendingApprovals.length})
          </h2>
          <Link href="/chief-of-staff/approvals" className="text-xs text-indigo-400 hover:underline">
            View All Approvals →
          </Link>
        </div>

        {pendingApprovals.length === 0 ? (
          <div className="chief-empty-state p-6 rounded-xl bg-slate-900/40 border border-slate-800 text-center text-slate-400 text-xs">
            No actions currently require your approval.
          </div>
        ) : (
          <div className="chief-action-grid">
            {pendingApprovals.slice(0, 4).map((app) => (
              <div key={app.id} className="chief-card border-amber-500/20">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className={`chief-badge chief-badge-${app.risk_level} mb-1`}>
                      {app.risk_level}
                    </span>
                    <h3 className="text-sm font-semibold text-white">{app.title}</h3>
                    <p className="text-xs text-slate-400 mt-1">{app.summary}</p>
                  </div>
                </div>

                <div className="chief-payload-box">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Exact Reviewed Payload:</div>
                  <pre>{JSON.stringify(app.payload, null, 2)}</pre>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
                  <span className="text-[10px] text-slate-500">Hash: {app.payload_hash?.slice(0, 8)}...</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleReject(app.id)}
                      disabled={actionInProgress === app.id}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-red-900/50 hover:text-red-300 text-slate-300 text-xs font-medium border border-slate-700 transition"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleApprove(app.id, app.payload)}
                      disabled={actionInProgress === app.id}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1 transition"
                    >
                      {actionInProgress === app.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      Approve & Execute
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Needs Attention / Escalations */}
      {data?.escalations && data.escalations.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-rose-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Operational Escalations ({data.escalations.length})
          </h2>
          <div className="space-y-2">
            {data.escalations.map((esc) => (
              <div key={esc.id} className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-800/30 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-rose-400 uppercase">{esc.severity}</span>
                    <h3 className="text-xs font-semibold text-white">{esc.title}</h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{esc.reason}</p>
                </div>
                <Link
                  href="/chief-of-staff/escalations"
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-white border border-slate-700 whitespace-nowrap"
                >
                  Review
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Failed / Needs Retry */}
      {failedExecutions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-orange-400 flex items-center gap-2">
            <RotateCcw className="w-4 h-4" /> Failed Actions Needing Review ({failedExecutions.length})
          </h2>
          <div className="space-y-2">
            {failedExecutions.map((failed) => (
              <div key={failed.id} className="p-3.5 rounded-xl bg-orange-950/20 border border-orange-800/30 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-semibold text-white">{failed.action_type}</h3>
                  <p className="text-xs text-orange-300 mt-0.5">{failed.error_message || "Execution error encountered."}</p>
                </div>
                <Link
                  href="/chief-of-staff/executions"
                  className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-xs font-semibold text-white"
                >
                  Retry Options
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recently Completed / Receipts */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Recently Completed & Verified ({completedExecutions.length})
          </h2>
          <Link href="/chief-of-staff/history" className="text-xs text-indigo-400 hover:underline">
            View History →
          </Link>
        </div>

        {completedExecutions.length === 0 ? (
          <div className="chief-empty-state p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-center text-slate-400 text-xs">
            No actions completed yet today.
          </div>
        ) : (
          <div className="space-y-2">
            {completedExecutions.slice(0, 3).map((comp) => (
              <div key={comp.id} className="p-3 rounded-lg bg-slate-900/40 border border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="font-medium text-white">{comp.action_type}</span>
                  <span className="chief-badge chief-badge-safe">Verified</span>
                </div>
                <span className="text-slate-500">{comp.completed_at ? new Date(comp.completed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Done"}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Quick Navigation Footer */}
      <div className="chief-quick-links pt-4 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
        <Link href="/chief-of-staff/inbox" className="p-3 rounded-lg bg-slate-900/40 hover:bg-slate-800 border border-slate-800 text-slate-300 transition">
          Action Inbox ({data?.proposals?.length || 0})
        </Link>
        <Link href="/chief-of-staff/templates" className="p-3 rounded-lg bg-slate-900/40 hover:bg-slate-800 border border-slate-800 text-slate-300 transition">
          Action Templates
        </Link>
        <Link href="/chief-of-staff/automation-opportunities" className="p-3 rounded-lg bg-slate-900/40 hover:bg-slate-800 border border-slate-800 text-slate-300 transition">
          Opportunities
        </Link>
        <Link href="/settings/chief-of-staff" className="p-3 rounded-lg bg-slate-900/40 hover:bg-slate-800 border border-slate-800 text-slate-300 transition">
          Autonomy Settings
        </Link>
      </div>
    </div>
  );
}

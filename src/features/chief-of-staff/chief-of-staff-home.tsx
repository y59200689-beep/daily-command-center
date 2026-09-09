"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  AlertTriangle,
  Clock,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import "./chief-of-staff.css";

type ChiefState = {
  nextAction: {
    title: string;
    whyNow: string;
    risk: string;
    approvalRequirement: string;
    route: string;
    actionId?: string;
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
      {/* Top Block: Hero & Editorial Hierarchy */}
      <div className="chief-hero-card">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-6 h-6 text-indigo-400" />
              <h1 className="text-xl font-bold tracking-tight text-white">Chief of Staff</h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Safe Action Orchestration
              </span>
            </div>
            <p className="text-slate-300 text-sm">
              <strong className="text-white">{metrics.preparedCount}</strong> actions prepared.{" "}
              <strong className="text-amber-300">{metrics.awaitingApprovalCount}</strong> requires your approval now.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/chief-of-staff/approvals"
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition"
            >
              Approval Center ({metrics.awaitingApprovalCount})
            </Link>
            <Link
              href="/chief-of-staff/plans"
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
            >
              Action Plans
            </Link>
            <Link
              href="/chief-of-staff/history"
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
            >
              Audit History
            </Link>
          </div>
        </div>

        {/* Message Banner */}
        {message && (
          <div className="mt-4 p-3 rounded-lg bg-slate-800/80 border border-indigo-500/30 text-xs text-indigo-200 flex items-center justify-between">
            <span>{message}</span>
            <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Recommended Next Action */}
        {data?.nextAction && (
          <div className="mt-5 p-4 rounded-xl bg-slate-900/80 border border-amber-500/30 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300">Recommended Next Action</span>
                <span className={`chief-badge chief-badge-${data.nextAction.risk}`}>
                  {data.nextAction.risk}
                </span>
              </div>
              <h2 className="text-sm font-semibold text-white">{data.nextAction.title}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{data.nextAction.whyNow}</p>
            </div>
            <Link
              href={data.nextAction.route}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs whitespace-nowrap transition"
            >
              Take Action <ArrowRight className="w-3.5 h-3.5" />
            </Link>
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
          <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800 text-center text-slate-400 text-xs">
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
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-center text-slate-400 text-xs">
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
      <div className="pt-4 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
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

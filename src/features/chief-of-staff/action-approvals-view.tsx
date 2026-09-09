"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Clock, ArrowLeft, RefreshCw, CheckCircle2 } from "lucide-react";
import "./chief-of-staff.css";

interface ApprovalItem {
  id: string;
  title: string;
  description?: string;
  summary?: string;
  action_type?: string;
  risk_level: string;
  payload: Record<string, unknown>;
  status: string;
  created_at: string;
  expires_at?: string;
}

export function ActionApprovalsView() {
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/chief-of-staff/approvals");
        if (res.ok) {
          const json = await res.json();
          if (active) setApprovals(json.items ?? []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  async function handleApprove(id: string, payload: Record<string, unknown>) {
    setActionInProgress(id);
    try {
      const res = await fetch(`/api/chief-of-staff/approvals/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewed_payload: payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Approval failed.");
      setMessage(`Action approved & executed: ${data.message || "Success"}`);
      const refresh = await fetch("/api/chief-of-staff/approvals");
      if (refresh.ok) setApprovals((await refresh.json()).items ?? []);
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Error executing approval");
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleReject(id: string) {
    setActionInProgress(id);
    try {
      const res = await fetch(`/api/chief-of-staff/approvals/${id}/reject`, { method: "POST" });
      if (!res.ok) throw new Error("Rejection failed.");
      setMessage("Action rejected.");
      const refresh = await fetch("/api/chief-of-staff/approvals");
      if (refresh.ok) setApprovals((await refresh.json()).items ?? []);
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Error rejecting approval");
    } finally {
      setActionInProgress(null);
    }
  }

  return (
    <div className="chief-container">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/chief-of-staff" className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" /> Approval Center
          </h1>
        </div>
      </div>

      {message && (
        <div className="p-3 rounded-lg bg-slate-800/80 border border-indigo-500/30 text-xs text-indigo-200 flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-400"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading approvals...</div>
      ) : approvals.length === 0 ? (
        <div className="p-8 rounded-xl bg-slate-900/40 border border-slate-800 text-center text-slate-400">
          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">All Clear</h3>
          <p className="text-xs text-slate-400 mt-1">No actions currently awaiting your approval.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {approvals.map((app) => (
            <div key={app.id} className="chief-card border-amber-500/20">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`chief-badge chief-badge-${app.risk_level}`}>{app.risk_level}</span>
                    <span className="text-xs font-semibold text-slate-400 uppercase">{app.action_type}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-white">{app.title}</h3>
                  <p className="text-xs text-slate-300 mt-1">{app.summary}</p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                  {app.status}
                </span>
              </div>

              <div className="chief-payload-box">
                <div className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Exact Reviewed Payload:</div>
                <pre>{JSON.stringify(app.payload, null, 2)}</pre>
              </div>

              {app.status === "pending" && (
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
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
                    className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    {actionInProgress === app.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Approve Exact Payload
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

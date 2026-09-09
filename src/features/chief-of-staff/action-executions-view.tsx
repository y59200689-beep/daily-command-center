"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { PlayCircle, ArrowLeft, RefreshCw, CheckCircle2, RotateCcw } from "lucide-react";
import "./chief-of-staff.css";

interface ExecutionItem {
  id: string;
  action_type: string;
  title: string;
  status: string;
  risk_level?: string;
  error_message?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export function ActionExecutionsView() {
  const [executions, setExecutions] = useState<ExecutionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/chief-of-staff/executions");
        if (res.ok) {
          const json = await res.json();
          if (active) setExecutions(json.executions ?? []);
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

  async function handleRetry(id: string) {
    setRetryingId(id);
    try {
      const res = await fetch(`/api/chief-of-staff/executions/${id}/retry`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Retry failed.");
      setMessage(`Retry scheduled: ${data.message || "Done"}`);
      const refresh = await fetch("/api/chief-of-staff/executions");
      if (refresh.ok) setExecutions((await refresh.json()).executions ?? []);
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setRetryingId(null);
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
            <PlayCircle className="w-5 h-5 text-indigo-400" /> Execution Queue
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
        <div className="text-center py-12 text-slate-400"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading execution queue...</div>
      ) : executions.length === 0 ? (
        <div className="p-8 rounded-xl bg-slate-900/40 border border-slate-800 text-center text-slate-400">
          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">Queue Clear</h3>
          <p className="text-xs text-slate-400 mt-1">No actions currently executing or pending verification.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {executions.map((exec) => (
            <div key={exec.id} className="chief-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`chief-badge chief-badge-${exec.risk_level || "low"}`}>{exec.risk_level || "low"}</span>
                    <span className="text-xs font-semibold text-slate-400 uppercase">{exec.action_type}</span>
                  </div>
                  <p className="text-xs text-slate-300">Execution ID: {exec.id}</p>
                  {exec.error_message && (
                    <p className="text-xs text-rose-400 mt-1 font-mono">{exec.error_message}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                    {exec.status}
                  </span>
                  {exec.status === "failed" && (
                    <button
                      onClick={() => handleRetry(exec.id)}
                      disabled={retryingId === exec.id}
                      className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1"
                    >
                      {retryingId === exec.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                      Retry
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

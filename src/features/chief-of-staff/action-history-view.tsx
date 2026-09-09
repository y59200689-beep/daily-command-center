"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { History, ArrowLeft, RefreshCw } from "lucide-react";
import "./chief-of-staff.css";

interface HistoryItem {
  id: string;
  action_type: string;
  title: string;
  status: string;
  provider?: string;
  summary?: string;
  execution_mode?: string;
  created_at: string;
}

export function ActionHistoryView() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/chief-of-staff/history");
        if (res.ok) {
          const json = await res.json();
          if (active) setHistory(json.history ?? []);
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

  return (
    <div className="chief-container">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/chief-of-staff" className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-400" /> Action Audit History
          </h1>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading audit history...</div>
      ) : history.length === 0 ? (
        <div className="p-8 rounded-xl bg-slate-900/40 border border-slate-800 text-center text-slate-400">
          <History className="w-8 h-8 mx-auto mb-2 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white">No Historical Actions</h3>
          <p className="text-xs text-slate-400 mt-1">Immutable execution audit logs will be permanently recorded here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((item) => (
            <div key={item.id} className="chief-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-indigo-400 uppercase">{item.action_type}</span>
                    <span className="text-xs text-slate-500">•</span>
                    <span className="text-xs text-slate-400">{item.provider || "internal"}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-white">{item.summary}</h3>
                </div>
                <div className="text-right">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-950/40 text-emerald-300 border border-emerald-800/40">
                    {item.status}
                  </span>
                  <div className="text-[10px] text-slate-500 mt-1">
                    {new Date(item.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

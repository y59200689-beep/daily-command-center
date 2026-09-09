"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, RefreshCw, CheckCircle2 } from "lucide-react";
import "./chief-of-staff.css";

interface EscalationItem {
  id: string;
  title: string;
  reason: string;
  severity: string;
  created_at: string;
  status: string;
}

export function ActionEscalationsView() {
  const [escalations, setEscalations] = useState<EscalationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/chief-of-staff/escalations");
        if (res.ok) {
          const json = await res.json();
          if (active) setEscalations(json.escalations ?? []);
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
            <AlertTriangle className="w-5 h-5 text-rose-400" /> Operational Escalations
          </h1>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading escalations...</div>
      ) : escalations.length === 0 ? (
        <div className="p-8 rounded-xl bg-slate-900/40 border border-slate-800 text-center text-slate-400">
          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">No Active Escalations</h3>
          <p className="text-xs text-slate-400 mt-1">Operational blocks and critical execution bottlenecks will be surfaced here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {escalations.map((esc) => (
            <div key={esc.id} className="p-4 rounded-xl bg-rose-950/20 border border-rose-800/30 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-rose-400 uppercase">{esc.severity}</span>
                  <span className="text-xs text-slate-500">•</span>
                  <span className="text-xs text-slate-400">{esc.status}</span>
                </div>
                <h3 className="text-sm font-semibold text-white">{esc.title}</h3>
                <p className="text-xs text-slate-300 mt-1">{esc.reason}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

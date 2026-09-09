"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Zap, ArrowLeft, RefreshCw, Sparkles } from "lucide-react";
import "./chief-of-staff.css";

interface AutomationOppItem {
  name: string;
  action_type: string;
  occurrenceCount: number;
  safetyClass: string;
  recommendation: string;
}

export function AutomationOpportunitiesView() {
  const [opportunities, setOpportunities] = useState<AutomationOppItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/chief-of-staff/opportunities");
        if (res.ok) {
          const json = await res.json();
          if (active) setOpportunities(json.opportunities ?? []);
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
            <Zap className="w-5 h-5 text-amber-400" /> Recommended Automations
          </h1>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" /> Detecting patterns...</div>
      ) : opportunities.length === 0 ? (
        <div className="p-8 rounded-xl bg-slate-900/40 border border-slate-800 text-center text-slate-400">
          <Sparkles className="w-8 h-8 mx-auto mb-2 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white">No Repeated Manual Patterns Yet</h3>
          <p className="text-xs text-slate-400 mt-1">When an internal action routine is repeated multiple times, Chief of Staff will recommend turning it into an automated schedule.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {opportunities.map((opp, idx) => (
            <div key={idx} className="chief-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`chief-badge chief-badge-${opp.safetyClass || "safe"}`}>
                      {opp.safetyClass || "safe_internal"}
                    </span>
                    <span className="text-xs text-slate-500">Repeated {opp.occurrenceCount}x</span>
                  </div>
                  <h3 className="text-sm font-semibold text-white">{opp.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{opp.recommendation}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

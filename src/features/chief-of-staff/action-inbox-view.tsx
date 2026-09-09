"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Inbox, ArrowLeft, RefreshCw, Sparkles } from "lucide-react";
import "./chief-of-staff.css";

interface ProposalItem {
  id: string;
  title: string;
  reason?: string;
  source_domain: string;
  risk_level: string;
  action_type: string;
  status: string;
  created_at: string;
}

export function ActionInboxView() {
  const [proposals, setProposals] = useState<ProposalItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/chief-of-staff/proposals");
        if (res.ok) {
          const json = await res.json();
          if (active) setProposals(json.proposals ?? []);
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
            <Inbox className="w-5 h-5 text-indigo-400" /> Action Proposals Inbox
          </h1>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading proposals...</div>
      ) : proposals.length === 0 ? (
        <div className="p-8 rounded-xl bg-slate-900/40 border border-slate-800 text-center text-slate-400">
          <Sparkles className="w-8 h-8 mx-auto mb-2 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white">Inbox Clean</h3>
          <p className="text-xs text-slate-400 mt-1">No action proposals currently waiting for staging or review.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {proposals.map((prop) => (
            <div key={prop.id} className="chief-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`chief-badge chief-badge-${prop.risk_level}`}>{prop.risk_level}</span>
                    <span className="text-xs font-medium text-slate-400 uppercase">{prop.source_domain}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-white">{prop.title}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{prop.reason}</p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                  {prop.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

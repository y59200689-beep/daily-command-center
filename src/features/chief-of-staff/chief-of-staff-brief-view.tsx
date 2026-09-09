"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { FileText, ArrowLeft, RefreshCw, ShieldCheck } from "lucide-react";
import "./chief-of-staff.css";

interface ChiefBriefData {
  nextAction?: {
    title: string;
    whyNow: string;
    readiness: string;
    route: string;
  };
  metrics?: {
    pendingApprovalsCount?: number;
    activePlansCount?: number;
    recentExecutionsCount?: number;
    failedExecutionsCount?: number;
  };
  topMetrics?: Record<string, number | undefined>;
  preparedActions?: Array<{ id: string; title: string; risk_level: string }>;
  providerStatus?: {
    gmail?: boolean;
    googleCalendar?: boolean;
    github?: boolean;
  };
}

export function ChiefOfStaffBriefView() {
  const [data, setData] = useState<ChiefBriefData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/chief-of-staff/overview");
        if (res.ok) {
          const json = await res.json();
          if (active) setData(json);
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

  if (loading) {
    return <div className="chief-container py-12 text-center text-slate-400"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading memo...</div>;
  }

  const metrics = data?.topMetrics ?? {};

  return (
    <div className="chief-container">
      <div className="flex items-center gap-3">
        <Link href="/chief-of-staff" className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-400" /> Daily Chief of Staff Brief
        </h1>
      </div>

      <div className="chief-card space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
          <ShieldCheck className="w-4 h-4 text-indigo-400" />
          <span>DATE: {new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <h2 className="text-base font-semibold text-white mb-2">Executive Operations Status</h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            {(metrics.awaitingApprovalCount ?? 0) > 0
              ? `${metrics.awaitingApprovalCount} action${metrics.awaitingApprovalCount === 1 ? " is" : "s are"} prepared and awaiting your explicit review.`
              : "No actions currently require approval."}{" "}
            {(metrics.failedCount ?? 0) > 0
              ? `${metrics.failedCount} execution failed and needs attention.`
              : "No failed executions reported."}{" "}
            {(metrics.recentlyCompletedCount ?? 0) > 0
              ? `${metrics.recentlyCompletedCount} action${metrics.recentlyCompletedCount === 1 ? " was" : "s were"} executed and verified.`
              : "No executions recorded yet today."}
          </p>
        </div>

        {data?.nextAction && (
          <div className="p-3.5 rounded-lg bg-indigo-950/20 border border-indigo-500/30 text-xs">
            <span className="font-bold text-indigo-300 uppercase block mb-1">Recommended Priority</span>
            <span className="text-white font-medium">{data.nextAction.title}</span>
            <p className="text-slate-400 mt-0.5">{data.nextAction.whyNow}</p>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import "./executive.css";

type ReportEntry = {
  id: string;
  title: string;
  type: "daily_brief" | "weekly" | "monthly" | "quarterly" | "custom";
  scope: "business" | "personal" | "combined";
  summary: string;
  generatedAt: string;
  route: string;
};

const TYPE_LABEL: Record<string, string> = {
  daily_brief: "Daily Brief",
  weekly: "Weekly Review",
  monthly: "Monthly Review",
  quarterly: "Quarterly Review",
  custom: "Custom Report",
};

const TYPE_COLOR: Record<string, string> = {
  daily_brief: "text-blue-400",
  weekly: "text-purple-400",
  monthly: "text-amber-400",
  quarterly: "text-green-400",
  custom: "text-slate-400",
};

export function ExecutiveReportsView() {
  const [reports, setReports] = useState<ReportEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("all");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/executive/reports");
        if (!res.ok) throw new Error("Failed.");
        const json = await res.json();
        if (active) setReports(json.reports ?? []);
      } catch {
        if (active) setReports([]);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  const filtered = typeFilter === "all" ? reports : reports.filter((r) => r.type === typeFilter);

  return (
    <div className="executive-surface">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Reports Hub</h1>
          <p className="text-sm text-slate-400">Executive briefings, reviews, and structured reports</p>
        </div>
        <Link href="/executive" className="text-sm text-blue-400 hover:underline">← Executive Center</Link>
      </div>

      {/* Quick access to fresh brief */}
      <div className="executive-memo-card mb-8">
        <div className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-3">Quick Access</div>
        <div className="flex flex-wrap gap-3">
          <Link href="/executive/brief/daily" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors">
            Open Today&apos;s Daily Brief
          </Link>
          <Link href="/review/weekly" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-lg transition-colors">
            Weekly Review
          </Link>
          <Link href="/review/monthly" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-lg transition-colors">
            Monthly Review
          </Link>
          <Link href="/review/quarterly" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-lg transition-colors">
            Quarterly Review
          </Link>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
        {["all", "daily_brief", "weekly", "monthly", "quarterly", "custom"].map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              typeFilter === t ? "bg-blue-600 text-white" : "bg-slate-900 text-slate-400 hover:text-white"
            }`}
          >
            {t === "all" ? "ALL" : TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-400">Loading reports...</div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center text-slate-400 bg-slate-900/40 border border-slate-800 rounded-lg">
          No reports found. Daily briefs are generated automatically each day.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold uppercase ${TYPE_COLOR[r.type]}`}>
                    {TYPE_LABEL[r.type]}
                  </span>
                  <span className="executive-badge executive-badge-domain">{r.scope}</span>
                </div>
                <span className="text-xs text-slate-500">{new Date(r.generatedAt).toLocaleDateString()}</span>
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">{r.title}</h3>
              <p className="text-xs text-slate-400 mb-3">{r.summary}</p>
              <Link href={r.route} className="text-xs text-blue-400 hover:underline font-semibold">
                Open Report →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

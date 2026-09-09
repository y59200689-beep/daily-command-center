"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import "./executive.css";
import type { ExecutiveChange } from "@/lib/executive";

export function ExecutiveChangesView() {
  const [changes, setChanges] = useState<ExecutiveChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/executive/changes");
        if (!res.ok) throw new Error("Failed to load changes.");
        const json = await res.json();
        if (active) setChanges(json.changes ?? []);
      } catch {
        if (active) setChanges([]);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const filtered = filter === "all" ? changes : changes.filter((c) => c.domain === filter);

  return (
    <div className="executive-surface">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">What Changed</h1>
          <p className="text-sm text-slate-400">Material changes across business domains since last snapshot</p>
        </div>
        <Link href="/executive" className="text-sm text-blue-400 hover:underline">
          ← Back to Executive Command Center
        </Link>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
        {["all", "finance", "growth", "success", "commerce", "operations", "team", "strategy"].map((d) => (
          <button
            key={d}
            onClick={() => setFilter(d)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              filter === d ? "bg-blue-600 text-white" : "bg-slate-900 text-slate-400 hover:text-white"
            }`}
          >
            {d.toUpperCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-400">Loading changes...</div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center text-slate-400 bg-slate-900/40 border border-slate-800 rounded-lg">
          No material changes recorded for this filter.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <div key={c.id} className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="executive-badge executive-badge-domain">{c.domain}</span>
                  <span className="text-xs font-semibold text-amber-400 uppercase">{c.type}</span>
                  <span className="text-xs text-slate-500">· {c.materiality} materiality</span>
                </div>
                <span className="text-xs text-slate-500">{new Date(c.timestamp).toLocaleDateString()}</span>
              </div>
              <h3 className="text-base font-semibold text-white mb-1">{c.title}</h3>
              <p className="text-sm text-slate-300">{c.reason}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

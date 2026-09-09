"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import "./executive.css";

type Assumption = {
  id: string;
  domain: string;
  statement: string;
  status: "holding" | "cracked" | "invalidated" | "unverified";
  evidence: string;
  addedAt: string;
  reviewedAt?: string;
  route: string;
};

const STATUS_BADGES: Record<string, string> = {
  holding: "bg-green-950/50 text-green-300 border-green-800/50",
  cracked: "bg-amber-950/50 text-amber-300 border-amber-800/50",
  invalidated: "bg-red-950/50 text-red-300 border-red-800/50",
  unverified: "bg-slate-800/50 text-slate-400 border-slate-700",
};

export function ExecutiveAssumptionsView() {
  const [assumptions, setAssumptions] = useState<Assumption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/executive/assumptions");
        if (!res.ok) throw new Error("Failed.");
        const json = await res.json();
        if (active) setAssumptions(json.assumptions ?? []);
      } catch {
        if (active) setAssumptions([]);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  const filtered = filter === "all" ? assumptions : assumptions.filter((a) => a.status === filter);

  return (
    <div className="executive-surface">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Live Assumptions Register</h1>
          <p className="text-sm text-slate-400">Key assumptions underpinning strategy — tracked against real data</p>
        </div>
        <Link href="/executive" className="text-sm text-blue-400 hover:underline">← Executive Center</Link>
      </div>

      {/* Stats Bar */}
      {!loading && assumptions.length > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          {(["holding", "cracked", "invalidated", "unverified"] as const).map((s) => {
            const count = assumptions.filter((a) => a.status === s).length;
            return (
              <button
                key={s}
                onClick={() => setFilter(filter === s ? "all" : s)}
                className={`p-3 border rounded-lg text-center transition-all ${
                  filter === s ? "ring-2 ring-blue-500" : ""
                } ${STATUS_BADGES[s]}`}
              >
                <div className="text-xl font-bold">{count}</div>
                <div className="text-xs capitalize mt-0.5">{s}</div>
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-slate-400">Loading assumptions...</div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center text-slate-400 bg-slate-900/40 border border-slate-800 rounded-lg">
          {filter === "all" ? "No assumptions logged yet." : `No ${filter} assumptions.`}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <div key={a.id} className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="executive-badge executive-badge-domain">{a.domain}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 border rounded-full ${STATUS_BADGES[a.status]}`}>
                    {a.status.toUpperCase()}
                  </span>
                </div>
                <div className="text-xs text-slate-500">{new Date(a.addedAt).toLocaleDateString()}</div>
              </div>
              <p className="text-sm font-medium text-white mb-2">&ldquo;{a.statement}&rdquo;</p>
              <p className="text-xs text-slate-400 mb-3">{a.evidence}</p>
              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                {a.reviewedAt && (
                  <span className="text-xs text-slate-500">
                    Last reviewed: {new Date(a.reviewedAt).toLocaleDateString()}
                  </span>
                )}
                <Link href={a.route} className="text-xs text-blue-400 hover:underline font-semibold ml-auto">
                  Open Domain →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

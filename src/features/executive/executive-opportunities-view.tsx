"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import "./executive.css";
import type { OpportunityCluster } from "@/lib/executive";

export function ExecutiveOpportunitiesView() {
  const [opportunities, setOpportunities] = useState<OpportunityCluster[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/executive/opportunities");
        if (!res.ok) throw new Error("Failed to load opportunities.");
        const json = await res.json();
        if (active) setOpportunities(json.opportunities ?? []);
      } catch {
        if (active) setOpportunities([]);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="executive-surface">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Executive Opportunities</h1>
          <p className="text-sm text-slate-400">Grounded growth, expansion, and efficiency opportunities across domains</p>
        </div>
        <Link href="/executive" className="text-sm text-blue-400 hover:underline">
          ← Back to Executive Command Center
        </Link>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-400">Loading opportunities...</div>
      ) : opportunities.length === 0 ? (
        <div className="p-8 text-center text-slate-400 bg-slate-900/40 border border-slate-800 rounded-lg">
          No immediate opportunity clusters surfaced.
        </div>
      ) : (
        <div className="space-y-4">
          {opportunities.map((opp) => (
            <div key={opp.id} className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="executive-badge executive-badge-ready">Opportunity</span>
                  {opp.domains.map((d) => (
                    <span key={d} className="executive-badge executive-badge-domain">{d}</span>
                  ))}
                </div>
                <Link href={opp.route} className="text-xs font-semibold text-blue-400 hover:underline">
                  Explore →
                </Link>
              </div>
              <h3 className="text-base font-semibold text-white mb-1">{opp.name}</h3>
              <p className="text-sm text-slate-300 mb-2">{opp.summary}</p>
              <div className="text-xs text-slate-400">Next Action: {opp.nextAction}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ListOrdered, ArrowLeft, RefreshCw } from "lucide-react";
import "./chief-of-staff.css";

interface PlanItem {
  id: string;
  title: string;
  description?: string;
  status: string;
  created_at: string;
}

export function ActionPlansView() {
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/chief-of-staff/plans");
        if (res.ok) {
          const json = await res.json();
          if (active) setPlans(json.plans ?? []);
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
            <ListOrdered className="w-5 h-5 text-indigo-400" /> Multi-Step Action Plans
          </h1>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading plans...</div>
      ) : plans.length === 0 ? (
        <div className="p-8 rounded-xl bg-slate-900/40 border border-slate-800 text-center text-slate-400">
          <ListOrdered className="w-8 h-8 mx-auto mb-2 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white">No Action Plans Active</h3>
          <p className="text-xs text-slate-400 mt-1">Multi-step action sequences will appear here when instantiated from templates or proposed by executive recommendations.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
            <Link key={plan.id} href={`/chief-of-staff/plans/${plan.id}`} className="chief-card block hover:border-indigo-500/50">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">{plan.title}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{plan.description || "Structured sequence of dependent actions."}</p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                  {plan.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

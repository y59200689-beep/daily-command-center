"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import "./chief-of-staff.css";

interface PlanStep {
  id: string;
  title: string;
  action_type: string;
  risk_level?: string;
  status: string;
}

interface PlanDetail {
  id: string;
  title: string;
  description?: string;
  status: string;
  steps?: PlanStep[];
}

export function ActionPlanDetailView({ planId }: { planId: string }) {
  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch(`/api/chief-of-staff/plans/${planId}`);
        if (res.ok) {
          const json = await res.json();
          if (active) setPlan(json.plan ?? null);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [planId]);

  if (loading) {
    return <div className="chief-container py-12 text-center text-slate-400"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading plan details...</div>;
  }

  if (!plan) {
    return (
      <div className="chief-container py-12 text-center text-slate-400">
        <p>Plan not found or inaccessible.</p>
        <Link href="/chief-of-staff/plans" className="text-xs text-indigo-400 mt-2 inline-block">← Back to plans</Link>
      </div>
    );
  }

  const steps = plan.steps ?? [];

  return (
    <div className="chief-container">
      <div className="flex items-center gap-3">
        <Link href="/chief-of-staff/plans" className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">{plan.title}</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">{plan.status}</span>
          </div>
          <p className="text-xs text-slate-400">{plan.description}</p>
        </div>
      </div>

      <div className="space-y-3 mt-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Sequential Execution Steps ({steps.length})</h2>
        <div className="space-y-2">
          {steps.map((step: PlanStep, idx: number) => (
            <div key={step.id || idx} className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-indigo-950/60 border border-indigo-700/50 flex items-center justify-center text-xs font-bold text-indigo-300">
                {idx + 1}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="text-sm font-semibold text-white">{step.title}</h3>
                  <span className={`chief-badge chief-badge-${step.risk_level || "low"}`}>{step.risk_level || "low"}</span>
                  <span className="text-[10px] text-slate-500">{step.status}</span>
                </div>
                <p className="text-xs text-slate-400">Action: {step.action_type}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

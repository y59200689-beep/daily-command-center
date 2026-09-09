"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { CheckSquare, ArrowLeft, RefreshCw, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import "./chief-of-staff.css";

interface ReviewApprovalItem {
  id: string;
  status: string;
}

interface ReviewExecutionItem {
  id: string;
  status: string;
}

interface ReviewData {
  approvals?: ReviewApprovalItem[];
  executions?: ReviewExecutionItem[];
}

export function ChiefOfStaffReviewView() {
  const [data, setData] = useState<ReviewData | null>(null);
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
    return <div className="chief-container py-12 text-center text-slate-400"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading review...</div>;
  }

  const pending = (data?.approvals ?? []).filter((a: ReviewApprovalItem) => a.status === "pending");
  const failed = (data?.executions ?? []).filter((e: ReviewExecutionItem) => e.status === "failed");
  const completed = (data?.executions ?? []).filter((e: ReviewExecutionItem) => e.status === "verified" || e.status === "executed");

  return (
    <div className="chief-container">
      <div className="flex items-center gap-3">
        <Link href="/chief-of-staff" className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-indigo-400" /> Action Orchestration Review
        </h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="chief-card">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase">
            <Clock className="w-4 h-4" /> Awaiting Approval
          </div>
          <div className="text-2xl font-bold text-white mt-1">{pending.length}</div>
        </div>

        <div className="chief-card">
          <div className="flex items-center gap-2 text-xs font-semibold text-rose-400 uppercase">
            <AlertTriangle className="w-4 h-4" /> Failed / Retry
          </div>
          <div className="text-2xl font-bold text-white mt-1">{failed.length}</div>
        </div>

        <div className="chief-card">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase">
            <CheckCircle2 className="w-4 h-4" /> Completed Today
          </div>
          <div className="text-2xl font-bold text-white mt-1">{completed.length}</div>
        </div>
      </div>
    </div>
  );
}

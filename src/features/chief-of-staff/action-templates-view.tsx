"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Copy, ArrowLeft, RefreshCw, Layers } from "lucide-react";
import "./chief-of-staff.css";

const SYSTEM_TEMPLATES = [
  {
    id: "tpl_client_payment",
    name: "Client Payment Follow-up",
    description: "Verify unpaid invoice balance, prepare polite reminder email draft, and schedule 3-day follow-up check.",
    domain: "finance",
    stepCount: 3,
  },
  {
    id: "tpl_client_renewal",
    name: "Client Renewal Preparation",
    description: "Review client outcome progress, draft renewal review email, and prepare calendar check-in.",
    domain: "success",
    stepCount: 4,
  },
  {
    id: "tpl_supplier_reorder",
    name: "Supplier Reorder Preparation",
    description: "Audit current stock levels, prepare supplier order draft with lead times, and notify owner.",
    domain: "commerce",
    stepCount: 3,
  },
  {
    id: "tpl_incident_followup",
    name: "Operational Incident Follow-up",
    description: "Document incident cause, assign corrective task with SOP link, and schedule post-incident review.",
    domain: "operations",
    stepCount: 3,
  },
  {
    id: "tpl_executive_followthrough",
    name: "Executive Review Follow-through",
    description: "Convert top executive priority into discrete delegated tasks with deadline and outcome metrics.",
    domain: "executive",
    stepCount: 3,
  },
];

export function ActionTemplatesView() {
  const [instantiatingId, setInstantiatingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleInstantiate(id: string) {
    setInstantiatingId(id);
    try {
      const res = await fetch(`/api/chief-of-staff/templates/${id}/instantiate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Instantiate failed.");
      setMessage(`Plan created from template: ${data.plan?.title || "Success"}`);
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Error instantiating template");
    } finally {
      setInstantiatingId(null);
    }
  }

  return (
    <div className="chief-container">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/chief-of-staff" className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" /> Action Templates
          </h1>
        </div>
      </div>

      {message && (
        <div className="p-3 rounded-lg bg-slate-800/80 border border-indigo-500/30 text-xs text-indigo-200 flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      <div className="chief-action-grid">
        {SYSTEM_TEMPLATES.map((tpl) => (
          <div key={tpl.id} className="chief-card">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">{tpl.domain}</span>
                <h3 className="text-sm font-semibold text-white mt-0.5">{tpl.name}</h3>
                <p className="text-xs text-slate-400 mt-1">{tpl.description}</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <span className="text-xs text-slate-500">{tpl.stepCount} ordered steps</span>
              <button
                onClick={() => handleInstantiate(tpl.id)}
                disabled={instantiatingId === tpl.id}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition"
              >
                {instantiatingId === tpl.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
                Use Template
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Sliders, ArrowLeft, ShieldCheck, Check } from "lucide-react";
import "./chief-of-staff.css";

export function ChiefOfStaffSettingsView() {
  const [autonomyLevel, setAutonomyLevel] = useState<number>(1);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/chief-of-staff/settings");
        if (res.ok) {
          const json = await res.json();
          if (active && json.autonomy_level !== undefined) {
            setAutonomyLevel(json.autonomy_level);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  async function handleSave(level: number) {
    setAutonomyLevel(level);
    setSaving(true);
    try {
      const res = await fetch("/api/chief-of-staff/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autonomy_level: level }),
      });
      if (!res.ok) throw new Error("Save failed.");
      setMessage("Autonomy policy saved successfully.");
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
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
            <Sliders className="w-5 h-5 text-indigo-400" /> Chief of Staff Settings
          </h1>
        </div>
        {saving && <span className="text-xs text-indigo-400 animate-pulse">Saving...</span>}
      </div>

      {message && (
        <div className="p-3 rounded-lg bg-slate-800/80 border border-indigo-500/30 text-xs text-indigo-200 flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      <div className="chief-card space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-white">Safe Autonomy Levels</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure how aggressively Chief of Staff prepares and executes internal work. Consequential external actions always require explicit review.
          </p>
        </div>

        <div className="space-y-2">
          {[
            {
              level: 0,
              title: "Level 0: Recommend Only",
              description: "System highlights what can happen, but will not prepare action proposals or draft payloads without manual prompt.",
            },
            {
              level: 1,
              title: "Level 1: Prepare Automatically (Recommended Default)",
              description: "System automatically stages action proposals and drafts (emails, calendar events, reviews). Consequential actions await your explicit review.",
            },
            {
              level: 2,
              title: "Level 2: Execute Safe Internal Actions Automatically",
              description: "System automatically runs safe internal reversible actions (internal tasks, follow-ups, notes). External and financial actions still require explicit approval.",
            },
          ].map((item) => (
            <div
              key={item.level}
              onClick={() => handleSave(item.level)}
              className={`p-4 rounded-xl border cursor-pointer transition ${
                autonomyLevel === item.level
                  ? "bg-indigo-950/40 border-indigo-500/50"
                  : "bg-slate-900/40 border-slate-800 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      autonomyLevel === item.level
                        ? "border-indigo-400 bg-indigo-500 text-white"
                        : "border-slate-600"
                    }`}
                  >
                    {autonomyLevel === item.level && <Check className="w-3 h-3" />}
                  </div>
                  <h3 className="text-sm font-medium text-white">{item.title}</h3>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-1 pl-6">{item.description}</p>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Hard Safety Constraint: Unrestricted Level 3 external autonomy is permanently blocked.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { CalendarDays, FileText, Send, Video } from "lucide-react";
import { Icons } from "@/components/icons";
import { useDeferredEffect } from "@/lib/use-deferred-effect";
import { subscribeToWorkspaceMutations } from "@/lib/workspace-mutations";
import "./mission-card.css";

type MissionProgress = {
  prospects: number; contacted: number; meetings: number; clients: number;
  revenueUsd: number; revenueTargetUsd: number | null;
  prospectsToday: number; outreachToday: number; videoAuditsToday: number;
};
const percent = (value: number, target: number) => Math.min(100, Math.round(value / target * 100));

export function MissionCard() {
  const [data, setData] = useState<MissionProgress | null>(null);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/today/mission", { cache: "no-store" });
      if (!response.ok) throw new Error("Mission progress unavailable");
      setData(await response.json() as MissionProgress);
      setError(false);
    } catch { setError(true); }
  }, []);
  useDeferredEffect(useCallback(() => { void load(); return subscribeToWorkspaceMutations(["clients", "tasks", "finance", "payments"], () => void load()); }, [load]));

  const metrics = [
    { label: "Prospects", value: data?.prospects, target: 300, icon: Icons.Users, tone: "violet", href: "/growth" },
    { label: "Contacted", value: data?.contacted, target: 200, icon: Send, tone: "blue", href: "/growth" },
    { label: "Meetings", value: data?.meetings, target: 10, icon: CalendarDays, tone: "orange", href: "/growth" },
    { label: "Clients", value: data?.clients, target: 1, icon: FileText, tone: "rose", href: "/clients" },
    { label: "Revenue", value: data?.revenueUsd, target: data?.revenueTargetUsd ?? null, icon: Icons.CircleDollarSign, tone: "green", href: "/finance" },
  ];
  const available = Boolean(data?.revenueTargetUsd);
  const progress = data ? Math.round(metrics.filter(metric => metric.target).reduce((sum, metric) => sum + percent(metric.value ?? 0, metric.target!), 0) / (available ? 5 : 4)) : 0;
  const started = data ? metrics.filter(metric => metric.target && (metric.value ?? 0) > 0).length : 0;
  const actions = [
    { label: "15 prospects", count: data?.prospectsToday, target: 15, icon: Icons.Users, href: "/growth" },
    { label: "10 outreach", count: data?.outreachToday, target: 10, icon: Send, href: "/growth" },
    { label: "3 video audits", count: data?.videoAuditsToday, target: 3, icon: Video, href: "/tasks" },
  ];

  return <section className="mission-card" aria-label="Current mission">
    <div className="mission-card__art" aria-hidden="true" />
    <div className="mission-card__content">
      <div className="mission-card__eyebrow"><Icons.Target size={22} aria-hidden="true" /><span>Current mission</span><span className="mission-card__day"><Icons.CalendarDays size={15} aria-hidden="true" />30-day mission</span></div>
      <h2>Phase 1 — First 10K</h2>
      <p className="mission-card__theme">Build the first predictable revenue engine</p>
      <p className="mission-card__description">Get your first client and reach 10,000 MAD through medical centers (radiology).</p>
      <div className="mission-card__quote">“Consistent action creates results.”</div>
      <div className="mission-card__progress-row" title="Progress across the five mission targets"><div className="mission-card__progress" role="progressbar" aria-label="Mission progress" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div><strong>{data ? `${progress}%` : "—"}</strong></div>
      <p className="mission-card__progress-caption">{error ? "Mission progress is temporarily unavailable." : data ? `Overall progress · ${started} of 5 targets underway` : "Loading recorded mission progress…"}</p>
      <div className="mission-card__metrics">{metrics.map(({ label, value, target, icon: Icon, tone, href }) => <Link className={`mission-card__metric mission-card__metric--${tone}`} href={href} key={label} aria-label={`${label}: ${value ?? "loading"} of ${target ?? "target unavailable"}`}><span className="mission-card__metric-top"><span className="mission-card__metric-icon"><Icon size={22} aria-hidden="true" /></span><span className="mission-card__metric-value">{value == null ? "—" : label === "Revenue" ? `$${Math.round(value).toLocaleString()}` : value.toLocaleString()}{target != null && <small> / {label === "Revenue" ? `$${Math.round(target).toLocaleString()}` : target.toLocaleString()}</small>}</span></span><span className="mission-card__metric-label">{label}</span><span className="mission-card__mini-track"><i style={{ width: `${target ? percent(value ?? 0, target) : 0}%` }} /></span></Link>)}</div>
      <div className="mission-card__footer"><div className="mission-card__actions"><h3><Icons.Zap size={18} aria-hidden="true" /> Today’s key actions</h3><div className="mission-card__action-list">{actions.map(({ label, count, target, icon: Icon, href }) => <Link href={href} key={label}><Icon size={21} aria-hidden="true" /><strong>{label}</strong><span>{count ?? "—"} / {target}</span></Link>)}</div></div><Link className="mission-card__open" href="/growth/mission">Open Mission<Icons.ArrowRight size={18} aria-hidden="true" /></Link></div>
    </div>
  </section>;
}

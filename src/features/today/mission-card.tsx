"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Icons } from "@/components/icons";
import { useDeferredEffect } from "@/lib/use-deferred-effect";
import { subscribeToWorkspaceMutations } from "@/lib/workspace-mutations";
import "./mission-card.css";

type Period = { id: string; title: string; status: string; starts_at: string; ends_at: string; theme?: string | null; notes?: string | null };
type Commitment = { id: string; planning_period_id: string; status: string; target_date?: string | null };
type Milestone = { id: string; commitment_id?: string | null; status: string; milestone_date?: string | null };
type MissionData = { period: Period | null; commitments: Commitment[]; milestones: Milestone[] };

function ratio(value: number, total: number) { return total > 0 ? Math.round(value / total * 100) : 0; }
function dateNumber(value: string) { return Date.parse(`${value.slice(0, 10)}T12:00:00Z`); }

export function MissionCard({ today, todayTasks }: { today: string; todayTasks: number }) {
  const [data, setData] = useState<MissionData | null>(null);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    try {
      const responses = await Promise.all(["periods", "commitments", "milestones"].map(resource => fetch(`/api/strategy/${resource}`, { cache: "no-store" })));
      if (responses.some(response => !response.ok)) throw new Error("Mission records unavailable");
      const [periodsResult, commitmentsResult, milestonesResult] = await Promise.all(responses.map(response => response.json())) as [{ records: Period[] }, { records: Commitment[] }, { records: Milestone[] }];
      const period = periodsResult.records.find(item => item.status === "active" && item.starts_at <= today && item.ends_at >= today)
        ?? periodsResult.records.find(item => item.status === "active") ?? null;
      const commitments = commitmentsResult.records.filter(item => item.planning_period_id === period?.id && item.status !== "dropped");
      const commitmentIds = new Set(commitments.map(item => item.id));
      const milestones = milestonesResult.records.filter(item => item.commitment_id && commitmentIds.has(item.commitment_id) && item.status !== "canceled");
      setData({ period, commitments, milestones });
      setError(false);
    } catch {
      setError(true);
    }
  }, [today]);

  useDeferredEffect(useCallback(() => { void load(); return subscribeToWorkspaceMutations(["founder-os", "tasks"], () => void load()); }, [load]));

  const period = data?.period;
  const commitments = data?.commitments ?? [];
  const milestones = data?.milestones ?? [];
  const complete = commitments.filter(item => item.status === "completed").length;
  const onTrack = commitments.filter(item => item.status === "committed" || item.status === "completed").length;
  const atRisk = commitments.filter(item => item.status === "at_risk").length;
  const reached = milestones.filter(item => item.status === "reached").length;
  const progress = ratio(complete, commitments.length);
  const day = period ? Math.max(1, Math.floor((dateNumber(today) - dateNumber(period.starts_at)) / 86400000) + 1) : null;
  const duration = period ? Math.max(1, Math.floor((dateNumber(period.ends_at) - dateNumber(period.starts_at)) / 86400000) + 1) : null;
  const remaining = period ? Math.max(0, Math.ceil((dateNumber(period.ends_at) - dateNumber(today)) / 86400000)) : 0;
  const due = commitments.filter(item => item.target_date === today && item.status !== "completed").length;
  const upcoming = milestones.filter(item => item.status !== "reached" && item.milestone_date && item.milestone_date >= today).length;
  const metrics = [
    { label: "Commitments", value: commitments.length, total: commitments.length, fill: progress, icon: Icons.Users, tone: "violet", href: "/control-tower", detail: `${complete} completed` },
    { label: "On track", value: onTrack, total: commitments.length, fill: ratio(onTrack, commitments.length), icon: Icons.Target, tone: "blue", href: "/control-tower", detail: "Committed or completed" },
    { label: "Milestones", value: reached, total: milestones.length, fill: ratio(reached, milestones.length), icon: Icons.CalendarDays, tone: "orange", href: "/plan/90-days", detail: `${upcoming} upcoming` },
    { label: "Needs attention", value: atRisk, total: commitments.length, fill: ratio(atRisk, commitments.length), icon: Icons.Activity, tone: "rose", href: "/control-tower", detail: "At-risk commitments" },
    { label: "Days remaining", value: remaining, total: duration, fill: duration ? ratio(duration - remaining, duration) : 0, icon: Icons.Clock3, tone: "green", href: "/plan/90-days", detail: period?.ends_at ?? "No active period" },
  ];

  return <section className="mission-card" aria-label="Current mission">
    <div className="mission-card__art" aria-hidden="true" />
    <div className="mission-card__content">
      <div className="mission-card__eyebrow"><Icons.Target size={22} aria-hidden="true" /><span>Current mission</span>{period && <span className="mission-card__day"><Icons.CalendarDays size={15} aria-hidden="true" /> Day {Math.min(day!, duration!)} / {duration}</span>}</div>
      <h2>{error ? "Mission unavailable" : period?.title ?? "Define your current mission"}</h2>
      <p className="mission-card__theme">{period?.theme ?? (period ? "A clear horizon for your most important work." : "Give the next chapter a clear goal and a time frame.")}</p>
      <p className="mission-card__description">{error ? "Your planning records could not be loaded." : period?.notes ?? (period ? "Track the commitments and milestones recorded for this mission." : "Create an active planning period to see real progress here.")}</p>
      <div className="mission-card__progress-row" title={commitments.length ? `${complete} of ${commitments.length} commitments completed` : "Add commitments to track progress"}>
        <div className="mission-card__progress" role="progressbar" aria-label="Mission completion" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div>
        <strong>{commitments.length ? `${progress}%` : "—"}</strong>
      </div>
      <p className="mission-card__progress-caption">{commitments.length ? `${complete} of ${commitments.length} commitments completed · ${onTrack} on track` : "Progress begins when you add commitments to this mission."}</p>
      <div className="mission-card__metrics">{metrics.map(({label,value,total,fill,icon:Icon,tone,href,detail}) => <Link className={`mission-card__metric mission-card__metric--${tone}`} href={href} key={label} title={`${label}: ${detail}`}><span className="mission-card__metric-top"><span className="mission-card__metric-icon"><Icon size={22} aria-hidden="true" /></span><span className="mission-card__metric-value">{period ? value : "—"}{period && total != null && label !== "Days remaining" ? <small> / {total}</small> : null}</span></span><span className="mission-card__metric-label">{label}</span><span className="mission-card__mini-track"><i style={{ width: `${fill}%` }} /></span></Link>)}</div>
      <div className="mission-card__footer"><div className="mission-card__actions"><h3><Icons.Zap size={18} aria-hidden="true" /> Today’s key actions</h3><div className="mission-card__action-list"><Link href="/control-tower"><Icons.Target size={21} aria-hidden="true" /><strong>Commitments due</strong><span>{due}</span></Link><Link href="/plan/90-days"><Icons.CalendarDays size={21} aria-hidden="true" /><strong>Upcoming milestones</strong><span>{upcoming}</span></Link><Link href="/tasks"><Icons.ListTodo size={21} aria-hidden="true" /><strong>Tasks today</strong><span>{todayTasks}</span></Link></div></div><Link className="mission-card__open" href="/control-tower">{period ? "Open mission" : "Create mission"}<Icons.ArrowRight size={18} aria-hidden="true" /></Link></div>
    </div>
  </section>;
}

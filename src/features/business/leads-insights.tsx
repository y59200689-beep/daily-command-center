"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, CalendarDays, CircleDot, GitBranch } from "lucide-react";
import { followUpLabel, type LeadRow } from "@/lib/leads-dashboard";

const stages = ["new", "qualified", "meeting", "proposal", "negotiation", "won", "lost"] as const;
const stageNames: Record<(typeof stages)[number], string> = { new: "New", qualified: "Qualified", meeting: "Meeting", proposal: "Proposal", negotiation: "Negotiation", won: "Won", lost: "Lost" };
type QueueTab = "today" | "overdue" | "week" | "stale";
const queueLabels: Record<QueueTab, string> = { today: "Due today", overdue: "Overdue", week: "This week", stale: "Stale" };
const day = (value: unknown) => value ? new Date(String(value)).toLocaleDateString("en", { month: "short", day: "numeric" }) : "—";

export function LeadsInsights({ leads, opportunities, onSelectLead, onStageSelect }: {
  leads: LeadRow[]; opportunities: LeadRow[]; onSelectLead: (lead: LeadRow) => void; onStageSelect: (stage: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<QueueTab>("today");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7);
  const staleStart = new Date(today); staleStart.setDate(today.getDate() - 7);
  const open = leads.filter(row => !["converted", "lost", "unqualified"].includes(String(row.status)));
  const buckets: Record<QueueTab, LeadRow[]> = {
    today: open.filter(row => row.next_follow_up_at && new Date(String(row.next_follow_up_at)) >= today && new Date(String(row.next_follow_up_at)) < tomorrow),
    overdue: open.filter(row => row.next_follow_up_at && new Date(String(row.next_follow_up_at)) < today),
    week: open.filter(row => row.next_follow_up_at && new Date(String(row.next_follow_up_at)) >= tomorrow && new Date(String(row.next_follow_up_at)) < weekEnd),
    stale: open.filter(row => row.last_contact_at && new Date(String(row.last_contact_at)) < staleStart),
  };
  const stageRows = stages.map(stage => {
    const rows = opportunities.filter(row => row.stage === stage);
    const usd = rows.filter(row => row.currency === "USD").reduce((sum, row) => sum + Number(row.estimated_value || 0), 0);
    return { stage, count: rows.length, usd };
  });
  return <div className="leads-insights">
    <section className="leads-insights__card" aria-label="Follow-up Queue">
      <header><h2><CalendarDays size={17}/>Follow-up Queue</h2><button onClick={() => setActiveTab("week")}>View this week <ArrowRight size={14}/></button></header>
      <div className="leads-insights__tabs" role="tablist" aria-label="Follow-up queue period">{(Object.keys(queueLabels) as QueueTab[]).map(tab => <button key={tab} role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)}>{queueLabels[tab]} <span>{buckets[tab].length}</span></button>)}</div>
      <div className="leads-insights__queue">{buckets[activeTab].length ? buckets[activeTab].slice(0, 4).map(row => {
        const action = opportunities.find(item => item.lead_id === row.id)?.next_action;
        return <button key={row.id} onClick={() => onSelectLead(row)}><span className="leads-insights__avatar">{String(row.company || row.name).slice(0, 2).toUpperCase()}</span><span className="leads-insights__queue-name"><strong>{String(row.company || row.name)}</strong><small>{String(row.name)}</small></span><span className="leads-insights__queue-action">{String(action || "Follow up")}</span><span className="leads-insights__queue-due">{activeTab === "stale" ? day(row.last_contact_at) : followUpLabel(row.next_follow_up_at)}</span></button>;
      }) : <p className="leads-insights__empty">No leads in {queueLabels[activeTab].toLowerCase()}.</p>}</div>
    </section>
    <section className="leads-insights__card" aria-label="Pipeline Overview">
      <header><h2><GitBranch size={17}/>Pipeline Overview</h2><Link href="/pipeline">View pipeline <ArrowRight size={14}/></Link></header>
      <div className="leads-insights__pipeline">{stageRows.map(({ stage, count, usd }) => <button key={stage} onClick={() => onStageSelect(stage)} aria-label={`Show ${count} ${stageNames[stage].toLowerCase()} opportunities`}><span className={`leads-insights__stage leads-insights__stage--${stage}`}><CircleDot size={14}/>{stageNames[stage]}</span><strong>{count}</strong><small>{new Intl.NumberFormat("en", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(usd)}</small></button>)}</div>
      <p className="leads-insights__footnote">Values include opportunities recorded in USD. Select a stage to filter the leads above.</p>
    </section>
  </div>;
}

"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, BarChart3, CalendarDays, Check, ChevronRight, Circle, FileText, Filter, Mail, MoreHorizontal, Percent, Phone, Plus, RotateCcw, Settings2, Target, Trophy, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useDeferredEffect } from "@/lib/use-deferred-effect";
import { businessSummary, commercialPeriodRows, commercialState, forecastSeries, isOpenOpportunity, pipelineStages, recordCurrency, type BusinessOverviewData, type BusinessRecord } from "@/lib/business-dashboard";
import { type ForecastHorizon } from "@/lib/business";
import { ReactivationCandidates } from "./reactivation-candidates";
import "./business-dashboard.css";

type Resource = "leads" | "opportunities" | "proposals" | "services";
type Props = {
  records: Record<string, BusinessRecord[]>;
  overview: BusinessOverviewData | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
  onOpen: (resource: Resource, record?: BusinessRecord) => void;
  onAction: (row: BusinessRecord, completed: boolean) => Promise<void>;
};
const money = (value: unknown, currency: string) => `${currency==='USD'?'$':currency} ${new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(Number(value ?? 0))}`;
const shortValue = (value: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
const periodNames = { this_month: "this month", next_month: "next month", quarter: "this quarter" };

function PanelHeader({ icon, title, subtitle, children }: { icon: ReactNode; title: string; subtitle: string; children?: ReactNode }) {
  return <header className="business-dashboard__panel-header"><span className="business-dashboard__icon">{icon}</span><div><h2>{title}</h2><p>{subtitle}</p></div>{children}</header>;
}

export function BusinessDashboard({ records, overview, loading, error, onRetry, onOpen, onAction }: Props) {
  const [currency, setCurrency] = useState("USD");
  const [pipelineMetric, setPipelineMetric] = useState<"total" | "weighted" | "count">("total");
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [period, setPeriod] = useState<"this_month" | "quarter" | "all">("this_month");
  const [horizon, setHorizon] = useState<ForecastHorizon>("this_month");
  const [forecastResponse, setForecastResponse] = useState<BusinessOverviewData | null>(null);
  const [forecastBusy, setForecastBusy] = useState(false);
  const [forecastError, setForecastError] = useState("");
  const [forecastRetry, setForecastRetry] = useState(0);
  const [showCommitted, setShowCommitted] = useState(true);
  const [showPotential, setShowPotential] = useState(true);
  const [showAllActions, setShowAllActions] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [actionError, setActionError] = useState("");
  const [completedAction, setCompletedAction] = useState<BusinessRecord | null>(null);
  const [detail, setDetail] = useState<"leads" | "active" | "weighted" | "committed" | "pending" | "negotiation" | "won" | null>(null);
  const opportunities = records.opportunities ?? [];
  const proposals = records.proposals ?? [];
  const currencies = useMemo(() => Array.from(new Set(["USD", ...Object.values(records).flat().filter(row => row.currency).map(recordCurrency), ...Object.keys(overview?.forecast.currencies ?? {})])).sort(), [records, overview]);
  const summary = businessSummary(records, currency);
  const stages = pipelineStages(opportunities, currency, pipelineMetric);
  const state = commercialState(opportunities.filter(row => recordCurrency(row) === currency), proposals.filter(row => recordCurrency(row) === currency), period);
  const selected = stages.find(stage => stage.id === selectedStage);
  const actions = opportunities.filter(row => isOpenOpportunity(row) && row.next_action).sort((a, b) => String(a.next_action_date ?? "9999").localeCompare(String(b.next_action_date ?? "9999")));
  const displayedActions = showAllActions ? actions : actions.slice(0, 4);
  const forecast = horizon === "this_month" ? overview : forecastResponse?.horizon === horizon ? forecastResponse : null;
  const series = forecastSeries(forecast?.opportunities ?? opportunities, forecast?.proposals ?? proposals, currency, horizon);
  const forecastValues = forecast?.forecast.currencies[currency];
  const forecastTotal = series.committed + series.potential;
  const hasRecords = Object.values(records).some(rows => rows.length);
  const details = detail === "leads" ? summary.leads : detail === "pending" ? commercialPeriodRows(proposals, period).filter(row => row.status === "sent" && recordCurrency(row) === currency) : detail === "committed" ? proposals.filter(row => row.status === "accepted" && recordCurrency(row) === currency) : (detail === "won" || detail === "negotiation") ? commercialPeriodRows(opportunities, period).filter(row => row.stage === detail && recordCurrency(row) === currency) : summary.active.filter(row => detail !== "weighted" || recordCurrency(row) === currency);
  const detailResource = detail === "leads" ? "leads" : (detail === "committed" || detail === "pending") ? "proposals" : "opportunities";
  const detailTitles = { negotiation: "Opportunities in negotiation", won: "Opportunities won", pending: "Proposals awaiting a decision", leads: "Open leads", active: "Active opportunities", weighted: `Weighted pipeline · ${currency==='USD'?'$':currency}`, committed: `Committed proposals · ${currency==='USD'?'$':currency}` };

  useDeferredEffect(useCallback(() => {
    // Refetch the selected horizon when source data changes or Retry is requested.
    void forecastRetry; void overview;
    if (horizon === "this_month") { setForecastBusy(false); return; }
    const controller = new AbortController();
    setForecastBusy(true); setForecastError("");
    void fetch(`/api/business/overview?horizon=${horizon}`, { cache: "no-store", signal: controller.signal }).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      if (!controller.signal.aborted) setForecastResponse(body);
    }).catch(reason => {
      if (!controller.signal.aborted) setForecastError(reason instanceof Error ? reason.message : "The forecast could not be loaded.");
    }).finally(() => { if (!controller.signal.aborted) setForecastBusy(false); });
    return () => controller.abort();
  }, [horizon, forecastRetry, overview]));

  async function completeAction(row: BusinessRecord, complete = true) {
    setBusyAction(row.id); setActionError("");
    try { await onAction(row, complete); setCompletedAction(complete ? row : null); }
    catch (reason) { setActionError(reason instanceof Error ? reason.message : "The sales action could not be saved."); }
    finally { setBusyAction(""); }
  }

  function actionDate(row: BusinessRecord) {
    if (!row.next_action_date) return { text: "No date", tone: "neutral" };
    const date = new Date(`${String(row.next_action_date)}T12:00:00`);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const after = new Date(tomorrow); after.setDate(after.getDate() + 1);
    if (date < today) return { text: date.toLocaleDateString("en", { month: "short", day: "numeric" }), tone: "overdue" };
    if (date < tomorrow) return { text: "Today", tone: "today" };
    if (date < after) return { text: "Tomorrow", tone: "upcoming" };
    return { text: date.toLocaleDateString("en", { month: "short", day: "numeric" }), tone: "upcoming" };
  }

  return <div className="business-dashboard" aria-busy={loading}>
    <header className="business-dashboard__header">
      <div><nav aria-label="Breadcrumb"><span>Business</span><span>/</span><span>Overview</span></nav><h1>Business</h1><p>A calm view of demand, commitments, and the margin underneath the work.</p></div>
      <nav className="business-dashboard__nav" aria-label="Business workspaces"><Link className="is-primary" href="/leads">Leads</Link><Link href="/pipeline">Pipeline</Link><Link href="/proposals">Proposals</Link><Link href="/services">Services</Link></nav>
    </header>
    {error ? <div className="business-dashboard__error" role="alert"><span>{error}</span><Button emphasis="outline" onClick={onRetry}>Try again</Button></div> : null}

    <section className="business-dashboard__metrics" aria-label="Business summary">
      <Metric label="Open leads" value={summary.leads.length} icon={<Users/>} tone="violet" detail="Ready for the next conversation" rows={summary.leads} onClick={() => setDetail("leads")} loading={loading}/>
      <Metric label="Active opportunities" value={summary.active.length} icon={<Target/>} tone="green" detail="Open opportunities in your pipeline" rows={summary.active} onClick={() => setDetail("active")} loading={loading}/>
      <Metric label="Weighted pipeline" value={money(summary.weighted, currency)} icon={<BarChart3/>} tone="orange" detail="Value adjusted by win probability" rows={summary.active.filter(row => recordCurrency(row) === currency)} onClick={() => setDetail("weighted")} loading={loading}/>
      <Metric label="Committed proposals" value={money(summary.committed, currency)} icon={<FileText/>} tone="blue" detail="Accepted commercial commitments" rows={proposals.filter(row => row.status === "accepted" && recordCurrency(row) === currency)} onClick={() => setDetail("committed")} loading={loading}/>
    </section>
    <div className="business-dashboard__main-grid">
      <section className="business-dashboard__panel business-dashboard__pipeline">
        <PanelHeader icon={<Filter/>} title="Sales pipeline" subtitle={`Opportunities by stage · ${currency==='USD'?'$':currency}`}>
          <label className="business-dashboard__select"><span className="sr-only">Pipeline measurement</span><select value={pipelineMetric} onChange={event => setPipelineMetric(event.target.value as typeof pipelineMetric)}><option value="total">Total value ({currency})</option><option value="weighted">Weighted value ({currency})</option><option value="count">Opportunity count</option></select></label>
        </PanelHeader>
        <div className="business-dashboard__stages" aria-label="Pipeline stages">{stages.map((stage, index) => <button className={`business-dashboard__stage stage-${index} ${selectedStage === stage.id ? "is-selected" : ""}`} key={stage.id} disabled={loading} aria-expanded={selectedStage === stage.id} aria-controls="business-stage-details" onClick={() => setSelectedStage(current => current === stage.id ? null : stage.id)}><span>{stage.label}</span><strong>{loading ? "—" : stage.count}</strong><span className="business-dashboard__stage-segment"/><b>{pipelineMetric === "count" ? `${stage.value} opportunities` : money(stage.value, currency)}</b><small>{stage.percent}%</small></button>)}</div>
        {selected ? <div id="business-stage-details" className="business-dashboard__stage-details"><div><strong>{selected.label} opportunities</strong><Button emphasis="ghost" onClick={() => setSelectedStage(null)}>Close</Button></div>{selected.rows.length ? <ul>{selected.rows.map(row => <li key={row.id}><button onClick={() => onOpen("opportunities", row)}><span>{String(row.title)}</span><b>{money(row.estimated_value, currency)}</b><ChevronRight size={16}/></button></li>)}</ul> : <p>No opportunities in this stage yet. <button onClick={() => onOpen("opportunities")}>Add an opportunity <ArrowRight size={14}/></button></p>}</div> : <div id="business-stage-details" className="business-dashboard__pipeline-footnote">{loading ? "Reading your pipeline…" : opportunities.length ? "Select a stage to explore its opportunities." : <><span>Your next opportunity starts with a conversation.</span><button onClick={() => onOpen("opportunities")}><Plus size={14}/> Add opportunity</button></>}</div>}
      </section>
      <section className="business-dashboard__panel business-dashboard__commercial">
        <PanelHeader icon={<BarChart3/>} title="Commercial state" subtitle="Key numbers and conversion health."><label className="business-dashboard__select"><span className="sr-only">Commercial reporting period</span><select value={period} onChange={event => setPeriod(event.target.value as typeof period)}><option value="this_month">This month</option><option value="quarter">This quarter</option><option value="all">All time</option></select></label></PanelHeader>
        <div className="business-dashboard__commercial-body"><div className="business-dashboard__state-list">
          <StateRow icon={<FileText/>} tone="violet" value={state.pending} label="Proposals awaiting a decision" onClick={() => setDetail("pending")}/>
          <StateRow icon={<Target/>} tone="orange" value={state.negotiation} label="Opportunities in negotiation" onClick={() => setDetail("negotiation")}/>
          <StateRow icon={<Trophy/>} tone="green" value={state.won} label="Opportunities won" onClick={() => setDetail("won")}/>
          <div className="business-dashboard__state-row"><span className="business-dashboard__icon tone-blue"><Percent/></span><div><strong>{state.winRate == null ? "—" : `${state.winRate}%`}</strong><p>Win rate of closed opportunities</p></div></div>
        </div><div className="business-dashboard__win-rate" role="img" aria-label={state.winRate == null ? "Win rate unavailable: no closed opportunities in this period" : `Win rate: ${state.winRate} percent`}><ResponsiveContainer width="100%" height="100%" minWidth={0}><PieChart><Pie data={[{value:state.winRate ?? 0},{value:100 - (state.winRate ?? 0)}]} dataKey="value" cx="50%" cy="50%" innerRadius="72%" outerRadius="91%" startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}><Cell fill="var(--business-accent)"/><Cell fill="var(--business-accent-soft)"/></Pie></PieChart></ResponsiveContainer><div><strong>{state.winRate == null ? "—" : `${state.winRate}%`}</strong><span>Win rate</span></div></div></div>
        <div className="business-dashboard__commercial-note"><BarChart3 size={26}/><p>{state.closed ? <><strong>{state.won} of {state.closed}</strong> closed opportunities won.<br/>Keep the next conversation moving.</> : <>A clearer picture with every opportunity.<br/><strong>Win your first deal to see your conversion rate.</strong></>}</p></div><p className="business-dashboard__period-note">Based on records updated {period === "all" ? "across all time" : period === "quarter" ? "this quarter" : "this month"}.</p>
      </section>
      <section className="business-dashboard__panel business-dashboard__actions">
        <PanelHeader icon={<Zap/>} title="Next sales actions" subtitle="Prioritized actions to keep momentum."><button className="business-dashboard__outline" disabled={!actions.length} onClick={() => setShowAllActions(value => !value)} aria-expanded={showAllActions}>{showAllActions ? "Show less" : "View all"}{actions.length ? <span>{actions.length}</span> : null}</button></PanelHeader>
        {actionError ? <p className="field-error" role="alert">{actionError}</p> : null}
        {completedAction ? <div className="business-dashboard__undo" role="status"><Check size={16}/><span>Sales action completed.</span><button disabled={!!busyAction} onClick={() => void completeAction(completedAction, false)}><RotateCcw size={13}/> Undo</button></div> : null}
        {displayedActions.length ? <ul className="business-dashboard__action-list">{displayedActions.map(row => { const date = actionDate(row); const lead = (records.leads ?? []).find(lead => lead.id === row.lead_id); const ActionIcon = /call|phone/i.test(String(row.next_action)) ? Phone : /email|send/i.test(String(row.next_action)) ? Mail : /proposal|quote/i.test(String(row.next_action)) ? FileText : Users; return <li key={row.id}><button className="business-dashboard__complete" aria-label={`Complete sales action: ${String(row.next_action)}`} disabled={!!busyAction} onClick={() => void completeAction(row)}>{busyAction === row.id ? <span className="business-dashboard__spinner"/> : <Circle size={18}/>}</button><span className="business-dashboard__action-icon"><ActionIcon size={18}/></span><button className="business-dashboard__action-title" onClick={() => onOpen("opportunities", row)}>{String(row.next_action)}</button><span className="business-dashboard__action-company">{String(lead?.company || lead?.name || row.title)}</span><span className={`business-dashboard__badge badge-${date.tone}`}>{date.tone === "overdue" ? "Overdue" : date.tone === "today" ? "Today" : date.tone === "upcoming" ? "Upcoming" : "No date"}</span><span className="business-dashboard__action-date"><CalendarDays size={15}/>{date.text}</span><button className="business-dashboard__more" aria-label={`Edit sales action for ${String(row.title)}`} onClick={() => onOpen("opportunities", row)}><MoreHorizontal size={18}/></button></li>; })}</ul> : <div className="business-dashboard__empty-actions"><span className="business-dashboard__empty-icon"><CalendarDays size={25}/></span><div><strong>{loading ? "Reading your next moves…" : "Make room for your next win"}</strong><p>Add an opportunity and give it a next action.<br/>Your follow-ups will appear right here.</p></div><Button emphasis="outline" onClick={() => onOpen("opportunities")} disabled={loading}><Plus size={14}/> New opportunity</Button></div>}
      </section>
    </div>
    <div className="business-dashboard__bottom-grid">
      <section className="business-dashboard__panel business-dashboard__forecast" aria-busy={forecastBusy}>
        <PanelHeader icon={<BarChart3/>} title={`Revenue forecast — ${periodNames[horizon]}`} subtitle="Scheduled commitments and weighted opportunities."><label className="business-dashboard__select"><span className="sr-only">Revenue forecast period</span><select value={horizon} onChange={event => { setHorizon(event.target.value as ForecastHorizon); setForecastError(""); }}><option value="this_month">This month</option><option value="next_month">Next month</option><option value="quarter">This quarter</option></select></label></PanelHeader>
        <div className="business-dashboard__forecast-legend"><button aria-pressed={showCommitted} onClick={() => setShowCommitted(value => !value)}><i/>Committed</button><button aria-pressed={showPotential} onClick={() => setShowPotential(value => !value)}><i/>Potential</button></div>
        {forecastError ? <div className="business-dashboard__error" role="alert"><span>{forecastError}</span><Button emphasis="outline" onClick={() => setForecastRetry(value => value + 1)}>Retry forecast</Button></div> : <div className="business-dashboard__forecast-body"><div className="business-dashboard__forecast-chart" aria-label={`Revenue forecast in ${currency==='USD'?'$':currency}`}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}><BarChart data={series.buckets} margin={{ top: 8, right: 8, left: -5, bottom: 0 }} accessibilityLayer><CartesianGrid vertical={false} stroke="var(--business-line)"/><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill:"var(--business-muted)",fontSize:11 }}/><YAxis axisLine={false} tickLine={false} tick={{fill:"var(--business-muted)",fontSize:10}} tickFormatter={shortValue} width={52} domain={[0, (dataMax: number) => dataMax > 0 ? dataMax : 1000]}/><Tooltip cursor={{ fill:"var(--business-accent-soft)" }} formatter={value => money(value, currency)} contentStyle={{background:"var(--business-surface)",border:"1px solid var(--business-line)",borderRadius:9,color:"var(--business-ink)",fontSize:12}}/>{showCommitted ? <Bar dataKey="committed" name="Committed" stackId="revenue" fill="var(--business-accent)" maxBarSize={42} isAnimationActive={false}/> : null}{showPotential ? <Bar dataKey="potential" name="Potential" stackId="revenue" fill="var(--business-chart-potential)" radius={[3,3,0,0]} maxBarSize={42} isAnimationActive={false}/> : null}</BarChart></ResponsiveContainer>
          {!forecastTotal && !forecastBusy ? <div className="business-dashboard__chart-empty"><strong>No scheduled revenue yet</strong><span>Add close dates to opportunities to see the forecast.</span></div> : null}{forecastBusy ? <div className="business-dashboard__chart-empty" role="status"><span className="business-dashboard__spinner"/>Updating forecast…</div> : null}
          <div className="business-dashboard__chart-dates" aria-hidden="true">{series.buckets.map(bucket => <span key={bucket.label}>{bucket.dates}</span>)}</div>
        </div><div className="business-dashboard__forecast-summary"><span>Scheduled forecast</span><strong>{forecastBusy ? "—" : money(forecastTotal, currency)}</strong><dl><div><dt><i/>Committed</dt><dd>{money(series.committed, currency)}</dd></div><div><dt><i/>Potential</dt><dd>{money(series.potential, currency)}</dd></div></dl><p>{money(series.unscheduled, currency)} in pipeline without a close date.</p></div></div>}
        <div className="business-dashboard__forecast-footer"><span>Received <b>{money(forecastValues?.received ?? 0, currency)}</b></span><span>Outstanding <b>{money(forecastValues?.outstanding ?? 0, currency)}</b></span><Link href="/pipeline">Plan next close <ArrowRight size={13}/></Link></div>
      </section>
      <ReactivationCandidates presentation="dashboard" onMutationSuccess={onRetry}/>
    </div>
    {overview?.risks.length ? <section className="business-dashboard__panel business-dashboard__risks"><PanelHeader icon={<Zap/>} title="Needs attention" subtitle="A few things worth moving forward."/><div>{overview.risks.map(risk => <Link key={`${risk.type}-${risk.title}`} href={risk.route}><strong>{risk.title}</strong><span>{risk.detail}</span><ChevronRight size={18}/></Link>)}</div></section> : null}
    <div className="business-dashboard__toolbar"><span><span className={`business-dashboard__live ${loading ? "is-loading" : ""}`}/>{loading ? "Updating your business picture…" : "Your workspace, at a glance"}</span><label>Currency<select aria-label="Dashboard currency" value={currency} onChange={event => { setCurrency(event.target.value); setSelectedStage(null); }}>{currencies.map(code => <option key={code} value={code}>{code}</option>)}</select></label></div>
    <footer className="business-dashboard__footer"><span>{!hasRecords && !loading ? "Start with one lead. Build the picture as you go." : "A live view of your commercial workspace."}</span><button disabled={loading} onClick={() => onOpen("leads")}><Plus size={14}/> New lead</button><Link href="/business?view=pulse">Business pulse <ArrowRight size={13}/></Link><Link href="/settings/business"><Settings2 size={14}/> Business settings</Link></footer>
    <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? detailTitles[detail] : "Business detail"} description={detail === "weighted" ? "Opportunity value multiplied by its win probability. Currency totals stay separate." : "Explore the records behind this summary."}>
      <div className="business-dashboard__detail-list">{details.length ? details.map(row => <button key={row.id} onClick={() => { setDetail(null); onOpen(detailResource, row); }}><span><strong>{String(row.title ?? row.name)}</strong><small>{String(row.company ?? row.stage ?? row.status ?? "").replaceAll("_"," ")}</small></span><b>{detail === "leads" ? String(row.source ?? "").replaceAll("_"," ") : money(row.total ?? row.estimated_value, recordCurrency(row))}</b><ChevronRight size={16}/></button>) : <div className="business-dashboard__detail-empty"><Users size={30}/><h3>{detail === "leads" ? "Your next relationship starts here" : "Nothing here yet"}</h3><p>{detail === "leads" ? "Add a lead to keep the conversation moving." : "Add a commercial record to build your business picture."}</p></div>}<Button intent="brand" onClick={() => { setDetail(null); onOpen(detailResource); }}><Plus size={15}/> {detailResource === "leads" ? "New lead" : detailResource === "proposals" ? "New proposal" : "New opportunity"}</Button></div>
    </Modal>
  </div>;
}

function Metric({ label, value, icon, tone, detail, rows, onClick, loading }: { label: string; value: string | number; icon: ReactNode; tone: string; detail: string; rows: BusinessRecord[]; onClick: () => void; loading: boolean }) {
  const now = new Date();
  const chart = Array.from({ length: 4 }, (_, index) => {
    const end = new Date(now); end.setDate(end.getDate() - (3-index)*7);
    const start = new Date(end); start.setDate(start.getDate()-7);
    return {count:rows.filter(row => row.created_at && new Date(row.created_at) >= start && new Date(row.created_at) < end).length};
  });
  return <button className={`business-dashboard__metric tone-${tone}`} disabled={loading} onClick={onClick} aria-label={`${label}: ${loading ? "loading" : value}. View records.`}><span className="business-dashboard__metric-icon">{icon}</span><span className="business-dashboard__metric-copy"><span>{label}</span><strong>{loading ? "—" : value}</strong><small>{detail}</small></span><span className="business-dashboard__spark" aria-hidden="true">{rows.length ? <ResponsiveContainer width="100%" height="100%" minWidth={0}><BarChart data={chart}><Bar dataKey="count" fill="currentColor" radius={[3,3,0,0]} isAnimationActive={false}/></BarChart></ResponsiveContainer> : <ChevronRight size={22}/>}</span></button>;
}
function StateRow({ icon, tone, value, label, onClick }: {icon:ReactNode;tone:string;value:number;label:string;onClick:()=>void}) {
  return <button className="business-dashboard__state-row" onClick={onClick}><span className={`business-dashboard__icon tone-${tone}`}>{icon}</span><span><strong>{value}</strong><span>{label}</span></span><ChevronRight size={15}/></button>;
}

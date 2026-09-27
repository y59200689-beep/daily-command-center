"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, BarChart3, CalendarDays, ChevronRight, CreditCard, FileText, FlaskConical, MoreHorizontal, Target, TrendingUp, Trophy, Users, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/toast-provider";
import { useDeferredEffect } from "@/lib/use-deferred-effect";
import { announceWorkspaceMutation } from "@/lib/workspace-mutations";
import { BusinessEditor, cleanBusinessValues } from "@/features/business/business-workspace";
import { emptyGrowthSnapshot, growthStageSeries, growthTotals, serviceRevenueSeries, type GrowthRow, type GrowthSnapshot } from "@/lib/growth-dashboard";
import "@/features/business/business-dashboard.css";
import "./growth-home.css";

type Overview = { dashboard: GrowthSnapshot; scoredOpportunities: GrowthRow[]; growthRisks: GrowthRow[]; dormantClients: GrowthRow[]; expansionCandidates: GrowthRow[]; activeExperiments: GrowthRow[]; nextGrowthMove?: GrowthRow | null };
const money = (n: unknown, currency: string) => `${currency} ${new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(Number(n ?? 0))}`;
const titleCase = (value: unknown) => String(value ?? "").replaceAll("_", " ").replace(/^./, char => char.toUpperCase());
const dateLabel = (value: unknown) => value ? new Date(`${String(value).slice(0,10)}T12:00:00`).toLocaleDateString("en", { month: "short", day: "numeric" }) : "No date";

export function GrowthHome() {
  const { showToast } = useToast();
  const router = useRouter();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const controller = useRef<AbortController | null>(null);
  const [now] = useState(() => new Date());
  const [currency, setCurrency] = useState("MAD");
  const [period, setPeriod] = useState<"all" | "this_month">("all");
  const [months, setMonths] = useState(6);
  const [stage, setStage] = useState("");
  const [allOpportunities, setAllOpportunities] = useState(false);
  const [allRisks, setAllRisks] = useState(false);
  const [allDormant, setAllDormant] = useState(false);
  const [editing, setEditing] = useState<GrowthRow | null | undefined>(undefined);
  const [detail, setDetail] = useState<{ title: string; description: string; rows?: GrowthRow[]; resource?: string; route?: string } | null>(null);
  const [outreach, setOutreach] = useState<GrowthRow | null>(null);
  const [followupTitle, setFollowupTitle] = useState("");
  const [followupDate, setFollowupDate] = useState("");
  const [followupError, setFollowupError] = useState("");
  const titleInput = useRef<HTMLInputElement>(null);
  const dateInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    controller.current?.abort(); const next = new AbortController(); controller.current = next;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/growth/overview", { cache: "no-store", signal: next.signal });
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Growth could not be loaded.");
      if (!next.signal.aborted) setData(body);
    } catch (reason) { if (!next.signal.aborted) setError(reason instanceof Error ? reason.message : "Growth could not be loaded."); }
    finally { if (!next.signal.aborted) setLoading(false); }
  }, []);
  useDeferredEffect(useCallback(() => { void load(); return () => controller.current?.abort(); }, [load]));
  const snapshot = data?.dashboard ?? emptyGrowthSnapshot;
  const currencies = Array.from(new Set(["MAD", ...[...snapshot.opportunities, ...snapshot.invoices, ...snapshot.payments, ...snapshot.proposals].map(row => String(row.currency || "MAD"))])).sort();
  const totals = growthTotals(snapshot, currency);
  const stageData = growthStageSeries(snapshot.opportunities, currency, period);
  const service = serviceRevenueSeries(snapshot, currency, months);
  const opportunities = (stage === "won" ? snapshot.opportunities.filter(row => row.stage === "won") : data?.scoredOpportunities ?? []).filter(row => String(row.currency || "MAD") === currency && (period === "all" || String(row.updated_at ?? row.created_at ?? "").startsWith(new Date().toISOString().slice(0,7))) && (!stage || (stage === "new" ? ["new","discovery"].includes(String(row.stage)) : stage === "qualified" ? ["qualified","meeting"].includes(String(row.stage)) : row.stage === stage)));
  const risks = (data?.growthRisks ?? []).filter(row => !row.currency || row.currency === currency);
  const dormant = data?.dormantClients ?? [];
  const clientName = (row: GrowthRow) => String(snapshot.clients.find(client => client.id === row.client_id)?.name ?? "No linked client");
  const metrics = [
    { label: "Open pipeline", value: totals.openPipeline, icon: <Users/>, tone: "violet", note: "Open opportunity value", rows: snapshot.opportunities.filter(row => !["won","lost"].includes(String(row.stage))), resource: "opportunities" },
    { label: "Won this month", value: totals.wonThisMonth, icon: <Trophy/>, tone: "green", note: "Deals won this calendar month", rows: snapshot.opportunities.filter(row => row.stage === "won" && String(row.won_at ?? "").startsWith(new Date().toISOString().slice(0,7))), resource: "opportunities" },
    { label: "Invoiced total", value: totals.invoicedTotal, icon: <FileText/>, tone: "orange", note: "Issued invoices · all time", rows: snapshot.invoices.filter(row => !["draft","cancelled","void"].includes(String(row.status))), resource: "invoices" },
    { label: "Collected", value: totals.collectedTotal, icon: <CreditCard/>, tone: "blue", note: "Recorded payments · all time", rows: snapshot.payments, resource: "payments" },
  ];
  async function saveOpportunity(resource: string, values: Record<string, unknown>) {
    const response = await fetch(`/api/business/${resource}`, { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editing ? { ...cleanBusinessValues(values), id: editing.id } : cleanBusinessValues(values)) });
    const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Opportunity could not be saved.");
    setEditing(undefined); announceWorkspaceMutation("projects"); showToast(editing ? "Opportunity updated." : "Opportunity created.", "success"); await load();
  }
  function openOutreach(client: GrowthRow) {
    setOutreach(client); setFollowupTitle(`Check in with ${String(client.clientName ?? client.name ?? "client")}`); setFollowupDate(new Date().toISOString().slice(0,10)); setFollowupError("");
  }
  async function createFollowup(event: React.FormEvent) {
    event.preventDefault();
    if (!followupTitle.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(followupDate)) { setFollowupError("Enter a follow-up title and date."); (!followupTitle.trim() ? titleInput : dateInput).current?.focus(); return; }
    setBusy(true); setFollowupError("");
    try {
      const response = await fetch("/api/growth/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "followup", title: followupTitle.trim(), due_date: `${followupDate}T12:00:00` }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Follow-up could not be created.");
      showToast("Follow-up created.", "success"); announceWorkspaceMutation("clients"); setOutreach(null);
    } catch (reason) { setFollowupError(reason instanceof Error ? reason.message : "Follow-up could not be created."); }
    finally { setBusy(false); }
  }
  return <div className="business-dashboard growth-overview" aria-busy={loading}>
    <header className="business-dashboard__header">
      <div><nav aria-label="Breadcrumb"><TrendingUp size={14}/><Link href="/business">Business</Link><ChevronRight size={13}/><strong>Growth</strong></nav><h1>Growth</h1><p>Turn pipeline, experiments, and client expansion into clear next actions.</p></div>
      <nav className="business-dashboard__nav" aria-label="Growth workspaces"><Link href="/growth/pipeline">Pipeline</Link><Link href="/growth/playbooks">Playbooks</Link><Link href="/growth/reviews">Reviews</Link><Link href="/growth/experiments" className="is-primary">Experiments</Link></nav>
    </header>
    {error && <div className="growth-overview__error" role="alert"><span>{error}</span><Button onClick={() => void load()}>Retry</Button></div>}
    <section className="business-dashboard__metrics" aria-label="Growth summary">{metrics.map(metric => <button key={metric.label} disabled={loading || !!error} className={`business-dashboard__metric tone-${metric.tone}`} onClick={() => setDetail({ title: metric.label, description: `${metric.note}. Values are shown separately for ${currency}.`, rows: metric.rows.filter(row => String(row.currency || "MAD") === currency), resource: metric.resource })} aria-label={`${metric.label}: ${money(metric.value,currency)}. View records.`}><span className="business-dashboard__metric-icon">{metric.icon}</span><span className="business-dashboard__metric-copy"><span>{metric.label}</span><strong>{loading ? "—" : money(metric.value,currency)}</strong><small>{metric.note}</small></span><ChevronRight className="growth-overview__metric-arrow" size={18}/></button>)}</section>
    <div className="growth-overview__top-grid">
      <section className="business-dashboard__panel growth-overview__opportunities">
        <PanelHeader icon={<BarChart3/>} title={stage === "won" ? "Won opportunities" : "Growth opportunities"} description={stage === "won" ? "Closed wins in your pipeline" : "Active opportunities in your pipeline"}><Link className="growth-overview__outline" href="/growth/pipeline">View pipeline</Link><button className="growth-overview__icon-button" aria-label={allOpportunities ? "Show fewer opportunities" : "Show all opportunities"} aria-expanded={allOpportunities} onClick={() => setAllOpportunities(value => !value)} disabled={!opportunities.length}><MoreHorizontal size={19}/></button></PanelHeader>
        {stage && <div className="growth-overview__filter">Showing {titleCase(stage === "new" ? "discovery" : stage)} <button onClick={() => setStage("")} aria-label="Clear stage filter"><X size={14}/></button></div>}
        <div className={`growth-overview__table-wrap ${!opportunities.length ? "is-empty" : ""}`}><table><thead><tr><th>Opportunity</th><th>Client</th><th>Value</th><th>Stage</th><th>Next step</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{(allOpportunities ? opportunities : opportunities.slice(0,5)).map(row => <tr key={row.id}><td><button className="growth-overview__record" onClick={() => setEditing(row)}><FileText size={17}/><strong>{String(row.title ?? "Untitled opportunity")}</strong></button></td><td>{row.client_id ? <Link href={`/success/clients/${row.client_id}`}>{clientName(row)}</Link> : <span className="growth-overview__muted">No client</span>}</td><td>{money(row.estimated_value,currency)}</td><td><button className={`growth-overview__badge stage-${row.stage}`} onClick={() => setStage(String(row.stage))}>{titleCase(row.stage === "new" ? "discovery" : row.stage)}</button></td><td><button className="growth-overview__next-step" onClick={() => setEditing(row)}><CalendarDays size={14}/><span>{String(row.next_action || "Plan next step")}</span><small>{dateLabel(row.next_action_date)}</small></button></td><td><button className="growth-overview__icon-button" aria-label={`Edit ${row.title}`} onClick={() => setEditing(row)}><MoreHorizontal size={16}/></button></td></tr>)}</tbody></table></div>
        {!opportunities.length && <Empty icon={<TrendingUp/>} title={loading ? "Reading your pipeline…" : stage ? "No opportunities in this stage" : "Make room for your next win"} description="Give your next opportunity a value, stage, and clear next step."><Button emphasis="outline" onClick={() => setEditing(null)} disabled={loading}>New opportunity <ArrowRight size={14}/></Button></Empty>}
      </section>
      <section className="business-dashboard__panel growth-overview__stage-panel"><PanelHeader icon={<BarChart3/>} title="Pipeline value by stage"><label className="business-dashboard__select"><span className="sr-only">Pipeline chart period</span><select value={period} onChange={event => setPeriod(event.target.value as typeof period)}><option value="all">All time</option><option value="this_month">This month</option></select></label></PanelHeader><strong className="growth-overview__chart-total">{loading ? "—" : money(stageData.total,currency)}</strong><span className="growth-overview__basis">{period === "all" ? "Current pipeline, including won deals" : "Records updated this month, including won deals"}</span>
        <div className="growth-overview__stage-chart" role="img" aria-label={`Pipeline values by stage in ${currency}. ${stageData.series.map(row => `${row.label}: ${row.value}`).join(", ")}`}><ResponsiveContainer width="100%" height="100%"><BarChart data={stageData.series} margin={{left:0,right:0,top:10,bottom:0}}><CartesianGrid vertical={false} stroke="var(--business-line)"/><XAxis dataKey="label" hide/><YAxis tick={{fontSize:10,fill:"var(--business-muted)"}} axisLine={false} tickLine={false} width={53} tickFormatter={n => n >= 1000 ? `${n/1000}K` : String(n)}/><Tooltip formatter={value => money(value,currency)} contentStyle={{borderRadius:10,borderColor:"var(--business-line)",background:"var(--business-surface)"}}/><Bar dataKey="value" name="Stage value" maxBarSize={48} isAnimationActive={false}>{stageData.series.map(row => <Cell key={row.id} fill={row.color}/>)}</Bar></BarChart></ResponsiveContainer></div>
        <div className="growth-overview__stage-labels">{stageData.series.map(row => <button key={row.id} aria-pressed={stage === row.id} onClick={() => { setStage(current => current === row.id ? "" : row.id); }}><strong>{money(row.value,currency)}</strong><small>{row.share}%</small><span>{row.label}</span></button>)}</div>
      </section>
    </div>
    <div className="growth-overview__insight-grid">
      <section className="business-dashboard__panel"><PanelHeader icon={<TriangleAlert/>} tone="rose" title="Growth risks" description="Opportunities at risk or showing warning signals"><button className="growth-overview__outline" aria-expanded={allRisks} onClick={() => setAllRisks(value => !value)} disabled={!risks.length}>{allRisks ? "Less" : "All"}</button></PanelHeader>
        {risks.length ? <div className="growth-overview__compact-list">{(allRisks ? risks : risks.slice(0,4)).map(row => <button key={row.id} onClick={() => setDetail({title:String(row.risk),description:`${String(row.evidence ?? "")} ${String(row.recommendedAction ?? "")}`,route:"/growth/pipeline",rows:[]})}><FileText size={17}/><span><strong>{String(row.risk)}</strong><small>{String(row.recommendedAction ?? "")}</small></span><span className={`growth-overview__badge severity-${row.severity}`}>{row.severity === "critical" ? "High" : row.severity === "important" ? "Medium" : "Review"}</span><ChevronRight size={14}/></button>)}</div> : <Empty icon={<TriangleAlert/>} title={loading ? "Checking your signals…" : "No active growth risks"} description="Keep next steps and close dates current to maintain a healthy pipeline."><Link href="/growth/pipeline">Review pipeline <ArrowRight size={13}/></Link></Empty>}
      </section>
      <section className="business-dashboard__panel"><PanelHeader icon={<Users/>} title="Dormant clients" description="Clients with low recent activity"><button className="growth-overview__outline" aria-expanded={allDormant} onClick={() => setAllDormant(value => !value)} disabled={!dormant.length}>{allDormant ? "Less" : "All"}</button></PanelHeader>
        {dormant.length ? <div className="growth-overview__dormant-list">{(allDormant ? dormant : dormant.slice(0,4)).map(row => <div key={String(row.clientId)}><Link href={`/success/clients/${row.clientId}`}><Users size={17}/><strong>{String(row.clientName)}</strong></Link><span className="growth-overview__badge severity-important">{Math.max(0,Math.floor((now.getTime()-Date.parse(String(row.lastActivityDate)))/86400000))} days</span><button className="growth-overview__outline" onClick={() => openOutreach(row)}>Plan outreach</button></div>)}</div> : <Empty icon={<Users/>} title={loading ? "Reading client activity…" : "No dormant clients identified"} description="Clients with past work and 90 days of inactivity will appear here."><Link href="/clients">Explore clients <ArrowRight size={13}/></Link></Empty>}
      </section>
      <section className="business-dashboard__panel growth-overview__services"><PanelHeader icon={<BarChart3/>} title="Service performance" description="Accepted service value over time"><label className="business-dashboard__select"><span className="sr-only">Service performance period</span><select value={months} onChange={event => setMonths(Number(event.target.value))}><option value="6">Last 6 months</option><option value="3">Last 3 months</option><option value="12">Last 12 months</option></select></label></PanelHeader><div className="growth-overview__service-metrics"><div><strong>{loading ? "—" : money(service.revenue,currency)}</strong><span>Accepted value</span></div><div><strong>{loading ? "—" : service.services}</strong><span>Services sold</span></div><div><strong>{loading ? "—" : service.clients}</strong><span>Buying clients</span></div></div>
        <div className="growth-overview__service-chart" role="img" aria-label={`Accepted service value in ${currency}, last ${months} months`}><ResponsiveContainer width="100%" height="100%"><AreaChart data={service.buckets} margin={{top:8,right:5,left:0,bottom:0}}><CartesianGrid vertical={false} stroke="var(--business-line)"/><XAxis dataKey="label" tick={{fontSize:10,fill:"var(--business-muted)"}} axisLine={false} tickLine={false}/><YAxis width={43} tick={{fontSize:9,fill:"var(--business-muted)"}} tickFormatter={n=>n>=1000?`${n/1000}K`:String(n)} axisLine={false} tickLine={false}/><Tooltip formatter={value=>money(value,currency)} contentStyle={{borderRadius:10,background:"var(--business-surface)",borderColor:"var(--business-line)"}}/><Area type="monotone" dataKey="value" name="Accepted service value" stroke="var(--business-accent)" fill="var(--business-accent-soft)" strokeWidth={2} isAnimationActive={false}/></AreaChart></ResponsiveContainer>{!service.revenue && <span className="growth-overview__chart-empty">{loading ? "Loading service history…" : "No accepted service value in this period"}</span>}</div><Link className="growth-overview__service-link" href="/services">Explore services <ArrowRight size={12}/></Link>
      </section>
    </div>
    <nav className="growth-overview__navigation" aria-label="Growth sections">
      <NavigationCard icon={<TrendingUp/>} title="Pipeline" description="Scored opportunities & deal health" href="/growth/pipeline" primary meta={`${snapshot.opportunities.filter(row=>!["won","lost"].includes(String(row.stage))).length} open · ${money(totals.openPipeline,currency)}`}/>
      <NavigationCard icon={<FileText/>} title="Playbooks" description="Sales engagement sequences" href="/growth/playbooks" meta="Build a repeatable sales approach"/>
      <NavigationCard icon={<FlaskConical/>} title="Experiments" description="Test hypotheses, measure impact" href="/growth/experiments" meta={`${data?.activeExperiments.length ?? 0} planned or running`}/>
      <NavigationCard icon={<BarChart3/>} title="Forecast" description="Committed / Likely / Possible" href="/growth/forecast" meta="Explore your revenue scenarios"/>
      <NavigationCard icon={<Target/>} title="Reviews & Targets" description="Deal retrospectives & targets" href="/growth/reviews" meta="Review results and set your targets"/>
    </nav>
    <footer className="growth-overview__footer"><span>{loading ? "Updating your growth picture…" : "Your workspace, at a glance"}</span><label>Currency <select aria-label="Growth currency" value={currency} onChange={event=>{setCurrency(event.target.value);setStage("");}}>{currencies.map(code=><option key={code}>{code}</option>)}</select></label><button disabled={loading} onClick={()=>void load()}>Refresh</button></footer>
    {data?.nextGrowthMove && <div className="growth-overview__recommendation"><TrendingUp size={16}/><span><strong>Next growth move</strong> {String(data.nextGrowthMove.title)} · {String(data.nextGrowthMove.reason)}</span>{!!data.nextGrowthMove.route && <Link href={String(data.nextGrowthMove.route)}>Take action <ArrowRight size={14}/></Link>}</div>}
    {!!data?.expansionCandidates.length && <section className="growth-overview__expansion"><h2>Client expansion</h2>{data.expansionCandidates.map(row=><Link key={String(row.clientId)} href={`/success/clients/${row.clientId}`}><span>{String(row.clientName)}<small>{String(row.evidence ?? row.expansionType)}</small></span><ChevronRight size={16}/></Link>)}</section>}
    <BusinessEditor key={editing?.id ?? (editing === null ? "new" : "closed")} resource={editing === undefined ? null : "opportunities"} record={editing ?? null} onClose={()=>setEditing(undefined)} onSave={saveOpportunity}/>
    <Modal open={!!detail} onClose={()=>setDetail(null)} title={detail?.title ?? "Growth detail"} description={detail?.description}>
      <div className="business-dashboard__detail-list">{detail?.rows?.length ? detail.rows.map(row=><button key={row.id} onClick={()=>{if(detail.resource === "opportunities"){setDetail(null);setEditing(row);}else{setDetail(null);router.push("/finance/invoices");}}}><span><strong>{String(row.title ?? row.invoice_number ?? (detail.resource === "payments" ? `Payment · ${dateLabel(row.payment_date)}` : "Invoice"))}</strong><small>{titleCase(row.stage ?? row.status)}</small></span><b>{money(row.estimated_value ?? row.total_amount ?? row.amount,currency)}</b><ChevronRight size={16}/></button>) : <p className="growth-overview__detail-empty">{detail?.route ? "Review the pipeline and update the affected opportunities." : "No records in this summary yet."}</p>}{detail?.route && <Link className="growth-overview__outline" href={detail.route}>Review pipeline <ArrowRight size={14}/></Link>}</div>
    </Modal>
    <Modal open={!!outreach} onClose={()=>{if(!busy)setOutreach(null);}} title="Plan client outreach" description={String(outreach?.suggestedAction ?? "Create a follow-up to keep this relationship moving.")}>
      <form className="growth-overview__outreach-form" noValidate onSubmit={createFollowup}><label htmlFor="growth-followup-title">Follow-up title<input id="growth-followup-title" ref={titleInput} value={followupTitle} onChange={event=>setFollowupTitle(event.target.value)} maxLength={240} aria-invalid={!!followupError} aria-describedby={followupError?"growth-followup-error":undefined}/></label><label htmlFor="growth-followup-date">Due date<input id="growth-followup-date" ref={dateInput} type="date" value={followupDate} onChange={event=>setFollowupDate(event.target.value)} aria-invalid={!!followupError} aria-describedby={followupError?"growth-followup-error":undefined}/></label>{followupError && <p id="growth-followup-error" role="alert" className="field-error">{followupError}</p>}<div className="modal__actions"><Button onClick={()=>setOutreach(null)} disabled={busy}>Cancel</Button><Button type="submit" intent="brand" disabled={busy}>{busy?"Creating…":"Create follow-up"}</Button></div></form>
    </Modal>
  </div>;
}
function PanelHeader({icon,title,description,children,tone="violet"}:{icon:ReactNode;title:string;description?:string;children?:ReactNode;tone?:string}) {return <header className="business-dashboard__panel-header"><span className={`business-dashboard__icon tone-${tone}`}>{icon}</span><div><h2>{title}</h2>{description&&<p>{description}</p>}</div>{children}</header>;}
function Empty({icon,title,description,children}:{icon:ReactNode;title:string;description:string;children?:ReactNode}) {return <div className="growth-overview__empty"><span>{icon}</span><strong>{title}</strong><p>{description}</p>{children}</div>;}
function NavigationCard({icon,title,description,href,meta,primary}:{icon:ReactNode;title:string;description:string;href:string;meta:string;primary?:boolean}) {return <Link href={href} className={primary?"is-primary":""}><span className="growth-overview__nav-icon">{icon}</span><span><strong>{title}</strong><p>{description}</p><small>{meta}</small></span><span className="growth-overview__nav-arrow"><ArrowRight size={19}/></span></Link>;}

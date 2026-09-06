"use client";

import Link from "next/link";
import { useCallback, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useDeferredEffect } from "@/lib/use-deferred-effect";

type CurrencyMetrics = Record<string, { spend: number; revenue: number; orders: number; customers: number }>;
type FounderData = {
  company: { id: string; name: string } | null;
  state?: string;
  projects?: Array<{ id: string; name: string }>;
  attention?: Array<{ key: string; title: string; reason: string; route: string }>;
  nextAction?: { title: string; reason: string; route: string } | null;
  commerce?: { revenue: Record<string, number>; orderCount: number; averageOrderValue: Record<string, number | null> };
  funnel?: { sessions: number | null; productViews: number | null; addToCart: number | null; checkoutStarted: number | null; ordersCreated: number | null; ordersConfirmed: number | null; overallConversion: number | null } | null;
  products?: Array<{ id: string; name: string; revenue: number; units: number; grossMargin: number | null }>;
  inventory?: Array<{ id: string; name: string; state: string; daysOfStock: number | null }>;
  latestDeployment?: { status: string; commit_message: string | null; completed_at: string | null } | null;
  deploymentSource?: { state: string; lastSuccessfulSync: string | null; message: string };
  development?: { repositories: Array<{ id: string; name: string; url: string | null; updatedAt: string | null; openIssues: number; openPullRequests: number }>; openIssues: number; openPullRequests: number; lastActivity: string | null };
  incidents?: Array<{ id: string; title: string; severity: string; status: string }>;
  roadmap?: Array<{ id: string; title: string; horizon: string; status: string }>;
  supportOpen?: number;
  support?: { open: number; createdThisWeek: number; topCategory: { category: string; count: number } | null; averageResolutionHours: number | null };
  marketing?: CurrencyMetrics;
  aiUsage?: { requests: number; successes: number; failures: number; inputTokens: number; outputTokens: number; estimatedCost: number; unknownCostRequests: number; topFeature: Record<string, number> };
};

const money = (values: Record<string, number | null> | undefined) => values && Object.entries(values).length
  ? Object.entries(values).map(([currency, value]) => value == null ? `— ${currency}` : `${Number(value).toLocaleString()} ${currency}`).join(" · ")
  : "No data yet";
const percentage = (value: number | null | undefined) => value == null ? "—" : `${(value * 100).toFixed(1)}%`;

export function FounderDashboard() {
  const [data, setData] = useState<FounderData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [create, setCreate] = useState<"suppliers" | "roadmap" | "incidents" | "support" | null>(null);
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/founder", { cache: "no-store" });
      const body = await response.json() as FounderData & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Founder dashboard could not be loaded.");
      setData(body); setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Founder dashboard could not be loaded."); }
  }, []);
  useDeferredEffect(useCallback(() => { void load(); }, [load]));
  const setup = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/founder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Para Officinal", primaryProjectId: projectId || null }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Company could not be set up.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Para Officinal could not be set up."); } finally { setBusy(false); }
  };
  if (error) return <div className="domain-page"><section className="inline-error" role="alert"><p>{error}</p><Button emphasis="outline" onClick={() => void load()}>Try again</Button></section></div>;
  if (!data) return <div className="domain-page"><div className="empty-state"><span>···</span><h2>Preparing founder view</h2></div></div>;
  if (!data.company) return <Setup projects={data.projects ?? []} projectId={projectId} setProjectId={setProjectId} busy={busy} setup={setup} />;
  const commerce = data.commerce;
  const marketing = data.marketing ?? {};
  const topFeature = data.aiUsage ? Object.entries(data.aiUsage.topFeature).sort(([, first], [, second]) => second - first)[0] : null;
  return <div className="domain-page founder-page">
    <header className="founder-hero"><div><p className="eyebrow">Founder operating system</p><h1>{data.company.name}</h1><p>Company health, signal, and the next action that protects momentum.</p></div>{data.nextAction ? <Link className="founder-next-action" href={data.nextAction.route}><p className="eyebrow">Next founder action</p><strong>{data.nextAction.title}</strong><span>{data.nextAction.reason}</span></Link> : <div className="founder-next-action"><p className="eyebrow">Next founder action</p><strong>No urgent signal</strong><span>Connect a source or record an operational signal to begin.</span></div>}</header>
    <section className="metric-ledger metric-ledger--four"><Metric label="Revenue" value={money(commerce?.revenue)} /><Metric label="Orders" value={commerce ? String(commerce.orderCount) : "No data yet"} /><Metric label="Average order value" value={money(commerce?.averageOrderValue)} /><Metric label="Open product risks" value={String((data.inventory?.length ?? 0) + (data.incidents?.length ?? 0))} /></section>
    <div className="founder-grid">
      <Section title="Needs attention">{data.attention?.length ? data.attention.map((item) => <Link className="signal-row" href={item.route} key={item.key}><span><strong>{item.title}</strong>{item.reason}</span></Link>) : <Empty text="No high-value founder signal is active." />}</Section>
      <Section title="Latest production">{data.latestDeployment ? <><div className="signal-row"><span><strong>{data.latestDeployment.status}</strong>{data.latestDeployment.commit_message ?? "No commit summary"} · {data.latestDeployment.completed_at ? new Date(data.latestDeployment.completed_at).toLocaleString() : "Time unavailable"}</span></div><p className="dataset-note">{data.deploymentSource?.message}{data.deploymentSource?.lastSuccessfulSync ? ` Last successful sync ${new Date(data.deploymentSource.lastSuccessfulSync).toLocaleString()}.` : ""}</p></> : <Empty text={data.deploymentSource?.message ?? "Deployment source not connected."} />}</Section>
      <Section title="Growth funnel">{data.funnel ? <div className="founder-funnel"><FunnelRow label="Sessions" value={data.funnel.sessions} /><FunnelRow label="Product views" value={data.funnel.productViews} /><FunnelRow label="Added to cart" value={data.funnel.addToCart} /><FunnelRow label="Checkout started" value={data.funnel.checkoutStarted} /><FunnelRow label="Orders confirmed" value={data.funnel.ordersConfirmed ?? data.funnel.ordersCreated} /><p className="dataset-note">Overall conversion {percentage(data.funnel.overallConversion)}. Stages without a verified source remain unavailable.</p></div> : <Empty text="Analytics source has not supplied a funnel snapshot yet." />}</Section>
      <Section title="Marketing attribution" action={<Link className="button button--ghost" href="/founder/marketing">View campaign performance</Link>}>{Object.keys(marketing).length ? Object.entries(marketing).map(([currency, metrics]) => <div className="signal-row" key={currency}><span><strong>{metrics.revenue.toLocaleString()} {currency} attributed revenue</strong>{metrics.spend.toLocaleString()} {currency} spend · {metrics.orders} attributed orders · {metrics.customers} new customers</span></div>) : <Empty text="Attribution data has not been imported." />}</Section>
      <Section title="Commerce">{data.products?.length ? data.products.slice(0, 5).map((item) => <div className="signal-row" key={item.id}><span><strong>{item.name}</strong>{item.revenue.toLocaleString()} MAD · {item.units} units{item.grossMargin == null ? " · COGS unavailable" : ` · ${(item.grossMargin * 100).toFixed(0)}% margin`}</span></div>) : <Empty text="Commerce source not connected." />}</Section>
      <Section title="Inventory">{data.inventory?.length ? data.inventory.map((item) => <div className="signal-row" key={item.id}><span><strong>{item.name}</strong>{item.state.replaceAll("_", " ")}{item.daysOfStock == null ? " · Sales history unavailable" : ` · estimated ${item.daysOfStock.toFixed(0)} days left`}</span></div>) : <Empty text="Inventory sync has not run yet." />}</Section>
      <Section title="AI usage">{data.aiUsage?.requests ? <><div className="signal-row"><span><strong>{data.aiUsage.requests} tracked requests</strong>{data.aiUsage.successes} successful · {data.aiUsage.failures} failed · {data.aiUsage.inputTokens.toLocaleString()} input / {data.aiUsage.outputTokens.toLocaleString()} output tokens</span></div><p className="dataset-note">Estimated cost {data.aiUsage.estimatedCost.toLocaleString()} · {data.aiUsage.unknownCostRequests ? `${data.aiUsage.unknownCostRequests} requests without a cost estimate.` : "All tracked requests include a cost estimate."}{topFeature ? ` Most used: ${topFeature[0]}.` : ""}</p></> : <Empty text="No AI usage has been recorded for this company." />}</Section>
      <Section title="Development" action={<Link className="button button--ghost" href="/founder/development">Open development</Link>}>{data.development?.repositories.length ? <><p className="dataset-note">{data.development.openIssues} open issues · {data.development.openPullRequests} pull requests awaiting review{data.development.lastActivity ? ` · activity ${new Date(data.development.lastActivity).toLocaleDateString()}` : ""}</p>{data.development.repositories.slice(0, 3).map((repository) => repository.url ? <a className="signal-row" href={repository.url} target="_blank" rel="noreferrer" key={repository.id}><span><strong>{repository.name}</strong>{repository.openIssues} issues · {repository.openPullRequests} PRs</span></a> : <div className="signal-row" key={repository.id}><span><strong>{repository.name}</strong>{repository.openIssues} issues · {repository.openPullRequests} PRs</span></div>)}</> : data.roadmap?.length ? data.roadmap.map((item) => <div className="signal-row" key={item.id}><span><strong>{item.title}</strong>{item.horizon} · {item.status}</span></div>) : <Empty text="Connect GitHub or record a roadmap item to see development health." />}</Section>
      <Section title="Support" action={<Button emphasis="ghost" onClick={() => setCreate("incidents")}>New incident</Button>}>{data.incidents?.length ? data.incidents.map((item) => <div className="signal-row" key={item.id}><span><strong>{item.title}</strong>{item.severity} · {item.status}</span></div>) : <p className="dataset-note">{data.supportOpen ?? 0} open support cases · {data.support?.createdThisWeek ?? 0} created this week{data.support?.topCategory ? ` · ${data.support.topCategory.count} ${data.support.topCategory.category} cases in the recorded sample` : ""}{data.support?.averageResolutionHours != null ? ` · average resolution ${data.support.averageResolutionHours.toFixed(1)}h` : ""}.</p>}</Section>
    </div>
    <section className="data-surface founder-actions"><p className="eyebrow">Operations</p><Link className="button button--outline" href="/founder/products">Manage products</Link><Link className="button button--outline" href="/founder/supplier-orders">Supplier orders</Link><Button emphasis="outline" onClick={() => setCreate("suppliers")}>Add supplier</Button><Button emphasis="outline" onClick={() => setCreate("support")}>Record support case</Button></section>
    {create ? <FounderCreate kind={create} companyId={data.company.id} onClose={() => setCreate(null)} onSaved={async () => { setCreate(null); await load(); }} /> : null}
  </div>;
}

function Setup({ projects, projectId, setProjectId, busy, setup }: { projects: Array<{ id: string; name: string }>; projectId: string; setProjectId: (value: string) => void; busy: boolean; setup: () => Promise<void> }) { return <div className="domain-page founder-page"><header className="page-header"><div><p className="eyebrow">Founder operating system</p><h1>Para Officinal.</h1><p>Connect the existing Para Officinal project to start monitoring company operations.</p></div></header><section className="data-surface founder-setup"><p className="eyebrow">Company model</p><label htmlFor="founder-project">Primary project</label><select id="founder-project" value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">Choose later</option>{projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select><Button disabled={busy} onClick={() => void setup()}>{busy ? "Setting up…" : "Set up Para Officinal"}</Button></section></div>; }
function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) { return <section className="data-surface founder-section"><div className="integration-actions"><p className="eyebrow">{title}</p>{action}</div>{children}</section>; }
function Empty({ text }: { text: string }) { return <p className="dataset-note">{text}</p>; }
function Metric({ label, value }: { label: string; value: string }) { return <div><strong>{value}</strong><span>{label}</span></div>; }
function FunnelRow({ label, value }: { label: string; value: number | null }) { return <div className="founder-funnel-row"><span>{label}</span><strong>{value == null ? "—" : value.toLocaleString()}</strong></div>; }
function FounderCreate({ kind, companyId, onClose, onSaved }: { kind: "suppliers" | "roadmap" | "incidents" | "support"; companyId: string; onClose: () => void; onSaved: () => Promise<void> }) { const [title, setTitle] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const save = async () => { setBusy(true); setError(""); const payload = kind === "suppliers" ? { company_id: companyId, name: title, active: true } : kind === "roadmap" ? { company_id: companyId, title, type: "feature", horizon: "later" } : kind === "incidents" ? { company_id: companyId, title, severity: "major" } : { company_id: companyId, summary: title, category: "website" }; try { const response = await fetch(`/api/founder/${kind}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const body = await response.json() as { error?: string }; if (!response.ok) throw new Error(body.error ?? "This record could not be saved."); await onSaved(); } catch (reason) { setError(reason instanceof Error ? reason.message : "This record could not be saved."); } finally { setBusy(false); } }; const labels = { suppliers: "Supplier", roadmap: "Roadmap item", incidents: "Incident", support: "Support case" }; return <Modal open onClose={onClose} title={`New ${labels[kind]}`} description="Records stay private to this company."><form className="form-stack" noValidate onSubmit={(event) => { event.preventDefault(); if (!title.trim()) { setError("Enter a concise title."); return; } void save(); }}><label htmlFor="founder-title">{kind === "support" ? "Summary" : "Title"}</label><input id="founder-title" value={title} onChange={(event) => setTitle(event.target.value)} aria-invalid={Boolean(error)} autoFocus />{error ? <p className="field-error" role="alert">{error}</p> : null}<div className="integration-actions"><Button disabled={busy} type="submit">{busy ? "Saving…" : "Save"}</Button><Button emphasis="ghost" type="button" onClick={onClose}>Cancel</Button></div></form></Modal>; }

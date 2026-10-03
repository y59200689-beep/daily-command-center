"use client";

import { deleteLeads } from "@/lib/delete-leads";
import { CurrencySelect } from "@/components/ui/currency-select";
import { StyledSelect } from "@/components/ui/styled-select";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Icons } from "@/components/icons";
import { useToast } from "@/components/toast-provider";
import { useDeferredEffect } from "@/lib/use-deferred-effect";
import { announceWorkspaceMutation } from "@/lib/workspace-mutations";
import { opportunityStages, proposalTotals, type OpportunityStage, businessResourceSchemas } from "@/lib/business";
import { ServiceAnalytics } from "@/features/business/service-analytics";
import { LeadsDashboard } from "@/features/business/leads-dashboard";
import { PipelineDashboard } from "@/features/business/pipeline-dashboard";
import { readPipelineCollection } from "@/lib/pipeline-dashboard";
import { BusinessDashboard } from "@/features/business/business-dashboard";
import type { BusinessOverviewData } from "@/lib/business-dashboard";

type RecordRow = Record<string, unknown> & { id: string; created_at?: string; updated_at?: string };
type Screen = "business" | "leads" | "pipeline" | "services" | "proposals";
type Resource = "leads" | "opportunities" | "services" | "proposals";
type Overview = BusinessOverviewData;

const copy: Record<Screen, { eyebrow: string; title: string; intro: string; action?: string }> = {
  business: { eyebrow: "Business operating system", title: "Business", intro: "A calm view of demand, commitments, and the margin underneath the work." },
  leads: { eyebrow: "Business development", title: "Leads", intro: "Potential relationships before they become a promise or a project.", action: "New lead" },
  pipeline: { eyebrow: "Business development", title: "Pipeline", intro: "Move qualified work forward with a next action, not a vague feeling.", action: "New opportunity" },
  services: { eyebrow: "Offer design", title: "Services", intro: "A small, reusable catalogue for pricing proposals and understanding delivery.", action: "New service" },
  proposals: { eyebrow: "Commercial commitments", title: "Proposals", intro: "Shape an offer deliberately before it becomes delivery work.", action: "New proposal" },
};

const label = (value: unknown) => String(value ?? "—").replaceAll("_", " ");
const amount = (value: unknown, currency = "USD") => value == null ? "—" : new Intl.NumberFormat(undefined, { style: "currency", currency: String(currency) }).format(Number(value));
export const cleanBusinessValues = (values: Record<string, unknown>) => Object.fromEntries(Object.entries(values).map(([key, value]) => [key, key === "active" && typeof value === "string" ? value === "true" : typeof value === "string" ? value.trim() : value]).filter(([, value]) => value !== "" && value !== undefined));

export function BusinessWorkspace({ screen, pipelineView = "opportunities" }: { screen: Screen; pipelineView?: "opportunities" | "health" }) {
  const config = copy[screen];
  const [records, setRecords] = useState<Record<string, RecordRow[]>>({});
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<Resource | null>(null);
  const [editing, setEditing] = useState<RecordRow | null>(null);
  const [conversion, setConversion] = useState<RecordRow | null>(null);
  const [pipelineDraft, setPipelineDraft] = useState<Record<string, unknown>>({});
  const { showToast } = useToast();
  const router = useRouter();
  const loadController = useRef<AbortController | null>(null);
  const deletingLead = useRef(false);
  const required = useMemo(() => screen === "business" ? (["leads", "opportunities", "proposals", "services"] as Resource[]) : screen === "leads" ? (["leads", "opportunities"] as Resource[]) : [screen === "pipeline" ? "opportunities" : screen as Resource], [screen]);
  const load = useCallback(async (background = false) => {
    // A background refresh must not interrupt an initial load or explicit retry.
    if (background && (loadController.current || deletingLead.current)) return;
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    if (!background) { setLoading(true); setError(""); }
    try {
      if (screen === "pipeline") {
        const [opportunities, clients] = await Promise.all([readPipelineCollection("/api/business/opportunities", controller.signal), readPipelineCollection("/api/entities/clients", controller.signal)]);
        if (!controller.signal.aborted) { setRecords({ opportunities, clients }); setOverview(null); }
        return;
      }
      const responses = await Promise.all(required.map(async (resource) => {
        const rows: RecordRow[] = [];
        let page = 1;
        let total = 0;
        do {
          const response = await fetch(`/api/business/${resource}?pageSize=100&page=${page}`, { cache: "no-store", signal: controller.signal });
          const body = await response.json();
          if (!response.ok) throw new Error(body.error ?? "Business records could not be loaded.");
          rows.push(...body.records); total = body.total ?? rows.length; page += 1;
          if (!body.records.length) break;
        } while ((screen === "business" || screen === "leads") && rows.length < total);
        return [resource, rows] as const;
      }));
      if (controller.signal.aborted) return;
      setRecords(Object.fromEntries(responses));
      setError("");
      if (screen === "business") {
        const response = await fetch("/api/business/overview?horizon=this_month", { cache: "no-store", signal: controller.signal });
        const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Business overview could not be loaded.");
        if (!controller.signal.aborted) setOverview(body as Overview);
      } else setOverview(null);
    } catch (reason) { if (!controller.signal.aborted && !background) setError(reason instanceof Error ? reason.message : "Business records could not be loaded."); }
    finally {
      if (!controller.signal.aborted) setLoading(false);
      if (loadController.current === controller) loadController.current = null;
    }
  }, [required, screen]);
  useDeferredEffect(useCallback(() => { void load(); return () => loadController.current?.abort(); }, [load]));
  useDeferredEffect(useCallback(() => {
    if (screen !== "leads") return;
    // Use the existing authenticated API; no Realtime publication or extra DB access needed.
    const refresh = () => {
      if (document.visibilityState === "visible" && navigator.onLine && !editor) void load(true);
    };
    const timer = window.setInterval(refresh, 10000);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [screen, editor, load]));
  const open = (resource: Resource, record?: RecordRow) => { setEditor(resource); setEditing(record ?? null); };
  const save = async (resource: Resource, values: Record<string, unknown>) => {
    const response = await fetch(`/api/business/${resource}`, { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editing ? { ...cleanBusinessValues(values), id: editing.id } : cleanBusinessValues(values)) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "The record could not be saved.");
    const saved = body.record as RecordRow;
    setRecords((current) => ({ ...current, [resource]: editing ? (current[resource] ?? []).map((row) => row.id === saved.id ? { ...row, ...saved } : row) : [saved, ...(current[resource] ?? [])] }));
    announceWorkspaceMutation(resource === "opportunities" ? "projects" : resource === "leads" ? "clients" : "finance");
    showToast(editing ? "Business record updated." : "Business record created.", "success");
    setEditor(null); setEditing(null);
    if (screen === "business" || screen === "pipeline") await load();
  };
  const setStage = async (opportunity: RecordRow, stage: OpportunityStage) => {
    if (stage === opportunity.stage) return;
    const oldStage = opportunity.stage;
    setRecords((current) => ({ ...current, opportunities: (current.opportunities ?? []).map((row) => row.id === opportunity.id ? { ...row, stage } : row) }));
    try {
      const response = await fetch("/api/business/opportunities", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: opportunity.id, stage }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      setRecords((current) => ({ ...current, opportunities: (current.opportunities ?? []).map((row) => row.id === opportunity.id ? body.record : row) }));
      announceWorkspaceMutation("projects");
      showToast(`Moved to ${label(stage)}.`, "success");
    } catch (reason) { setRecords((current) => ({ ...current, opportunities: (current.opportunities ?? []).map((row) => row.id === opportunity.id ? { ...row, stage: oldStage } : row) })); showToast(reason instanceof Error ? reason.message : "Stage could not be changed.", "error"); throw reason; }
  };
  const convert = async (opportunity: RecordRow, values: { createClient: boolean; projectName: string }) => {
    const response = await fetch(`/api/business/opportunities/${opportunity.id}/convert`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "The opportunity could not be converted.");
    const result = body.result as { project_id: string; already_converted?: boolean };
    showToast(result.already_converted ? "This opportunity already has a project." : "Project created from won opportunity.", "success");
    setConversion(null); router.push(`/projects/${result.project_id}`); router.refresh();
  };
  const completeSalesAction = async (row: RecordRow, completed: boolean) => {
    const response = await fetch("/api/business/opportunities", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: row.id, next_action: completed ? null : row.next_action, next_action_date: completed ? null : row.next_action_date }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "The sales action could not be saved.");
    setRecords(current => ({ ...current, opportunities: (current.opportunities ?? []).map(item => item.id === row.id ? body.record : item) }));
    announceWorkspaceMutation("projects");
    showToast(completed ? "Sales action completed." : "Sales action restored.", "success");
    await load();
  };
  const patchLead = async (row: RecordRow, values: Record<string, unknown>) => {
    const response = await fetch("/api/business/leads", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: row.id, ...values }) });
    const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Lead could not be updated.");
    setRecords(current => ({ ...current, leads: (current.leads ?? []).map(item => item.id === row.id ? { ...item, ...body.record } : item) }));
    announceWorkspaceMutation("clients"); showToast("Lead updated.", "success");
  };
  const deleteLead = async (rows: RecordRow[]) => {
    deletingLead.current = true;
    // Keep old reads and polling from restoring rows during a bulk deletion.
    loadController.current?.abort();
    loadController.current = null;
    try {
      const result = await deleteLeads(rows.map(row => row.id));
      const removed = new Set(result.deletedIds);
      setRecords(current => ({ ...current, leads: (current.leads ?? []).filter(item => !removed.has(item.id)) }));
      if (removed.size) {
        announceWorkspaceMutation("clients");
        showToast(removed.size === 1 ? "Lead deleted." : `${removed.size} leads deleted.`, "success");
      }
      return result;
    } finally { deletingLead.current = false; }
  };
  if (screen === "leads") return <>
    <LeadsDashboard records={records.leads ?? []} opportunities={records.opportunities ?? []} loading={loading} error={error} onRetry={() => void load()} onImported={() => void load()} onCreate={() => open("leads")} onEdit={row => open("leads", row)} onPatch={patchLead} onDelete={deleteLead} onOpportunity={row => { setPipelineDraft({ lead_id: row.id, title: String(row.name), currency: row.currency ?? "USD", estimated_value: row.potential_value ?? "", source: row.source }); open("opportunities"); }}/>
    <BusinessEditor key={`${editor ?? "closed"}-${editing?.id ?? "new"}`} resource={editor} record={editing} defaults={editor === "opportunities" ? pipelineDraft : undefined} onClose={() => { setEditor(null); setEditing(null); }} onSave={save}/>
  </>;
  if (screen === "pipeline") return <>
    <PipelineDashboard records={records.opportunities ?? []} clients={records.clients ?? []} loading={loading} error={error} view={pipelineView} onRetry={() => void load()} onOpen={(record) => open("opportunities", record)} onCreate={(stage,currency) => { setPipelineDraft({stage,currency}); open("opportunities"); }} onStage={setStage} onConvert={setConversion} onAction={completeSalesAction}/>
    <BusinessEditor key={`${editor ?? "closed"}-${editing?.id ?? "new"}`} resource={editor} record={editing} defaults={pipelineDraft} clients={records.clients ?? []} onClose={() => { setEditor(null); setEditing(null); }} onSave={save}/>
    <ConversionEditor key={conversion?.id ?? "none"} opportunity={conversion} onClose={() => setConversion(null)} onConvert={convert}/>
  </>;
  if (screen === "business") return <>
    <BusinessDashboard records={records} overview={overview} loading={loading} error={error} onRetry={() => void load()} onOpen={open} onAction={completeSalesAction}/>
    <BusinessEditor key={`${editor ?? "closed"}-${editing?.id ?? "new"}`} resource={editor} record={editing} onClose={() => { setEditor(null); setEditing(null); }} onSave={save}/>
  </>;
  return <div className="domain-page business-workspace">
    <header className="task-context-header"><div><nav className="task-context-header__breadcrumb" aria-label="Breadcrumb"><span>Business</span><span>/</span><span className="current">{config.title}</span></nav><div className="task-context-header__title-row"><h1>{config.title}</h1></div><p className="task-context-header__description">{config.intro}</p></div><div className="task-context-header__actions">{config.action ? <Button intent="brand" onClick={() => open(screen as Resource)}><Icons.Plus size={14}/>{config.action}</Button> : <nav className="business-header-links" aria-label="Business sections"><Link href="/leads">Leads</Link><Link href="/pipeline">Pipeline</Link><Link href="/proposals">Proposals</Link><Link href="/services">Services</Link></nav>}</div></header>
    {error ? <div className="inline-error" role="alert"><p>{error}</p><Button emphasis="outline" onClick={() => void load()}>Try again</Button></div> : null}
    {loading ? <div className="empty-state" aria-live="polite"><span>···</span><h2>Reading the business picture</h2></div> : screen === "services" ? <Services records={records.services ?? []} onEdit={(record) => open("services", record)} /> : <Proposals records={records.proposals ?? []} onEdit={(record) => open("proposals", record)} />}
    <BusinessEditor key={`${editor ?? "closed"}-${editing?.id ?? "new"}`} resource={editor} record={editing} onClose={() => { setEditor(null); setEditing(null); }} onSave={save}/>
    <ConversionEditor key={conversion?.id ?? "none"} opportunity={conversion} onClose={() => setConversion(null)} onConvert={convert}/>
  </div>;
}

function Services({ records, onEdit }: { records: RecordRow[]; onEdit: (row: RecordRow) => void }) { const [selected, setSelected] = useState<RecordRow | null>(null); return <><BusinessList rows={records} empty="No services yet. Add the work you can price and deliver repeatedly." columns={["Service", "Pricing", "Default price"]} values={(row) => [String(row.name), label(row.pricing_type), amount(row.default_price, String(row.currency ?? "USD"))]} onEdit={(row) => { setSelected(row); onEdit(row); }}/>{selected ? <section className="data-surface"><div className="integration-actions"><p className="eyebrow">Service detail · {String(selected.name)}</p><Button emphasis="ghost" onClick={() => setSelected(null)}>Close performance</Button></div><ServiceAnalytics serviceId={selected.id}/></section> : null}</>; }
function Proposals({ records, onEdit }: { records: RecordRow[]; onEdit: (row: RecordRow) => void }) { return <BusinessList rows={records} empty="No proposals yet. Create a draft when an opportunity needs a clear commercial offer." columns={["Proposal", "Status", "Total"]} values={(row) => [String(row.proposal_number ?? row.title), label(row.status), amount(row.total, String(row.currency ?? "USD"))]} onEdit={onEdit}/>; }
function BusinessList({ rows, columns, values, empty, onEdit }: { rows: RecordRow[]; columns: string[]; values: (row: RecordRow) => string[]; empty: string; onEdit: (row: RecordRow) => void }) { return <section className="data-surface"><div className="data-header">{columns.map((column) => <span key={column}>{column}</span>)}</div>{rows.length ? rows.map((row) => <button type="button" className="data-row data-row--button" onClick={() => onEdit(row)} key={row.id}>{values(row).map((value, index) => index === 0 ? <strong key={index}>{value}</strong> : <span key={index}>{value}</span>)}<Icons.MoreHorizontal size={17}/></button>) : <div className="empty-state"><span>∅</span><h2>{empty}</h2></div>}</section>; }

export function BusinessEditor({ resource, record, defaults, clients = [], onClose, onSave }: { resource: Resource | null; record: RecordRow | null; clients?: RecordRow[]; defaults?: Record<string, unknown>; onClose: () => void; onSave: (resource: Resource, values: Record<string, unknown>) => Promise<void> }) {
  const [values, setValues] = useState<Record<string, unknown>>({}); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const saveLock = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const key = `${resource ?? "none"}-${record?.id ?? "new"}`;
  const initial = useMemo(() => ({ ...editorValues(resource, null), ...defaults, ...(record ? editorValues(resource, record) : {}) }), [resource, record, defaults]);
  if (!resource) return null;
  const update = (field: string, value: unknown) => setValues((current) => ({ ...(Object.keys(current).length ? current : initial), [field]: value }));
  const current = Object.keys(values).length ? values : initial;
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (saveLock.current) return; setError(""); formRef.current?.querySelectorAll("[aria-invalid]").forEach(node => node.removeAttribute("aria-invalid")); const parsed = businessResourceSchemas[resource].safeParse(resource === "services" ? { ...current, active: current.active === true || current.active === "true" } : current); if (!parsed.success) { const issue = parsed.error.issues[0]; const fieldName = String(issue.path[0]); const friendly: Record<string,string> = { title: "Enter a title for this record.", name: "Enter a name for this record.", currency: "Enter a three-letter currency code, such as USD.", probability: "Enter a whole probability from 0 to 100.", estimated_value: "Enter an estimated value of zero or more.", email: "Enter a valid email address.", expected_close_date: "Enter a valid expected close date.", next_action_date: "Enter a valid next action date.", client_id: "Choose a client from your workspace." }; setError(friendly[fieldName] ?? "Review the highlighted field and try again."); const field = formRef.current?.querySelector<HTMLElement>(`#business-${String(issue.path[0])}`); field?.setAttribute("aria-invalid","true"); field?.setAttribute("aria-describedby","business-editor-error"); field?.focus(); return; } saveLock.current = true; setSaving(true); try { await onSave(resource, parsed.data); setValues({}); } catch (reason) { setError(reason instanceof Error ? reason.message : "Changes could not be saved."); } finally { saveLock.current = false; setSaving(false); } };
  return <Modal key={key} open onClose={() => { if (!saveLock.current) onClose(); }} title={record ? `Edit ${singular(resource)}` : `New ${singular(resource)}`} description="Business records remain private to this workspace."><form ref={formRef} className="simple-form business-editor" onSubmit={submit} noValidate>{resource === "leads" ? <LeadFields values={current} update={update}/> : resource === "opportunities" ? <OpportunityFields values={current} update={update} clients={clients}/> : resource === "services" ? <ServiceFields values={current} update={update}/> : <ProposalFields values={current} update={update}/>} {error ? <p id="business-editor-error" className="field-error" role="alert">{error}</p> : null}<div className="modal__actions"><Button emphasis="ghost" disabled={saving} onClick={onClose}>Cancel</Button><Button intent="brand" type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button></div></form></Modal>;
}
function ConversionEditor({ opportunity, onClose, onConvert }: { opportunity: RecordRow | null; onClose: () => void; onConvert: (opportunity: RecordRow, values: { createClient: boolean; projectName: string }) => Promise<void> }) { const [projectName, setProjectName] = useState(""); const [createClient, setCreateClient] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); if (!opportunity) return null; return <Modal open onClose={onClose} title="Create project" description="Create delivery work from this won opportunity. The operation is idempotent, so a retry will return the existing project."><form noValidate className="simple-form" onSubmit={(event) => { event.preventDefault(); setBusy(true); setError(""); void onConvert(opportunity, { projectName, createClient }).catch((reason) => setError(reason instanceof Error ? reason.message : "The project could not be created.")).finally(() => setBusy(false)); }}><label htmlFor="conversion-project">Project name<input id="conversion-project" value={projectName} placeholder={String(opportunity.title)} onChange={(event) => setProjectName(event.target.value)}/></label><label className="business-check"><input type="checkbox" checked={createClient} onChange={(event) => setCreateClient(event.target.checked)}/>Create a client from this lead when no client is linked</label>{error ? <p className="field-error" role="alert">{error}</p> : null}<div className="modal__actions"><Button emphasis="ghost" onClick={onClose}>Cancel</Button><Button intent="brand" type="submit" disabled={busy}>{busy ? "Creating…" : "Create project"}</Button></div></form></Modal>; }
const singular = (resource: Resource) => resource === "opportunities" ? "opportunity" : resource.slice(0, -1);
function editorValues(resource: Resource | null, record: RecordRow | null) { const defaults: Record<Resource, Record<string, unknown>> = { leads: { name: "", company: "", email: "", phone: "", source: "other", status: "new", potential_value: "", currency: "USD", notes: "" }, opportunities: { title: "", stage: "new", estimated_value: "", currency: "USD", probability: "", expected_close_date: "", source: "", project_type: "", next_action: "", next_action_date: "" }, services: { name: "", description: "", category: "", default_price: "", currency: "USD", pricing_type: "custom", estimated_hours: "", active: "true" }, proposals: { title: "", proposal_number: "", status: "draft", currency: "USD", discount_amount: "0", tax_amount: "0", valid_until: "", timeline: "", notes: "", terms: "", items: record?.items ?? [] } }; const base = resource ? defaults[resource] : {}; return { ...base, ...Object.fromEntries(Object.entries(record ?? {}).map(([key, value]) => [key, key === "items" ? value : value == null ? "" : String(value)])) }; }
function Field({ id, label: text, value, update, type = "text", options, disabled = false }: { id: string; label: string; value: unknown; update: (id: string, value: unknown) => void; type?: "text" | "number" | "date" | "textarea"; options?: readonly string[]; disabled?: boolean }) { const stringValue = String(value ?? ""); return <label htmlFor={`business-${id}`}>{text}{id === "currency" ? <CurrencySelect id={`business-${id}`} value={stringValue} styled onValueChange={value=>update(id,value)}/> : type === "textarea" ? <textarea className="resize-none" id={`business-${id}`} rows={4} value={stringValue} onChange={(event) => update(id, event.target.value)}/> : options ? <StyledSelect disabled={disabled} id={`business-${id}`} label={text} value={stringValue} onChange={value=>update(id,value)} options={options.map(option=>({value:option,label:label(option).replace(/^./,char=>char.toUpperCase())}))}/> : <input id={`business-${id}`} type={type} value={stringValue} onChange={(event) => update(id, event.target.value)}/>}</label>; }
function LeadFields({ values, update }: { values: Record<string, unknown>; update: (id: string, value: unknown) => void }) { return <><Field id="name" label="Name" value={values.name} update={update}/><Field id="company" label="Company" value={values.company} update={update}/><Field id="city" label="City" value={values.city} update={update}/><Field id="email" label="Email" value={values.email} update={update}/><Field id="phone" label="Phone" value={values.phone} update={update}/><Field id="source" label="Source" disabled={values.source === "clinahir" && Boolean(values.external_id)} value={values.source} update={update} options={["referral","instagram","website","email","whatsapp_manual","networking","existing_client","other","clinahir"]}/><Field id="status" label="Status" value={values.status} update={update} options={["new","contacted","qualified","unqualified","converted","lost"]}/><Field id="currency" label="Currency" value={values.currency} update={update} options={["USD","MAD"]}/><Field id="potential_value" label="Potential value" value={values.potential_value} update={update} type="number"/><Field id="notes" label="Notes" value={values.notes} update={update} type="textarea"/></>; }
function OpportunityFields({ values, update, clients }: { values: Record<string, unknown>; update: (id: string, value: unknown) => void; clients: RecordRow[] }) { return <><Field id="title" label="Opportunity" value={values.title} update={update}/><label htmlFor="business-client_id">Client<StyledSelect id="business-client_id" label="Client" value={String(values.client_id ?? "")} onChange={value=>update("client_id",value)} searchable options={[{value:"",label:"No linked client"},...(values.client_id&&!clients.some(client=>client.id===values.client_id)?[{value:String(values.client_id),label:"Linked client"}]:[]),...clients.map(client=>({value:client.id,label:String(client.name)}))]}/></label><Field id="currency" label="Currency" value={values.currency} update={update} options={["USD","MAD"]}/><Field id="stage" label="Stage" value={values.stage} update={update} options={opportunityStages}/><Field id="estimated_value" label="Estimated value" value={values.estimated_value} update={update} type="number"/><Field id="probability" label="Probability (0–100)" value={values.probability} update={update} type="number"/><Field id="expected_close_date" label="Expected close" value={values.expected_close_date} update={update} type="date"/><Field id="next_action" label="Next action" value={values.next_action} update={update}/><Field id="next_action_date" label="Next action date" value={values.next_action_date} update={update} type="date"/></>; }
function ServiceFields({ values, update }: { values: Record<string, unknown>; update: (id: string, value: unknown) => void }) { return <><Field id="name" label="Service" value={values.name} update={update}/><Field id="description" label="Description" value={values.description} update={update} type="textarea"/><Field id="category" label="Category" value={values.category} update={update}/><Field id="pricing_type" label="Pricing" value={values.pricing_type} update={update} options={["fixed","hourly","monthly","custom"]}/><Field id="default_price" label="Default price" value={values.default_price} update={update} type="number"/><Field id="estimated_hours" label="Estimated hours" value={values.estimated_hours} update={update} type="number"/></>; }
function ProposalFields({ values, update }: { values: Record<string, unknown>; update: (id: string, value: unknown) => void }) { const items = Array.isArray(values.items) ? values.items as Array<Record<string, unknown>> : []; const patch = (index: number, field: string, value: unknown) => update("items", items.map((item, position) => position === index ? { ...item, [field]: value } : item)); const totals = proposalTotals(items.map((item) => ({ quantity: Number(item.quantity ?? 1), unit_price: Number(item.unit_price ?? 0) })), Number(values.discount_amount ?? 0), Number(values.tax_amount ?? 0)); return <><Field id="title" label="Proposal title" value={values.title} update={update}/><Field id="proposal_number" label="Proposal number" value={values.proposal_number} update={update}/><Field id="status" label="Status" value={values.status} update={update} options={["draft","sent","accepted","rejected","expired"]}/><Field id="valid_until" label="Valid until" value={values.valid_until} update={update} type="date"/><div className="proposal-lines"><div><p className="eyebrow">Line items</p><Button emphasis="outline" onClick={() => update("items", [...items, { title: "", quantity: 1, unit_price: 0, position: items.length }])}>Add line</Button></div>{items.length ? items.map((item, index) => <div className="proposal-line" key={index}><label>Item<input value={String(item.title ?? "")} onChange={(event) => patch(index, "title", event.target.value)}/></label><label>Qty<input type="number" min="0.01" value={String(item.quantity ?? 1)} onChange={(event) => patch(index, "quantity", event.target.value)}/></label><label>Unit price<input type="number" min="0" value={String(item.unit_price ?? 0)} onChange={(event) => patch(index, "unit_price", event.target.value)}/></label><Button emphasis="ghost" onClick={() => update("items", items.filter((_, position) => position !== index))}>Remove</Button></div>) : <p className="dataset-note">Add the services or deliverables included in this proposal.</p>}<p className="proposal-total">Subtotal {amount(totals.subtotal, String(values.currency ?? "USD"))} · Total {amount(totals.total, String(values.currency ?? "USD"))}</p></div><Field id="discount_amount" label="Discount" value={values.discount_amount} update={update} type="number"/><Field id="tax_amount" label="Tax" value={values.tax_amount} update={update} type="number"/><Field id="timeline" label="Timeline" value={values.timeline} update={update} type="textarea"/><Field id="notes" label="Notes" value={values.notes} update={update} type="textarea"/><Field id="terms" label="Terms" value={values.terms} update={update} type="textarea"/></>; }

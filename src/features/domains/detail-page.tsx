"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { AttachmentSection } from "@/components/attachment-section";
import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useDeferredEffect } from "@/lib/use-deferred-effect";
import type { AttachmentEntityType } from "@/lib/attachment-policy";

type Item = Record<string, unknown> & { id: string };
type ProjectData = { project: Item; related: Record<string, Item[]>;finance?:Record<string,number|null>;focusMinutes?:number };
type ClientData = { client: Item; related: Record<string, Item[]>;finance:Record<string,number|null>;relationship:{activeProjects:number;lastContactAt:string|null;nextFollowupAt:string|null} };
const detailAttachmentEntities: Partial<Record<string, AttachmentEntityType>> = { tasks:"task",projects:"project",clients:"client",notes:"note",content:"content",decisions:"decision",invoices:"invoice" };

export function DetailPage({ domain, id }: { domain: string; id: string }) {
  const [data, setData] = useState<ProjectData | null>(null);
  const [record, setRecord] = useState<Item | null>(null);
  const [clientData,setClientData]=useState<ClientData|null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("tasks");
  const [fileCount, setFileCount] = useState<number | null>(null);
  const load = useCallback(async () => {
    try {
      const url = domain === "projects" ? `/api/projects/${id}` : domain==="clients"?`/api/clients/${id}`:`/api/entities/${domain}/${id}`;
      const response = await fetch(url, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      if (domain === "projects") setData(body);
      else if(domain==="clients")setClientData(body);
      else setRecord(body.record);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Record could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [domain, id]);
  useDeferredEffect(useCallback(() => { void load(); }, [load]));

  if (loading) return <State title="Loading workspace" />;
  if (error) return <State title="Workspace unavailable" copy={error} retry={load} />;
  if(domain==="clients"&&clientData)return <ClientDetail data={clientData}/>;
  if (domain !== "projects" && record) return <GenericDetail domain={domain} record={record} />;
  if (!data) return null;
  const { project, related } = data;
  const items = related[tab] ?? [];
  return <div className="detail-page">
    <Link className="back-link" href="/projects">← Back to projects</Link>
    <header className="detail-header"><div><p className="eyebrow">Project · {String(project.status)}</p><h1>{String(project.name)}</h1><p>{String(project.description ?? "A focused workspace for the context and work that moves this forward.")}</p></div><Link className="button button--solid button--brand" href="/tasks">Add next action</Link></header>
    <div className="detail-tabs">{["tasks", "notes", "milestones", "decisions", "content", "invoices", "expenses", "files", "activity"].map((name) => <button className={tab === name ? "active" : ""} onClick={() => setTab(name)} key={name}>{name[0].toUpperCase() + name.slice(1)} <span>{name === "files" && fileCount !== null ? fileCount : related[name]?.length ?? 0}</span></button>)}</div>
    <div className="detail-grid"><section>{tab === "files" ? <AttachmentSection entityType="project" entityId={id} title="Project files" onCountChange={setFileCount}/> : <><p className="eyebrow">Linked {tab}</p><h2>{items.length ? `${items.length} connected item${items.length === 1 ? "" : "s"}.` : `No linked ${tab} yet.`}</h2>{items.map((item) => <RelatedItem item={item} tab={tab} key={item.id}/>)}</>}</section>
      <aside><p className="eyebrow">Project signal</p><div className="milestone"><span><i style={{ width: `${Number(project.progress ?? 0)}%` }} /></span><strong>{String(project.progress ?? 0)}%</strong><small>{project.target_date ? `Target · ${new Date(String(project.target_date)).toLocaleDateString()}` : "No target date"}</small></div><div className="signal-row"><Icons.ListTodo size={17} /><span><strong>Open tasks</strong>{related.tasks.filter((task) => task.status !== "completed").length}</span></div><div className="signal-row"><Icons.Clock3 size={17} /><span><strong>Waiting</strong>{related.waiting?.length??0}</span></div><div className="context-rule"/><p className="eyebrow">Financial overview</p>{data.finance?<><div className="signal-row"><span><strong>Received</strong>{Number(data.finance.received).toLocaleString()} {String(project.currency??"MAD")}</span></div><div className="signal-row"><span><strong>Outstanding</strong>{Number(data.finance.outstanding).toLocaleString()} {String(project.currency??"MAD")}</span></div><div className="signal-row"><span><strong>Estimated gross margin</strong>{data.finance.estimatedGrossMargin==null?"Not enough data":`${Number(data.finance.estimatedGrossMargin).toFixed(1)}%`}</span></div></>:null}<div className="signal-row"><span><strong>Focus time</strong>{data.focusMinutes??0} minutes</span></div></aside></div>
  </div>;
}

function ClientDetail({data}:{data:ClientData}){const[tab,setTab]=useState("projects");const[fileCount,setFileCount]=useState<number|null>(null);const items=data.related[tab]??[];return <div className="detail-page"><Link className="back-link" href="/clients">← Back to clients</Link><header className="detail-header"><div><p className="eyebrow">Client command center · {data.relationship.activeProjects} active project{data.relationship.activeProjects===1?"":"s"}</p><h1>{String(data.client.name)}</h1><p>{String(data.client.company??data.client.notes??"Relationship workspace")}</p><small>Last contact {formatSignalDate(data.relationship.lastContactAt)} · Next follow-up {formatSignalDate(data.relationship.nextFollowupAt)}</small></div><Link className="button button--solid button--brand" href="/followups">Add follow-up</Link></header><section className="metric-ledger metric-ledger--four"><div><strong>{Number(data.finance.received).toLocaleString()} MAD</strong><span>Lifetime received</span></div><div><strong>{Number(data.finance.outstanding).toLocaleString()} MAD</strong><span>Outstanding</span></div><div><strong>{Number(data.finance.overdue).toLocaleString()} MAD</strong><span>Overdue</span></div><div><strong>{data.finance.averagePaymentDelay==null?"—":`${Number(data.finance.averagePaymentDelay).toFixed(1)} days`}</strong><span>Average payment delay</span></div></section><div className="detail-tabs">{["projects","tasks","followups","waiting","notes","content","invoices","payments","files","timeline"].map((name)=><button className={tab===name?"active":""} onClick={()=>setTab(name)} key={name}>{name} <span>{name==="files"&&fileCount!==null?fileCount:data.related[name]?.length??0}</span></button>)}</div><section className="client-timeline">{tab==="files"?<AttachmentSection entityType="client" entityId={String(data.client.id)} title="Client files" onCountChange={setFileCount}/>:<><p className="eyebrow">{tab}</p>{items.length?items.map((item)=><RelatedItem item={item} tab={tab} key={item.id}/>):<div className="empty-state"><span>∅</span><h2>No linked {tab}</h2></div>}</>}</section></div>}

function RelatedItem({item,tab}:{item:Item;tab:string}){const content=<><Icons.FileText size={17}/><span><strong>{String(item.title??item.name??item.invoice_number??item.reference??tab.slice(0,-1))}</strong>{String(item.status??item.decision??item.content??item.due_date??item.created_at??"")}</span></>;if(tab==="files"&&item.url)return <a className="signal-row" href={String(item.url)} target="_blank" rel="noreferrer">{content}</a>;if(tab==="activity"||tab==="timeline")return <div className="signal-row">{content}</div>;return <Link className="signal-row" href={`/${tab}/${item.id}`}>{content}</Link>}
function formatSignalDate(value:string|null){return value?new Date(value).toLocaleDateString():"not recorded"}

function State({ title, copy, retry }: { title: string; copy?: string; retry?: () => Promise<void> }) {
  return <div className="empty-state"><span>···</span><h2>{title}</h2>{copy ? <p>{copy}</p> : null}{retry ? <Button emphasis="outline" onClick={() => void retry()}>Try again</Button> : null}</div>;
}
function GenericDetail({ domain, record }: { domain: string; record: Item }) {
  const title = String(record.title ?? record.name ?? record.activity_type ?? record.raw_text ?? "Record");
  const entity = detailAttachmentEntities[domain];
  return <div className="detail-page"><Link className="back-link" href={`/${domain}`}>← Back to {domain}</Link><header className="detail-header"><div><p className="eyebrow">{domain}</p><h1>{title}</h1><p>{String(record.description ?? record.content ?? record.notes ?? "Saved in your private workspace.")}</p></div></header>{entity?<AttachmentSection entityType={entity} entityId={record.id}/>:null}</div>;
}

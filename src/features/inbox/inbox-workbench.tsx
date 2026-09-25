"use client";
import { StyledSelect } from "@/components/ui/styled-select";

import { useMemo, useState } from "react";
import type { DomainRecord } from "@/lib/domains";
import { Icons } from "@/components/icons";
import "./inbox-workbench.css";

type Props = {
  rows: DomainRecord[];
  query: string;
  setQuery: (value: string) => void;
  onCapture: () => void;
  onEdit: (record: DomainRecord) => void;
  onResolve: (record: DomainRecord) => Promise<void>;
  loading: boolean;
};

const kinds = ["All", "Tasks", "Notes", "Ideas", "Mentions", "Archive"] as const;
const day = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
const text = (value: unknown) => String(value ?? "");
const title = (record: DomainRecord) => text(record.raw_text).split("\n")[0].trim() || "Untitled capture";
const typeLabel = (record: DomainRecord) => text(record.detected_type || "inbox").replaceAll("_", " ");

export function InboxWorkbench({ rows, query, setQuery, onCapture, onEdit, onResolve, loading }: Props) {
  const [kind, setKind] = useState<(typeof kinds)[number]>("All");
  const [timeFilter, setTimeFilter] = useState("All dates");
  const [scope, setScope] = useState("Inbox");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const today = day(new Date());
  const count = (label: string) => rows.filter(record => label === "All" ? record.status !== "archived" : label === "Archive" ? record.status === "archived" : label === "Tasks" ? record.detected_type === "task" : label === "Notes" ? record.detected_type === "note" : label === "Ideas" ? record.detected_type === "idea" : record.detected_type === "mention").length;
  const visible = useMemo(() => rows.filter(record => {
    const date = new Date(text(record.created_at));
    const age = today - day(date);
    const kindMatch = kind === "All" ? record.status !== "archived" : kind === "Archive" ? record.status === "archived" : kind === "Tasks" ? record.detected_type === "task" : kind === "Notes" ? record.detected_type === "note" : kind === "Ideas" ? record.detected_type === "idea" : record.detected_type === "mention";
    const timeMatch = timeFilter === "All dates" || timeFilter === "Today" && age === 0 || timeFilter === "This week" && age >= 0 && age < 7 * 86400000 || timeFilter === "Later" && age >= 7 * 86400000;
    const scopeMatch = scope === "Inbox" || scope === "Created by me" && text(record.created_by) === "user" || scope === "Assigned to me" && text(record.assigned_to) !== "";
    return kindMatch && timeMatch && scopeMatch;
  }).sort((a, b) => new Date(text(b.created_at)).getTime() - new Date(text(a.created_at)).getTime()), [rows, kind, timeFilter, scope, today]);
  const selected = visible.find(record => record.id === selectedId) ?? null;
  const groups = [
    ["Today", visible.filter(record => today - day(new Date(text(record.created_at))) === 0)],
    ["Yesterday", visible.filter(record => today - day(new Date(text(record.created_at))) === 86400000)],
    ["Earlier", visible.filter(record => today - day(new Date(text(record.created_at))) > 86400000 || Number.isNaN(new Date(text(record.created_at)).getTime()))],
  ] as const;
  async function clear(record: DomainRecord) { setResolving(true); try { await onResolve(record); } finally { setResolving(false); } }

  return <div className={`inbox-ui ${selected ? "inbox-ui--detail-open" : ""}`}>
    <section className="inbox-ui__list" aria-label="Captured items">
      <div className="inbox-ui__listbar"><div className="inbox-ui__scopes">{["Inbox", "Assigned to me", "Created by me"].map(label => <button key={label} className={scope === label ? "is-active" : ""} onClick={() => setScope(label)}>{label === "Inbox" ? <Icons.Inbox size={15}/> : label === "Assigned to me" ? <Icons.Users size={15}/> : <Icons.FileText size={15}/>} {label}</button>)}</div></div>
      <div className="inbox-ui__tools"><div><div><span className="sr-only">Category</span><StyledSelect label="Category" value={kind} onChange={next=>setKind(next as typeof kind)} options={kinds.map(item=>({value:item,label:`${item} (${count(item)})`}))}/></div><label><span className="sr-only">Date filter</span><StyledSelect label="Date filter" value={timeFilter} onChange={setTimeFilter} options={["All dates","Today","This week","Later"].map(item=>({value:item,label:item}))}/></label></div><button className="inbox-ui__capture" onClick={onCapture}><Icons.Plus size={16}/> Capture</button></div>
      <div className="inbox-ui__search"><Icons.Search size={16}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search captured items" aria-label="Search captured items"/>{query && <button onClick={() => setQuery("")} aria-label="Clear search"><Icons.X size={14}/></button>}</div>
      {loading ? <p className="inbox-ui__empty">Loading inbox…</p> : visible.length ? <div className="inbox-ui__groups">{groups.map(([label, items]) => items.length ? <div className="inbox-ui__group" key={label}><h2>{label}<span>{items.length}</span></h2>{items.map(record => <button className={`inbox-ui__row ${selected?.id === record.id ? "is-selected" : ""}`} key={record.id} onClick={() => setSelectedId(record.id)}><span className="inbox-ui__rowicon"><Icons.Inbox size={17}/></span><span className="inbox-ui__rowcopy"><strong>{title(record)}</strong><small>{text(record.raw_text).replaceAll("\n", " ")}</small></span><span className={`inbox-ui__tag inbox-ui__tag--${typeLabel(record)}`}>{typeLabel(record)}</span><time>{new Date(text(record.created_at)).toLocaleDateString([], {month:"short",day:"numeric"})}</time></button>)}</div> : null)}</div> : <div className="inbox-ui__empty"><Icons.Inbox size={28}/><h2>Nothing in this view</h2><p>Capture something new or change the filters.</p><button onClick={onCapture}>Capture an item</button></div>}
    </section>
    {selected && <aside className="inbox-ui__detail" aria-label="Selected inbox item">
      <><div className="inbox-ui__detailhead"><span className="inbox-ui__detailicon"><Icons.Inbox size={24}/></span><div><h2>{title(selected)}</h2><p>Captured {new Date(text(selected.created_at)).toLocaleString([], {dateStyle:"medium",timeStyle:"short"})}</p></div><button className="inbox-ui__iconbutton" onClick={() => setSelectedId(null)} title="Close details" aria-label="Close details"><Icons.X size={19}/></button></div>
        <div className="inbox-ui__meta"><span className="inbox-ui__tag inbox-ui__tag--detail">{typeLabel(selected)}</span><span className={`inbox-ui__status ${selected.status === "processed" ? "is-done" : ""}`}>{selected.status === "processed" ? "Cleared" : "To triage"}</span></div>
        <div className="inbox-ui__description">{text(selected.raw_text)}</div>
        <div className="inbox-ui__detailsection"><div className="inbox-ui__sectionhead"><h3>Triage</h3><span>Turn this capture into a home</span></div><div className="inbox-ui__steps"><div><span className="is-done"><Icons.Check size={13}/></span><p>Captured in your inbox</p></div><div><span className="is-done"><Icons.Check size={13}/></span><p>Type identified as <strong>{typeLabel(selected)}</strong></p></div><div><span className={selected.status === "processed" ? "is-done" : ""}>{selected.status === "processed" ? <Icons.Check size={13}/> : null}</span><p>{selected.status === "processed" ? "Cleared from triage" : "Clear when it has a home"}</p></div></div></div>
        <div className="inbox-ui__detailactions"><button onClick={() => onEdit(selected)}><Icons.Settings size={16}/> Organize</button>{selected.status !== "processed" && <button className="is-primary" onClick={() => void clear(selected)} disabled={resolving}><Icons.Check size={16}/>{resolving ? "Clearing…" : "Clear item"}</button>}</div>
      </>
    </aside>}
  </div>;
}

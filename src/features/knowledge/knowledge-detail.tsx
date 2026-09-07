"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { sourceFreshness } from "@/lib/knowledge";
import { useDeferredEffect } from "@/lib/use-deferred-effect";

type Row = Record<string, unknown>;
type Relation = "supports" | "contradicts" | "context" | "weak_support";
const label = (value: unknown) => String(value ?? "").replaceAll("_", " ");

export function KnowledgeDetail({ kind, id }: { kind: "sources" | "findings"; id: string }) {
  const [item, setItem] = useState<Row | null>(null);
  const [evidence, setEvidence] = useState<Row[]>([]);
  const [sources, setSources] = useState<Row[]>([]);
  const [notes, setNotes] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [editingEvidence, setEditingEvidence] = useState<Row | null>(null);
  const load = useCallback(async () => {
    const list = await fetch(`/api/knowledge/${kind}`, { cache: "no-store" });
    const body = await list.json();
    const found = (body.items ?? []).find((row: Row) => row.id === id);
    if (!list.ok || !found) { setError("Knowledge record is unavailable."); return; }
    setItem(found); setError("");
    const noteType = kind === "sources" ? "source" : "finding";
    const noteResponse = await fetch(`/api/knowledge/notes?target_type=${noteType}&target_id=${id}`, { cache: "no-store" });
    if (noteResponse.ok) setNotes((await noteResponse.json()).items ?? []);
    if (kind === "findings") {
      const [evidenceResponse, sourceResponse] = await Promise.all([fetch("/api/knowledge/evidence", { cache: "no-store" }), fetch("/api/knowledge/sources", { cache: "no-store" })]);
      const [evidenceBody, sourceBody] = await Promise.all([evidenceResponse.json(), sourceResponse.json()]);
      setEvidence((evidenceBody.items ?? []).filter((row: Row) => row.finding_id === id));
      setSources(sourceBody.items ?? []);
    }
  }, [id, kind]);
  useDeferredEffect(useCallback(() => { void load(); }, [load]));
  const patch = async (values: Row) => {
    const response = await fetch(`/api/knowledge/${kind}/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    if (!response.ok) { setError("Changes could not be saved."); return false; }
    await load(); return true;
  };
  if (!item) return <main className="domain-page"><p className="dataset-note">{error || "Loading knowledge…"}</p></main>;
  if (kind === "sources") return <SourceDetail item={item} notes={notes} error={error} editOpen={editOpen} onEdit={() => setEditOpen(true)} onClose={() => setEditOpen(false)} onRefresh={() => void patch({ accessed_at: new Date().toISOString() })} onSave={async (values) => { if (await patch(values)) setEditOpen(false); }} onReload={load} />;
  const groups: Array<[string, Row[]]> = [["Supporting evidence", evidence.filter((row) => ["supports", "weak_support"].includes(String(row.relation_type)))], ["Contradictory evidence", evidence.filter((row) => row.relation_type === "contradicts")], ["Context", evidence.filter((row) => row.relation_type === "context")]];
  return <main className="domain-page knowledge-detail">
    <p className="eyebrow">Finding · {label(item.status)}</p><h1>{String(item.title)}</h1><p>{String(item.summary || "No finding summary.")}</p>
    <div className="strategy-actions"><Button emphasis="outline" onClick={() => setEditOpen(true)}>Edit</Button>{(["supported", "mixed", "contradicted", "superseded"] as const).map((status) => <Button key={status} emphasis="outline" onClick={() => void patch({ status })}>Mark {status}</Button>)}<Button intent="brand" onClick={() => { setEditingEvidence(null); setEvidenceOpen(true); }}>Add evidence</Button></div>
    <p className="dataset-note">{groups[0][1].length} supporting source{groups[0][1].length === 1 ? "" : "s"} · {groups[1][1].length} contradicting source{groups[1][1].length === 1 ? "" : "s"}</p>
    {groups.map(([title, rows]) => <EvidenceGroup key={title} title={title} rows={rows} sources={sources} onEdit={(row) => { setEditingEvidence(row); setEvidenceOpen(true); }} onRemove={async (evidenceId) => { const response = await fetch(`/api/knowledge/evidence/${evidenceId}`, { method: "DELETE" }); if (!response.ok) setError("Evidence could not be removed."); else await load(); }} />)}
    <KnowledgeNotesPanel targetType="finding" targetId={id} notes={notes} onChanged={load} />
    {editOpen ? <FindingEdit item={item} onClose={() => setEditOpen(false)} onSave={async (values) => { if (await patch(values)) setEditOpen(false); }} /> : null}
    {evidenceOpen ? <EvidenceForm sources={sources} initial={editingEvidence} onClose={() => setEvidenceOpen(false)} onSave={async (sourceId, relation) => { const response = await fetch(editingEvidence ? `/api/knowledge/evidence/${editingEvidence.id}` : "/api/knowledge/evidence", { method: editingEvidence ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editingEvidence ? { relation_type: relation } : { finding_id: id, source_id: sourceId, relation_type: relation }) }); if (!response.ok) { setError("Evidence could not be saved."); return; } setEvidenceOpen(false); await load(); }} /> : null}
    {error ? <p role="alert" className="field-error">{error}</p> : null}
  </main>;
}

function EvidenceGroup({ title, rows, sources, onEdit, onRemove }: { title: string; rows: Row[]; sources: Row[]; onEdit: (row: Row) => void; onRemove: (id: string) => void }) {
  return <section className="data-surface knowledge-section" aria-label={title}><p className="eyebrow">{title}</p>{rows.length ? <div className="signal-stack">{rows.map((row) => { const source = sources.find((candidate) => candidate.id === row.source_id); return <article className="signal-row knowledge-evidence" key={String(row.id)}><span><strong>{String(source?.title ?? "Source")}</strong><small>{label(row.relation_type)}{row.relation_type === "weak_support" ? " · limited weight" : ""} · {label(sourceFreshness(source?.freshness_expires_at as string | null))} · {String(source?.reliability ?? "unrated")}</small></span><div className="integration-actions">{source?.url ? <a className="button button--ghost" href={String(source.url)} target="_blank" rel="noreferrer">Open</a> : null}<Button emphasis="ghost" aria-label={`Change relation for ${String(source?.title ?? "source")}`} onClick={() => onEdit(row)}>Change relation</Button><Button emphasis="ghost" aria-label={`Remove ${String(source?.title ?? "source")} evidence`} onClick={() => onRemove(String(row.id))}>Remove</Button></div></article>; })}</div> : <p className="dataset-note">None linked.</p>}</section>;
}

function EvidenceForm({ sources, initial, onClose, onSave }: { sources: Row[]; initial: Row | null; onClose: () => void; onSave: (sourceId: string, relation: Relation) => Promise<void> }) {
  const [source, setSource] = useState(String(initial?.source_id ?? "")); const [relation, setRelation] = useState<Relation>((initial?.relation_type as Relation) ?? "supports"); const [query, setQuery] = useState("");
  const choices = sources.filter((row) => [row.title, row.publisher, row.author, row.source_type].some((value) => String(value ?? "").toLowerCase().includes(query.toLowerCase())));
  return <Modal open onClose={onClose} title={initial ? "Change evidence relation" : "Add evidence"}><form className="simple-form" onSubmit={(event) => { event.preventDefault(); if (source) void onSave(source, relation); }}><label>Search sources<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title, publisher, author, or type" /></label><label>Source<select value={source} disabled={Boolean(initial)} onChange={(event) => setSource(event.target.value)}><option value="">{sources.length ? "Select an owned source" : "No sources available yet"}</option>{choices.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.title)} · {String(row.source_type)}</option>)}</select></label>{!sources.length ? <Link href="/knowledge" className="button button--outline">Add source</Link> : null}<label>Relation<select value={relation} onChange={(event) => setRelation(event.target.value as Relation)}>{(["supports", "contradicts", "context", "weak_support"] as const).map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label><div className="modal__actions"><Button emphasis="ghost" onClick={onClose}>Cancel</Button><Button intent="brand" type="submit" disabled={!source}>Save evidence</Button></div></form></Modal>;
}

function FindingEdit({ item, onClose, onSave }: { item: Row; onClose: () => void; onSave: (values: Row) => Promise<void> }) {
  const [title, setTitle] = useState(String(item.title)); const [summary, setSummary] = useState(String(item.summary ?? "")); const [confidence, setConfidence] = useState(String(item.confidence_label ?? ""));
  return <Modal open onClose={onClose} title="Edit finding"><form className="simple-form" onSubmit={(event) => { event.preventDefault(); void onSave({ title, summary, confidence_label: confidence || null }); }}><label>Title<input required value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>Summary<textarea rows={5} value={summary} onChange={(event) => setSummary(event.target.value)} /></label><label>Confidence<select value={confidence} onChange={(event) => setConfidence(event.target.value)}><option value="">Not set</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label><div className="modal__actions"><Button emphasis="ghost" onClick={onClose}>Cancel</Button><Button intent="brand" type="submit">Save changes</Button></div></form></Modal>;
}

function SourceDetail({ item, notes, error, editOpen, onEdit, onClose, onRefresh, onSave, onReload }: { item: Row; notes: Row[]; error: string; editOpen: boolean; onEdit: () => void; onClose: () => void; onRefresh: () => void; onSave: (values: Row) => Promise<void>; onReload: () => Promise<void> }) {
  const freshness = sourceFreshness(item.freshness_expires_at as string | null);
  return <main className="domain-page knowledge-detail"><p className="eyebrow">Source · {label(item.source_type)}</p><h1>{String(item.title)}</h1><p className="dataset-note">{label(freshness)} · {String(item.reliability ?? "Unrated")}</p><div className="strategy-actions"><Button emphasis="outline" onClick={onEdit}>Edit</Button><Button onClick={onRefresh}>Mark reviewed</Button>{item.url ? <a className="button button--outline" href={String(item.url)} target="_blank" rel="noreferrer">Open source</a> : null}</div><section className="data-surface knowledge-section"><p className="eyebrow">Source details</p><p>Author: {String(item.author ?? "—")} · Publisher: {String(item.publisher ?? "—")}</p><p>{String(item.notes ?? "No source notes.")}</p></section><KnowledgeNotesPanel targetType="source" targetId={String(item.id)} notes={notes} onChanged={onReload} />{editOpen ? <SourceEdit item={item} onClose={onClose} onSave={onSave} /> : null}{error ? <p role="alert" className="field-error">{error}</p> : null}</main>;
}

export function KnowledgeNotesPanel({ targetType, targetId, notes, onChanged }: { targetType: "topic" | "source" | "finding" | "question"; targetId: string; notes: Row[]; onChanged: () => Promise<void> }) {
  const [open, setOpen] = useState(false); const [creating, setCreating] = useState(false); const [available, setAvailable] = useState<Row[]>([]); const [selected, setSelected] = useState(""); const [title, setTitle] = useState(""); const [content, setContent] = useState(""); const [message, setMessage] = useState("");
  const fetchNotes = async () => { const response = await fetch("/api/knowledge/notes?available=true", { cache: "no-store" }); const body = await response.json(); if (response.ok) setAvailable(body.items ?? []); else setMessage("Notes could not be loaded."); setOpen(true); };
  const link = async () => { const response = await fetch("/api/knowledge/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target_type: targetType, target_id: targetId, note_id: selected }) }); if (!response.ok) { setMessage("Note could not be linked."); return; } setOpen(false); await onChanged(); };
  const create = async () => { const response = await fetch("/api/knowledge/notes", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target_type: targetType, target_id: targetId, title, content }) }); if (!response.ok) { setMessage("Linked note could not be created."); return; } setCreating(false); await onChanged(); };
  return <section className="data-surface knowledge-section"><header><p className="eyebrow">Notes</p><div className="strategy-actions"><Button emphasis="ghost" onClick={() => setCreating(true)}>Create linked note</Button><Button emphasis="ghost" onClick={() => void fetchNotes()}>Link existing note</Button></div></header>{notes.length ? <div className="signal-stack">{notes.map((note) => <article className="signal-row" key={String(note.id)}><span><strong>{String(note.title)}</strong><small>{String(note.content ?? "").slice(0, 120) || "No excerpt"}</small></span><div className="integration-actions"><Link className="button button--ghost" href={`/notes/${note.id}`}>Open note</Link><Button emphasis="ghost" onClick={async () => { const response = await fetch("/api/knowledge/notes", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ link_id: note.link_id }) }); if (!response.ok) setMessage("Note could not be unlinked."); else await onChanged(); }}>Unlink</Button></div></article>)}</div> : <p className="dataset-note">No notes linked.</p>}{open ? <Modal open onClose={() => setOpen(false)} title="Link existing note"><form className="simple-form" onSubmit={(event) => { event.preventDefault(); if (selected) void link(); }}><label>Note<select value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">Select an owned note</option>{available.map((note) => <option key={String(note.id)} value={String(note.id)}>{String(note.title)}</option>)}</select></label><div className="modal__actions"><Button emphasis="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button intent="brand" type="submit" disabled={!selected}>Link note</Button></div></form></Modal> : null}{creating ? <Modal open onClose={() => setCreating(false)} title="Create linked note"><form className="simple-form" onSubmit={(event) => { event.preventDefault(); void create(); }}><label>Title<input required value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>Note<textarea rows={5} value={content} onChange={(event) => setContent(event.target.value)} /></label><div className="modal__actions"><Button emphasis="ghost" onClick={() => setCreating(false)}>Cancel</Button><Button intent="brand" type="submit">Create note</Button></div></form></Modal> : null}{message ? <p role="alert" className="field-error">{message}</p> : null}</section>;
}

function SourceEdit({ item, onClose, onSave }: { item: Row; onClose: () => void; onSave: (values: Row) => Promise<void> }) {
  const [values, setValues] = useState<Record<string, string>>({ title: String(item.title ?? ""), source_type: String(item.source_type ?? "manual"), url: String(item.url ?? ""), author: String(item.author ?? ""), publisher: String(item.publisher ?? ""), published_at: String(item.published_at ?? ""), accessed_at: String(item.accessed_at ?? "").slice(0, 16), reliability: String(item.reliability ?? ""), freshness_expires_at: String(item.freshness_expires_at ?? ""), notes: String(item.notes ?? "") });
  const set = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));
  return <Modal open onClose={onClose} title="Edit source"><form className="simple-form" onSubmit={(event) => { event.preventDefault(); const output: Row = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value || null])); if (typeof output.accessed_at === "string") output.accessed_at = new Date(output.accessed_at).toISOString(); void onSave(output); }} noValidate>{Object.entries(values).map(([key, value]) => key === "notes" ? <label key={key}>Notes<textarea rows={4} value={value} onChange={(event) => set(key, event.target.value)} /></label> : <label key={key}>{label(key)}<input type={key === "accessed_at" ? "datetime-local" : key === "published_at" || key === "freshness_expires_at" ? "date" : "text"} value={value} onChange={(event) => set(key, event.target.value)} /></label>)}<div className="modal__actions"><Button emphasis="ghost" onClick={onClose}>Cancel</Button><Button intent="brand" type="submit">Save changes</Button></div></form></Modal>;
}

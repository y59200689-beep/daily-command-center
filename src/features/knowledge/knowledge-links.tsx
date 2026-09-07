"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useDeferredEffect } from "@/lib/use-deferred-effect";

type KnowledgeType = "topic" | "source" | "finding" | "question" | "brief";
type Row = Record<string, unknown> & { id: string };

const knowledgeResources: Record<KnowledgeType, string> = {
  topic: "topics",
  source: "sources",
  finding: "findings",
  question: "questions",
  brief: "briefs",
};
export const relationTypes = ["related", "supports", "contradicts", "derived_from", "supersedes", "depends_on", "impacts", "about"] as const;
export const relationLabels: Record<(typeof relationTypes)[number], string> = {
  related: "Related to",
  supports: "Supports",
  contradicts: "Contradicts",
  derived_from: "Derived from",
  supersedes: "Supersedes",
  depends_on: "Depends on",
  impacts: "Impacts",
  about: "About",
};
export const entityTypes = ["project", "client", "lead", "opportunity", "proposal", "campaign", "content", "goal", "decision", "roadmap", "product", "supplier", "trip", "commitment", "milestone"] as const;

const words = (value: unknown) => String(value ?? "").replaceAll("_", " ");
const recordLabel = (record?: Row) => String(record?.title ?? record?.question ?? "Untitled knowledge");
const detailRoute = (type: KnowledgeType, id: string) => type === "topic"
  ? `/knowledge/topics/${id}`
  : type === "source"
    ? `/knowledge/sources/${id}`
    : type === "finding"
      ? `/knowledge/findings/${id}`
      : type === "brief"
        ? `/knowledge/briefs/${id}`
        : `/knowledge/topics/${String(id)}#question-${id}`;

export function KnowledgeRelationsPanel({ originType, originId, compact = false }: { originType: KnowledgeType; originId: string; compact?: boolean }) {
  const [relations, setRelations] = useState<Row[]>([]);
  const [records, setRecords] = useState<Record<KnowledgeType, Row[]>>({ topic: [], source: [], finding: [], question: [], brief: [] });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [targetType, setTargetType] = useState<KnowledgeType>("topic");
  const [targetId, setTargetId] = useState("");
  const [relationType, setRelationType] = useState<(typeof relationTypes)[number]>("related");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [relationResponse, ...recordResponses] = await Promise.all([
      fetch("/api/knowledge/relations", { cache: "no-store" }),
      ...Object.values(knowledgeResources).map((resource) => fetch(`/api/knowledge/${resource}`, { cache: "no-store" })),
    ]);
    const relationBody = await relationResponse.json();
    if (!relationResponse.ok) { setError(relationBody.error ?? "Relations could not be loaded."); return; }
    const loadedRecords = await Promise.all(recordResponses.map((response) => response.json()));
    const nextRecords = {} as Record<KnowledgeType, Row[]>;
    (Object.keys(knowledgeResources) as KnowledgeType[]).forEach((type, index) => { nextRecords[type] = loadedRecords[index].items ?? []; });
    setRecords(nextRecords);
    setRelations((relationBody.items ?? []).filter((row: Row) => (row.from_type === originType && row.from_id === originId) || (row.to_type === originType && row.to_id === originId)));
  }, [originId, originType]);
  useDeferredEffect(useCallback(() => { void load(); }, [load]));

  const recordMap = useMemo(() => {
    const map = new Map<string, Row>();
    for (const [type, items] of Object.entries(records)) for (const item of items) map.set(`${type}:${item.id}`, item);
    return map;
  }, [records]);
  const outgoing = relations.filter((row) => row.from_type === originType && row.from_id === originId);
  const incoming = relations.filter((row) => row.to_type === originType && row.to_id === originId);
  const candidates = records[targetType].filter((record) => record.id !== originId || targetType !== originType).filter((record) => `${recordLabel(record)} ${record.status ?? record.source_type ?? ""}`.toLowerCase().includes(query.toLowerCase()));

  const beginAdd = () => { setEditing(null); setTargetType("topic"); setTargetId(""); setRelationType("related"); setQuery(""); setOpen(true); };
  const beginEdit = (row: Row) => { setEditing(row); setRelationType(row.relation_type as (typeof relationTypes)[number]); setOpen(true); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const response = await fetch(editing ? `/api/knowledge/relations/${editing.id}` : "/api/knowledge/relations", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing ? { relation_type: relationType } : { from_type: originType, from_id: originId, to_type: targetType, to_id: targetId, relation_type: relationType }),
    });
    const body = await response.json();
    if (!response.ok) { setError(body.error ?? "Relation could not be saved."); return; }
    setOpen(false);
    await load();
  };
  const remove = async (id: string) => {
    const response = await fetch(`/api/knowledge/relations/${id}`, { method: "DELETE" });
    if (!response.ok) { setError("Relation could not be removed."); return; }
    await load();
  };

  return <section className={`knowledge-section data-surface knowledge-relations${compact ? " knowledge-relations--compact" : ""}`}>
    <header><div><p className="eyebrow">Related knowledge</p><h2>Relationships with direction</h2></div><Button emphasis="ghost" onClick={beginAdd}>Add relation</Button></header>
    {error ? <p role="alert" className="field-error">{error}</p> : null}
    <RelationList title="Outgoing relations" rows={outgoing} currentLabel="This record" incoming={false} recordMap={recordMap} onEdit={beginEdit} onRemove={remove} />
    <RelationList title="Incoming relations" rows={incoming} currentLabel="This record" incoming recordMap={recordMap} onEdit={beginEdit} onRemove={remove} />
    {open ? <Modal open onClose={() => setOpen(false)} title={editing ? "Change relation" : "Add relation"} description="Direction is preserved exactly as stored.">
      <form className="simple-form knowledge-selector" onSubmit={save}>
        {!editing ? <><label htmlFor={`relation-target-type-${originId}`}>Target type</label><select id={`relation-target-type-${originId}`} value={targetType} onChange={(event) => { setTargetType(event.target.value as KnowledgeType); setTargetId(""); }}>{(Object.keys(knowledgeResources) as KnowledgeType[]).map((type) => <option key={type} value={type}>{words(type)}</option>)}</select>
          <label htmlFor={`relation-search-${originId}`}>Search records</label><input id={`relation-search-${originId}`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by title or status" />
          <label htmlFor={`relation-target-${originId}`}>Owned record</label><select id={`relation-target-${originId}`} required value={targetId} onChange={(event) => setTargetId(event.target.value)}><option value="">{candidates.length ? "Select a record" : "No records available"}</option>{candidates.map((record) => <option key={record.id} value={record.id}>{recordLabel(record)} · {words(record.status ?? record.source_type)}</option>)}</select></> : null}
        <label htmlFor={`relation-type-${originId}`}>Relation type</label><select id={`relation-type-${originId}`} value={relationType} onChange={(event) => setRelationType(event.target.value as (typeof relationTypes)[number])}>{relationTypes.map((type) => <option key={type} value={type}>{relationLabels[type]}</option>)}</select>
        <div className="modal__actions"><Button emphasis="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button intent="brand" type="submit" disabled={!editing && !targetId}>{editing ? "Save relation" : "Add relation"}</Button></div>
      </form>
    </Modal> : null}
  </section>;
}

function RelationList({ title, rows, currentLabel, incoming, recordMap, onEdit, onRemove }: { title: string; rows: Row[]; currentLabel: string; incoming: boolean; recordMap: Map<string, Row>; onEdit: (row: Row) => void; onRemove: (id: string) => Promise<void> }) {
  return <div className="knowledge-relation-group"><p className="eyebrow">{title}</p>{rows.length ? <div className="signal-stack">{rows.map((row) => {
    const otherType = String(incoming ? row.from_type : row.to_type) as KnowledgeType;
    const otherId = String(incoming ? row.from_id : row.to_id);
    const other = recordMap.get(`${otherType}:${otherId}`);
    const verb = relationLabels[row.relation_type as (typeof relationTypes)[number]] ?? words(row.relation_type);
    return <article className="knowledge-relation-row" key={row.id}>
      <div className="knowledge-relation-node">
        <small>{incoming ? words(otherType) : "This record"}</small>
        {incoming ? (
          <Link href={detailRoute(otherType, otherId)}>{recordLabel(other)}</Link>
        ) : (
          <strong>{currentLabel}</strong>
        )}
      </div>
      <span className="knowledge-relation-verb">{verb}</span>
      <div className="knowledge-relation-node">
        <small>{incoming ? "This record" : words(otherType)}</small>
        {incoming ? (
          <strong>{currentLabel}</strong>
        ) : (
          <Link href={detailRoute(otherType, otherId)}>{recordLabel(other)}</Link>
        )}
      </div>
      <div className="knowledge-relation-actions">
        <Button emphasis="ghost" aria-label={`Change ${verb} relation`} onClick={() => onEdit(row)}>Change</Button>
        <Button emphasis="ghost" aria-label={`Remove ${verb} relation`} onClick={() => void onRemove(row.id)}>Remove</Button>
      </div>
    </article>;
  })}</div> : <p className="dataset-note">No {title.toLowerCase()}.</p>}</div>;
}

type EntityType = (typeof entityTypes)[number];
type EntityOption = { id: string; label: string; status?: string | null; route: string };

export function KnowledgeEntityLinksPanel({ originType, originId }: { originType: Exclude<KnowledgeType, "question">; originId: string }) {
  const [links, setLinks] = useState<Row[]>([]);
  const [labels, setLabels] = useState<Map<string, EntityOption>>(new Map());
  const [type, setType] = useState<EntityType>("project");
  const [options, setOptions] = useState<EntityOption[]>([]);
  const [selected, setSelected] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const loadOptions = useCallback(async (kind: EntityType, search = "") => {
    const response = await fetch(`/api/knowledge/entity-options?type=${kind}&q=${encodeURIComponent(search)}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) { setError(body.error ?? "Records could not be loaded."); return []; }
    const items = body.items ?? [];
    setOptions(items);
    setLabels((current) => { const next = new Map(current); for (const item of items) next.set(`${kind}:${item.id}`, item); return next; });
    return items as EntityOption[];
  }, []);
  const load = useCallback(async () => {
    const response = await fetch("/api/knowledge/links", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) { setError(body.error ?? "Linked records could not be loaded."); return; }
    const ownedLinks = (body.items ?? []).filter((row: Row) => row.knowledge_type === originType && row.knowledge_id === originId);
    setLinks(ownedLinks);
    const linkedTypes = [...new Set<EntityType>(ownedLinks.map((row: Row) => row.entity_type as EntityType))];
    await Promise.all(linkedTypes.map((kind) => loadOptions(kind)));
  }, [loadOptions, originId, originType]);
  useDeferredEffect(useCallback(() => { void load(); }, [load]));
  const begin = async () => { setOpen(true); setSelected(""); setQuery(""); await loadOptions(type); };
  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    const response = await fetch("/api/knowledge/links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ knowledge_type: originType, knowledge_id: originId, entity_type: type, entity_id: selected }) });
    const body = await response.json();
    if (!response.ok) { setError(body.error ?? "Record could not be linked."); return; }
    setOpen(false); await load();
  };
  const remove = async (id: string) => { const response = await fetch(`/api/knowledge/links/${id}`, { method: "DELETE" }); if (!response.ok) { setError("Link could not be removed."); return; } await load(); };
  return <section className="knowledge-section data-surface knowledge-entity-links"><header><div><p className="eyebrow">Linked records</p><h2>Connected context</h2></div><Button emphasis="ghost" onClick={() => void begin()}>Link to record</Button></header>{error ? <p role="alert" className="field-error">{error}</p> : null}<div className="signal-stack">{links.length ? links.map((item) => { const option = labels.get(`${item.entity_type}:${item.entity_id}`); return <article className="knowledge-linked-row" key={item.id}><span><small>{words(item.entity_type)}</small><strong>{option?.label ?? "Linked record"}</strong>{option?.status ? <em>{words(option.status)}</em> : null}</span><div className="integration-actions">{option ? <Link className="button button--ghost" href={option.route}>Open</Link> : null}<Button emphasis="ghost" onClick={() => void remove(item.id)}>Remove</Button></div></article>; }) : <p className="dataset-note">No records linked yet.</p>}</div>{open ? <Modal open onClose={() => setOpen(false)} title="Link to existing record"><form className="simple-form knowledge-selector" onSubmit={create}><label htmlFor={`entity-type-${originId}`}>Record type</label><select id={`entity-type-${originId}`} value={type} onChange={(event) => { const next = event.target.value as EntityType; setType(next); setSelected(""); void loadOptions(next); }}>{entityTypes.map((item) => <option key={item} value={item}>{words(item)}</option>)}</select><label htmlFor={`entity-search-${originId}`}>Search</label><div className="knowledge-selector-search"><input id={`entity-search-${originId}`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search owned records"/><Button emphasis="outline" onClick={() => void loadOptions(type, query)}>Search</Button></div><label htmlFor={`entity-record-${originId}`}>Owned record</label><select id={`entity-record-${originId}`} required value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">{options.length ? "Select a record" : "No records available"}</option>{options.map((item) => <option key={item.id} value={item.id}>{item.label}{item.status ? ` · ${words(item.status)}` : ""}</option>)}</select><div className="modal__actions"><Button emphasis="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button intent="brand" type="submit" disabled={!selected}>Link record</Button></div></form></Modal> : null}</section>;
}

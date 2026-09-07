"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useDeferredEffect } from "@/lib/use-deferred-effect";

type Row = Record<string, unknown> & { id: string };

export function KnowledgeHome() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => { const response = await fetch("/api/knowledge", { cache: "no-store" }); const body = await response.json(); if (response.ok) setData(body.overview); else setError(body.error ?? "Knowledge could not be loaded."); }, []);
  useDeferredEffect(useCallback(() => { void load(); }, [load]));
  const create = async () => { if (!title.trim()) return; setSaving(true); const response = await fetch("/api/knowledge/topics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, domain: "other", priority: "medium" }) }); setSaving(false); if (response.ok) { setTitle(""); setOpen(false); await load(); } else setError("Topic could not be saved."); };
  const topics = (data?.topics as Row[] | undefined) ?? [];
  const queue = (data?.queue as Row[] | undefined) ?? [];
  const questions = (data?.questions as Row[] | undefined) ?? [];
  const findings = (data?.findings as Row[] | undefined) ?? [];
  const stale = (data?.stale as Row[] | undefined) ?? [];
  const watches = (data?.watches as Row[] | undefined) ?? [];
  return <main className="domain-page knowledge-page"><header className="page-header"><div><p className="eyebrow">Evidence, not assumptions</p><h1>Knowledge.</h1><p>{topics.length} active topics · {questions.length} open questions · {stale.length} sources need review</p></div><Button intent="brand" onClick={() => setOpen(true)}>New research topic</Button></header>{error ? <p role="alert" className="field-error">{error}</p> : null}<section className="knowledge-next data-surface"><p className="eyebrow">Research next</p>{queue.length ? <Link href={String(queue[0].route)}><h2>{String(queue[0].title)}</h2><p>{String(queue[0].reason)}</p></Link> : <p className="dataset-note">No research action needs attention.</p>}</section><div className="knowledge-grid"><Section title="Active topics" items={topics} render={(item) => <Link href={`/knowledge/topics/${item.id}`}><strong>{String(item.title)}</strong><small>{String(item.health).replaceAll("_", " ")}</small></Link>} /><Section title="Recent findings" items={findings.slice(0, 5)} render={(item) => <Link href={`/knowledge/findings/${item.id}`}><strong>{String(item.title)}</strong><small>{String(item.status)}</small></Link>} /><Section title="Questions to answer" items={questions} render={(item) => <Link href={`/knowledge/topics/${item.topic_id}#question-${item.id}`}><strong>{String(item.question)}</strong><small>{String(item.priority)} priority</small></Link>} /><Section title="Stale knowledge" items={stale} render={(item) => <Link href={`/knowledge/sources/${item.id}`}><strong>{String(item.title)}</strong><small>Source needs review</small></Link>} /><Section title="Watching" items={watches} render={(item) => <span><strong>{String(item.name)}</strong><small>{String(item.watch_type)}</small></span>} /></div><nav className="knowledge-library-links" aria-label="Knowledge library"><Link href="/knowledge/collections"><span>Collections</span><small>Curated groups of research references</small></Link><Link href="/knowledge/briefs"><span>Briefs</span><small>Current evidence rollups</small></Link></nav><Modal open={open} onClose={() => setOpen(false)} title="New research topic" description="Create a private topic; evidence and questions remain linked to it."><form className="simple-form" onSubmit={(event) => { event.preventDefault(); void create(); }} noValidate><label>Title<input required value={title} onChange={(event) => setTitle(event.target.value)} autoFocus /></label><div className="modal__actions"><Button emphasis="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button intent="brand" type="submit" disabled={saving}>{saving ? "Saving…" : "Create topic"}</Button></div></form></Modal></main>;
}

function Section({ title, items, render }: { title: string; items: Row[]; render: (item: Row) => React.ReactNode }) {
  return <section className="data-surface knowledge-section"><p className="eyebrow">{title}</p>{items.length ? <div className="signal-stack">{items.slice(0, 6).map((item) => <div className="signal-row" key={item.id}>{render(item)}</div>)}</div> : <p className="dataset-note">Nothing to show.</p>}</section>;
}

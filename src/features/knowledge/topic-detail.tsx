"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { KnowledgeEntityLinksPanel, KnowledgeRelationsPanel } from "@/features/knowledge/knowledge-links";
import { useDeferredEffect } from "@/lib/use-deferred-effect";

export const canonicalRelationTypes = ["related", "supports", "contradicts", "derived_from", "supersedes", "depends_on", "impacts", "about"] as const;
export const canonicalRelationTargets = ["topic", "source", "finding", "question", "brief"] as const;

type Row = Record<string, unknown> & { id: string };
const words = (value: unknown) => String(value ?? "").replaceAll("_", " ");

export function TopicDetail({ id }: { id: string }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [createKind, setCreateKind] = useState<"source" | "finding" | "question" | null>(null);
  const [questionPanel, setQuestionPanel] = useState<Row | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const response = await fetch(`/api/knowledge/topics/${id}`, { cache: "no-store" });
    const body = await response.json();
    if (response.ok) {
      setData(body);
      setError("");
      if (typeof window !== "undefined" && window.location.hash.startsWith("#question-")) {
        const qid = window.location.hash.replace("#question-", "");
        const qs = (body.questions as Row[] | undefined) ?? [];
        const match = qs.find((item) => item.id === qid);
        if (match) setQuestionPanel(match);
      }
    } else setError(body.error ?? "Topic could not be loaded.");
  }, [id]);
  useDeferredEffect(useCallback(() => { void load(); }, [load]));
  if (!data) return <main className="domain-page"><p className="dataset-note">{error || "Loading topic…"}</p></main>;
  const topic = data.topic as Row;
  const findings = data.findings as Row[];
  const questions = data.questions as Row[];
  const evidence = data.evidence as Row[];
  const sources = [...new Map(evidence.map((row) => { const source = row.source as Row; return [source?.id, source]; })).values()].filter(Boolean) as Row[];
  const selectedQuestion = questionPanel ? questions.find((item) => item.id === questionPanel.id) ?? questionPanel : null;
  const patchTopic = async (status: string) => { await fetch(`/api/knowledge/topics/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }); await load(); };

  return <main className="domain-page knowledge-topic">
    <header className="page-header"><div><p className="eyebrow">Topic · {words(topic.domain)}</p><h1>{String(topic.title)}</h1><p>{words(topic.health)} · {words(topic.status)}</p></div><div className="strategy-actions"><Button emphasis="outline" onClick={() => void patchTopic(topic.status === "paused" ? "active" : "paused")}>{topic.status === "paused" ? "Resume" : "Pause"}</Button><Button onClick={() => void patchTopic("complete")}>Complete</Button></div></header>
    {error ? <p role="alert" className="field-error">{error}</p> : null}
    <TopicSection title="Findings" action="New finding" onAction={() => setCreateKind("finding")}><Rows items={findings} primary="title" secondary="status" route="/knowledge/findings" /></TopicSection>
    <TopicSection title="Questions" action="New question" onAction={() => setCreateKind("question")}><div className="signal-stack">{questions.length ? questions.map((question) => <article className="signal-row" id={`question-${question.id}`} key={question.id}><span><strong>{String(question.question)}</strong><small>{words(question.status)}{question.answer_summary ? ` · ${String(question.answer_summary)}` : ""}</small></span><Button emphasis="ghost" onClick={() => setQuestionPanel(question)}>Open</Button></article>) : <p className="dataset-note">No questions yet.</p>}</div></TopicSection>
    <TopicSection title="Sources" action="New source" onAction={() => setCreateKind("source")}><Rows items={sources} primary="title" secondary="source_type" route="/knowledge/sources" /></TopicSection>
    <TopicSection title="Notes"><NotesManager targetType="topic" targetId={id} onChanged={load} /></TopicSection>
    <KnowledgeRelationsPanel originType="topic" originId={id} />
    <KnowledgeEntityLinksPanel originType="topic" originId={id} />
    {createKind ? <CreateForm kind={createKind} topicId={id} onClose={() => setCreateKind(null)} onSaved={async () => { setCreateKind(null); await load(); }} /> : null}
    {selectedQuestion ? <QuestionPanel question={selectedQuestion} findings={findings} onClose={() => setQuestionPanel(null)} onChanged={load} /> : null}
  </main>;
}

function TopicSection({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: React.ReactNode }) {
  return <section className="knowledge-section data-surface"><header><p className="eyebrow">{title}</p>{action ? <Button emphasis="ghost" onClick={onAction}>{action}</Button> : null}</header>{children}</section>;
}

function Rows({ items, primary, secondary, route }: { items: Row[]; primary: string; secondary: string; route: string }) {
  return <div className="signal-stack">{items.length ? items.map((item) => <Link className="signal-row" key={item.id} href={`${route}/${item.id}`}><span><strong>{String(item[primary])}</strong><small>{words(item[secondary])}</small></span></Link>) : <p className="dataset-note">Nothing linked yet.</p>}</div>;
}

function QuestionPanel({ question, findings, onClose, onChanged }: { question: Row; findings: Row[]; onClose: () => void; onChanged: () => Promise<void> }) {
  const [answering, setAnswering] = useState(false);
  const [summary, setSummary] = useState(String(question.answer_summary ?? ""));
  const [selectedFindings, setSelectedFindings] = useState<string[]>((question.findings as Row[] | undefined)?.map((item) => item.id) ?? []);
  const patch = async (values: Record<string, unknown>) => { await fetch(`/api/knowledge/questions/${question.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) }); await onChanged(); };
  const answer = async (event: React.FormEvent) => {
    event.preventDefault();
    await patch({ status: "answered", answer_summary: summary });
    const existing = new Set(((question.findings as Row[] | undefined) ?? []).map((item) => item.id));
    await Promise.all(selectedFindings.filter((id) => !existing.has(id)).map((findingId) => fetch(`/api/knowledge/questions/${question.id}/findings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ finding_id: findingId }) })));
    setAnswering(false);
    await onChanged();
  };
  return <Modal open onClose={onClose} title="Research question" description={String(question.question)}><div className="question-workspace"><div className="strategy-actions"><Button emphasis="ghost" onClick={() => void patch({ status: "researching" })}>Researching</Button><Button emphasis="ghost" onClick={() => setAnswering(true)}>Answer</Button><Button emphasis="ghost" onClick={() => void patch({ status: "deferred" })}>Defer</Button><Button emphasis="ghost" onClick={() => void patch({ status: "dropped" })}>Drop</Button>{["answered", "deferred", "dropped"].includes(String(question.status)) ? <Button emphasis="ghost" onClick={() => void patch({ status: "open" })}>Reopen</Button> : null}</div>{question.answer_summary ? <p><strong>Answer:</strong> {String(question.answer_summary)}</p> : null}<NotesManager targetType="question" targetId={question.id} onChanged={onChanged} /><KnowledgeRelationsPanel originType="question" originId={question.id} compact />{answering ? <Modal open onClose={() => setAnswering(false)} title="Answer research question"><form className="simple-form" onSubmit={answer}><p className="dataset-note">Original question: {String(question.question)}</p><label htmlFor={`answer-${question.id}`}>Answer summary</label><textarea id={`answer-${question.id}`} required rows={5} value={summary} onChange={(event) => setSummary(event.target.value)} /><fieldset className="knowledge-checklist"><legend>Linked Findings</legend>{findings.length ? findings.map((finding) => <label key={finding.id}><input type="checkbox" checked={selectedFindings.includes(finding.id)} onChange={(event) => setSelectedFindings((current) => event.target.checked ? [...current, finding.id] : current.filter((id) => id !== finding.id))} /> <span>{String(finding.title)} · {words(finding.status)}</span></label>) : <p className="dataset-note">No Findings are available in this Topic.</p>}</fieldset><div className="modal__actions"><Button emphasis="ghost" onClick={() => setAnswering(false)}>Cancel</Button><Button intent="brand" type="submit">Save answer</Button></div></form></Modal> : null}</div></Modal>;
}

function NotesManager({ targetType, targetId, onChanged }: { targetType: "topic" | "question"; targetId: string; onChanged: () => Promise<void> }) {
  const [notes, setNotes] = useState<Row[]>([]);
  const [open, setOpen] = useState<"create" | "link" | null>(null);
  const [all, setAll] = useState<Row[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selected, setSelected] = useState("");
  const [query, setQuery] = useState("");
  const load = useCallback(async () => { const response = await fetch(`/api/knowledge/notes?target_type=${targetType}&target_id=${targetId}`, { cache: "no-store" }); const body = await response.json(); if (response.ok) setNotes(body.items ?? []); }, [targetId, targetType]);
  useDeferredEffect(useCallback(() => { void load(); }, [load]));
  const refresh = async () => { await load(); await onChanged(); };
  const linkOpen = async () => { const response = await fetch("/api/knowledge/notes?available=true", { cache: "no-store" }); const body = await response.json(); if (response.ok) setAll(body.items ?? []); setOpen("link"); };
  const filtered = all.filter((note) => `${note.title ?? ""} ${note.content ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="knowledge-note-manager"><div className="strategy-actions"><Button emphasis="ghost" onClick={() => setOpen("create")}>Create Note</Button><Button emphasis="ghost" onClick={() => void linkOpen()}>Link existing</Button></div><div className="signal-stack">{notes.length ? notes.map((note) => <article className="signal-row" key={note.id}><span><strong>{String(note.title)}</strong><small>{String(note.content ?? "").slice(0, 100) || "No excerpt"} · {new Date(String(note.updated_at)).toLocaleDateString()}</small></span><div className="integration-actions"><Link className="button button--ghost" href={`/notes/${note.id}`}>Open</Link><Button emphasis="ghost" onClick={async () => { await fetch("/api/knowledge/notes", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ link_id: note.link_id }) }); await refresh(); }}>Unlink</Button></div></article>) : <p className="dataset-note">No notes linked.</p>}</div>{open === "create" ? <Modal open onClose={() => setOpen(null)} title="Create linked Note"><form className="simple-form" onSubmit={async (event) => { event.preventDefault(); await fetch("/api/knowledge/notes", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target_type: targetType, target_id: targetId, title, content }) }); setOpen(null); await refresh(); }}><label>Title<input required value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>Note<textarea rows={4} value={content} onChange={(event) => setContent(event.target.value)} /></label><div className="modal__actions"><Button emphasis="ghost" onClick={() => setOpen(null)}>Cancel</Button><Button intent="brand" type="submit">Create Note</Button></div></form></Modal> : null}{open === "link" ? <Modal open onClose={() => setOpen(null)} title="Link existing Note"><form className="simple-form" onSubmit={async (event) => { event.preventDefault(); await fetch("/api/knowledge/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target_type: targetType, target_id: targetId, note_id: selected }) }); setOpen(null); await refresh(); }}><label>Search Notes<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title or note text" /></label><label>Note<select required value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">{filtered.length ? "Select an owned Note" : "No Notes available"}</option>{filtered.map((note) => <option key={note.id} value={note.id}>{String(note.title)}</option>)}</select></label><div className="modal__actions"><Button emphasis="ghost" onClick={() => setOpen(null)}>Cancel</Button><Button intent="brand" type="submit" disabled={!selected}>Link Note</Button></div></form></Modal> : null}</div>;
}

function CreateForm({ kind, topicId, onClose, onSaved }: { kind: "source" | "finding" | "question"; topicId: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  return <Modal open onClose={onClose} title={`New ${kind}`}><form className="simple-form" onSubmit={async (event) => { event.preventDefault(); const body = kind === "source" ? { title, source_type: "manual" } : kind === "finding" ? { title, summary, topic_id: topicId } : { question: title, topic_id: topicId }; await fetch(`/api/knowledge/${kind === "source" ? "sources" : kind === "finding" ? "findings" : "questions"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); await onSaved(); }}><label>{kind === "question" ? "Question" : "Title"}<input required value={title} onChange={(event) => setTitle(event.target.value)} /></label>{kind === "finding" ? <label>Summary<textarea rows={4} value={summary} onChange={(event) => setSummary(event.target.value)} /></label> : null}<div className="modal__actions"><Button emphasis="ghost" onClick={onClose}>Cancel</Button><Button intent="brand" type="submit">Save</Button></div></form></Modal>;
}

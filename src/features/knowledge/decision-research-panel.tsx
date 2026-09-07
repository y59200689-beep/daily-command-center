"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useDeferredEffect } from "@/lib/use-deferred-effect";

type Row = Record<string, unknown> & { id: string };
type Research = { topics: Row[]; findings: Row[]; supporting: Row[]; contradicting: Row[]; questions: Row[]; briefs: Row[]; readiness: string; reason: string };
const words = (value: unknown) => String(value ?? "").replaceAll("_", " ");

export function DecisionResearchPanel({ decisionId }: { decisionId: string }) {
  const [data, setData] = useState<Research | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const response = await fetch(`/api/knowledge/decisions/${decisionId}`, { cache: "no-store" });
    const body = await response.json();
    if (response.ok) { setData(body); setError(""); } else setError(body.error ?? "Research context could not be loaded.");
  }, [decisionId]);
  useDeferredEffect(useCallback(() => { void load(); }, [load]));
  if (error) return <section className="data-surface knowledge-decision-panel"><p className="eyebrow">Research / evidence</p><p role="alert" className="field-error">{error}</p></section>;
  if (!data) return <section className="data-surface knowledge-decision-panel"><p className="eyebrow">Research / evidence</p><p className="dataset-note">Loading research context…</p></section>;
  const empty = !data.topics.length && !data.findings.length && !data.questions.length && !data.briefs.length;
  return <section className="data-surface knowledge-decision-panel"><header><div><p className="eyebrow">Research / evidence</p><h2>{words(data.readiness)}</h2><p><strong>Why:</strong> {data.reason}</p></div><Link className="button button--outline" href="/knowledge">Link research</Link></header>{empty ? <div className="empty-state empty-state--compact"><h3>No research linked yet.</h3><p>Link a Topic, Finding, Question, or Brief from Knowledge.</p></div> : <div className="knowledge-decision-grid"><DecisionGroup title="Linked topics" rows={data.topics} route="/knowledge/topics" /><DecisionGroup title="Key findings" rows={data.findings} route="/knowledge/findings" /><EvidenceGroup title="Supporting evidence" rows={data.supporting} /><EvidenceGroup title="Contradictory evidence" rows={data.contradicting} /><DecisionGroup title="Open questions" rows={data.questions} route="/knowledge/topics" question /><DecisionGroup title="Research briefs" rows={data.briefs} route="/knowledge/briefs" /></div>}</section>;
}

function DecisionGroup({ title, rows, route, question = false }: { title: string; rows: Row[]; route: string; question?: boolean }) {
  return <div className="knowledge-decision-group"><p className="eyebrow">{title}</p>{rows.length ? rows.map((row) => <Link key={row.id} href={question ? `/knowledge/topics/${row.topic_id}#question-${row.id}` : `${route}/${row.id}`}><strong>{String(row.title ?? row.question)}</strong><small>{words(row.status)}</small></Link>) : <p className="dataset-note">None linked.</p>}</div>;
}

function EvidenceGroup({ title, rows }: { title: string; rows: Row[] }) {
  return <div className="knowledge-decision-group"><p className="eyebrow">{title}</p>{rows.length ? rows.map((row) => { const source = row.source as Row | undefined; return source ? <Link key={row.id} href={`/knowledge/sources/${source.id}`}><strong>{String(source.title)}</strong><small>{words(row.relation_type)}</small></Link> : null; }) : <p className="dataset-note">None linked.</p>}</div>;
}

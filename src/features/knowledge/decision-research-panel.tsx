"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useDeferredEffect } from "@/lib/use-deferred-effect";

type Row = Record<string, unknown> & { id: string; link_id?: string };
type Research = { topics: Row[]; findings: Row[]; supporting: Row[]; contradicting: Row[]; questions: Row[]; briefs: Row[]; readiness: string; reason: string };
const words = (value: unknown) => String(value ?? "").replaceAll("_", " ");

const readinessLabels: Record<string, string> = {
  ready_to_decide: "Ready to decide",
  needs_evidence: "Needs evidence",
  contradictory_evidence: "Contradictory evidence",
  open_questions_remain: "Open questions remain",
};

export function DecisionResearchPanel({ decisionId }: { decisionId: string }) {
  const [data, setData] = useState<Research | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [researchType, setResearchType] = useState<"topic" | "finding" | "brief">("topic");
  const [options, setOptions] = useState<Row[]>([]);
  const [selected, setSelected] = useState("");
  const [query, setQuery] = useState("");
  const [linking, setLinking] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/knowledge/decisions/${decisionId}`, { cache: "no-store" });
    const body = await response.json();
    if (response.ok) { setData(body); setError(""); } else setError(body.error ?? "Research context could not be loaded.");
  }, [decisionId]);
  useDeferredEffect(useCallback(() => { void load(); }, [load]));

  const loadOptions = useCallback(async (type: "topic" | "finding" | "brief") => {
    const resource = type === "topic" ? "topics" : type === "finding" ? "findings" : "briefs";
    const response = await fetch(`/api/knowledge/${resource}`, { cache: "no-store" });
    const body = await response.json();
    if (response.ok) setOptions((body.items ?? []) as Row[]);
  }, []);

  const openLinkModal = async () => {
    setOpen(true);
    setSelected("");
    setQuery("");
    await loadOptions(researchType);
  };

  const linkResearch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setLinking(true);
    const response = await fetch("/api/knowledge/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ knowledge_type: researchType, knowledge_id: selected, entity_type: "decision", entity_id: decisionId }),
    });
    setLinking(false);
    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Research could not be linked.");
      return;
    }
    setOpen(false);
    await load();
  };

  const unlinkResearch = async (linkId?: string) => {
    if (!linkId) return;
    const response = await fetch(`/api/knowledge/links/${linkId}`, { method: "DELETE" });
    if (!response.ok) { setError("Research link could not be removed."); return; }
    await load();
  };

  if (error) return <section className="data-surface knowledge-decision-panel"><p className="eyebrow">Research / evidence</p><p role="alert" className="field-error">{error}</p></section>;
  if (!data) return <section className="data-surface knowledge-decision-panel"><p className="eyebrow">Research / evidence</p><p className="dataset-note">Loading research context…</p></section>;
  const empty = !data.topics.length && !data.findings.length && !data.questions.length && !data.briefs.length;
  const filteredOptions = options.filter((item) => String(item.title ?? "").toLowerCase().includes(query.toLowerCase()));

  return <section className="data-surface knowledge-decision-panel">
    <header>
      <div>
        <p className="eyebrow">Research / evidence</p>
        <h2>{readinessLabels[data.readiness] ?? words(data.readiness)}</h2>
        <p><strong>Why:</strong> {data.reason}</p>
      </div>
      <Button emphasis="outline" onClick={() => void openLinkModal()}>Link research</Button>
    </header>
    {empty ? (
      <div className="empty-state empty-state--compact">
        <h3>No research linked yet.</h3>
        <p>Link a Topic, Finding, or Brief from Knowledge to inform this decision.</p>
        <div style={{ marginTop: 12 }}>
          <Button intent="brand" onClick={() => void openLinkModal()}>Link research</Button>
        </div>
      </div>
    ) : (
      <div className="knowledge-decision-grid">
        <DecisionGroup title="Linked topics" rows={data.topics} route="/knowledge/topics" onUnlink={unlinkResearch} />
        <DecisionGroup title="Key findings" rows={data.findings} route="/knowledge/findings" onUnlink={unlinkResearch} />
        <EvidenceGroup title="Supporting evidence" rows={data.supporting} />
        <EvidenceGroup title="Contradictory evidence" rows={data.contradicting} />
        <DecisionGroup title="Open questions" rows={data.questions} route="/knowledge/topics" question />
        <DecisionGroup title="Research briefs" rows={data.briefs} route="/knowledge/briefs" onUnlink={unlinkResearch} />
      </div>
    )}
    {open ? (
      <Modal open onClose={() => setOpen(false)} title="Link research to decision" description="Attach owned knowledge to track supporting context and readiness.">
        <form className="simple-form knowledge-selector" onSubmit={linkResearch}>
          <label htmlFor={`research-type-${decisionId}`}>Research type</label>
          <select id={`research-type-${decisionId}`} value={researchType} onChange={(event) => { const next = event.target.value as "topic" | "finding" | "brief"; setResearchType(next); setSelected(""); void loadOptions(next); }}>
            <option value="topic">Topic</option>
            <option value="finding">Finding</option>
            <option value="brief">Research Brief</option>
          </select>
          <label htmlFor={`research-search-${decisionId}`}>Search</label>
          <input id={`research-search-${decisionId}`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by title" />
          <label htmlFor={`research-item-${decisionId}`}>Owned record</label>
          <select id={`research-item-${decisionId}`} required value={selected} onChange={(event) => setSelected(event.target.value)}>
            <option value="">{filteredOptions.length ? "Select a record" : "No records available"}</option>
            {filteredOptions.map((opt) => <option key={opt.id} value={opt.id}>{String(opt.title)} · {words(opt.status)}</option>)}
          </select>
          <div className="modal__actions">
            <Button emphasis="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button intent="brand" type="submit" disabled={!selected || linking}>{linking ? "Linking…" : "Link research"}</Button>
          </div>
        </form>
      </Modal>
    ) : null}
  </section>;
}

function DecisionGroup({ title, rows, route, question = false, onUnlink }: { title: string; rows: Row[]; route: string; question?: boolean; onUnlink?: (linkId?: string) => Promise<void> }) {
  return <div className="knowledge-decision-group">
    <p className="eyebrow">{title}</p>
    {rows.length ? (
      <div className="signal-stack">
        {rows.map((row) => (
          <article className="signal-row" key={row.id}>
            <Link href={question ? `/knowledge/topics/${row.topic_id}#question-${row.id}` : `${route}/${row.id}`}>
              <span><strong>{String(row.title ?? row.question)}</strong><small>{words(row.status)}</small></span>
            </Link>
            {row.link_id && onUnlink ? (
              <div className="integration-actions">
                <Button emphasis="ghost" aria-label={`Unlink ${String(row.title ?? "research")}`} onClick={() => void onUnlink(row.link_id)}>Unlink</Button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    ) : (
      <p className="dataset-note">None linked.</p>
    )}
  </div>;
}

function EvidenceGroup({ title, rows }: { title: string; rows: Row[] }) {
  return <div className="knowledge-decision-group">
    <p className="eyebrow">{title}</p>
    {rows.length ? (
      <div className="signal-stack">
        {rows.map((row) => {
          const source = row.source as Row | undefined;
          return source ? (
            <article className="signal-row" key={row.id}>
              <Link href={`/knowledge/sources/${source.id}`}>
                <span><strong>{String(source.title)}</strong><small>{words(row.relation_type)}</small></span>
              </Link>
            </article>
          ) : null;
        })}
      </div>
    ) : (
      <p className="dataset-note">None linked.</p>
    )}
  </div>;
}

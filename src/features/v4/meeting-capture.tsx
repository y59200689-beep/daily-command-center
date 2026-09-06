"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { useToast } from "@/components/toast-provider";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { SearchLink, type Row } from "@/features/v4/action-centers";
import { meetingItemCounts, meetingItemTypes, type MeetingCaptureItem, type MeetingItemType } from "@/lib/meeting-capture";
import { useDeferredEffect } from "@/lib/use-deferred-effect";
import { announceWorkspaceMutation } from "@/lib/workspace-mutations";

type ContextData = {
  meeting: { id: string; title: string; starts_at: string; ends_at: string; timezone: string };
  context: { projectId: string | null; clientId: string | null };
  projects: Row[];
  clients: Row[];
  capture: { status: string; result: CaptureResult | null } | null;
};
type CreatedRecord = { type: MeetingItemType; id: string; title: string; route: string };
type CaptureResult = { records: CreatedRecord[]; summary: string | null; meetingId: string };
type Phase = "capture" | "review" | "success";

const labels: Record<MeetingItemType, string> = { task: "Task", decision: "Decision", followup: "Follow-up", waiting: "Waiting item", note: "Note" };
const pluralLabels: Record<MeetingItemType, string> = { task: "Tasks", decision: "Decisions", followup: "Follow-ups", waiting: "Waiting items", note: "Notes" };

function blankItem(type: MeetingItemType, context?: ContextData["context"]): MeetingCaptureItem {
  const id = `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const base: MeetingCaptureItem = { id, type, included: true, source: "manual", title: "", project_id: context?.projectId ?? null, client_id: context?.clientId ?? null };
  if (type === "task") return { ...base, priority: "none" };
  if (type === "decision") return { ...base, outcome: "" };
  if (type === "note") return { ...base, content: "", category: "meeting" };
  return base;
}

function toDateTimeInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function toApiDateTime(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

export function MeetingCapture({ eventId }: { eventId: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [data, setData] = useState<ContextData | null>(null);
  const [phase, setPhase] = useState<Phase>("capture");
  const [summary, setSummary] = useState("");
  const [rawNotes, setRawNotes] = useState("");
  const [items, setItems] = useState<MeetingCaptureItem[]>([]);
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const executionId = useRef("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/meetings/${eventId}/capture`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setData(body);
      if (body.capture?.status === "executed" && body.capture.result) {
        setResult(body.capture.result);
        setPhase("success");
      }
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Meeting outcome could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [eventId]);
  useDeferredEffect(useCallback(() => { void load(); }, [load]));

  const patchItem = (id: string, patch: Partial<MeetingCaptureItem>) => setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  const addItem = (type: MeetingItemType) => {
    setItems((current) => [...current, blankItem(type, data?.context)]);
    setPhase("review");
  };

  async function generateSuggestions() {
    if (!rawNotes.trim() || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/meetings/${eventId}/capture`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "suggest", summary, rawNotes }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      const suggested = (body.items as MeetingCaptureItem[]).map((item) => ({ ...item, project_id: data?.context.projectId ?? null, client_id: data?.context.clientId ?? null }));
      setItems(suggested);
      setPhase("review");
      showToast(suggested.length ? `${suggested.length} meeting suggestion${suggested.length === 1 ? "" : "s"} ready to review.` : "No explicit actions were found. Add items manually or save the summary.", suggested.length ? "success" : "info");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Suggestions are unavailable. You can still add items manually.");
    } finally { setBusy(false); }
  }

  function review() {
    const selected = items.filter((item) => item.included);
    const invalid = selected.find((item) => !item.title.trim() || item.type === "decision" && !item.outcome?.trim());
    if (invalid) {
      setError(invalid.type === "decision" && !invalid.outcome?.trim() ? "Every included decision needs an outcome." : "Every included item needs a title.");
      return;
    }
    if (!selected.length && !summary.trim()) { setError("Choose at least one item or add a meeting summary."); return; }
    setError(""); setConfirming(true);
  }

  async function execute() {
    if (busy) return;
    setBusy(true); setError("");
    if (!executionId.current) executionId.current = crypto.randomUUID();
    try {
      const serialized = items.map((item) => ({ ...item, due_at: toApiDateTime(item.due_at), expected_by: toApiDateTime(item.expected_by) }));
      const response = await fetch(`/api/meetings/${eventId}/capture`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "execute", summary, rawNotes, items: serialized, idempotencyKey: executionId.current }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      const saved = body.result as CaptureResult;
      setResult(saved); setPhase("success"); setConfirming(false);
      const domains = new Set(saved.records.map((record) => record.type === "task" ? "tasks" : record.type === "decision" ? "decisions" : record.type === "followup" ? "followups" : record.type === "waiting" ? "waiting" : "notes"));
      domains.forEach((domain) => announceWorkspaceMutation(domain));
      router.refresh();
      showToast("Meeting outcome saved.");
    } catch (reason) {
      setConfirming(false);
      setError(reason instanceof Error ? reason.message : "Meeting outcome could not be saved. No selected records were created.");
    } finally { setBusy(false); }
  }

  if (loading) return <section className="data-surface meeting-capture-state" aria-live="polite"><p className="eyebrow">Meeting outcome</p><h2>Loading meeting context</h2></section>;
  if (!data) return <section className="inline-error" role="alert"><p>{error || "Meeting outcome could not be loaded."}</p><Button emphasis="outline" onClick={() => { setLoading(true); void load(); }}>Try again</Button></section>;
  if (phase === "success" && result) return <MeetingCaptureSuccess result={result} data={data} onDone={() => router.push(`/meeting/${eventId}`)} />;

  const counts = meetingItemCounts(items);
  return <div className="meeting-capture-flow">
    <section className="data-surface meeting-outcome-context">
      <p className="eyebrow">Meeting outcome</p>
      <h2>{data.meeting.title}</h2>
      <p>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(data.meeting.starts_at))} · {data.meeting.timezone}</p>
      <div className="meeting-context-links">
        <span>{data.context.clientId ? String(data.clients.find((item) => item.id === data.context.clientId)?.name ?? "Linked client") : "No client linked"}</span>
        <span>{data.context.projectId ? String(data.projects.find((item) => item.id === data.context.projectId)?.name ?? "Linked project") : "No project linked"}</span>
      </div>
    </section>

    <section className="data-surface meeting-capture-inputs">
      <label htmlFor="meeting-summary">Summary <span>Optional</span></label>
      <textarea className="resize-none" id="meeting-summary" rows={4} value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="What mattered most?" />
      <label htmlFor="meeting-raw-notes">Raw notes <span>Optional</span></label>
      <textarea className="resize-none" id="meeting-raw-notes" rows={8} value={rawNotes} onChange={(event) => setRawNotes(event.target.value)} placeholder={'Task: Finalize campaign caption\nDecision: Visual 2 approved\nFollow-up: Send invoice next week'} />
      <p className="dataset-note">Suggestions use only explicitly labelled statements. Dates and relationships remain yours to confirm.</p>
      <div className="integration-actions"><Button intent="brand" disabled={busy || !rawNotes.trim()} onClick={() => void generateSuggestions()}>{busy ? "Generating…" : "Generate suggestions"}</Button><Button emphasis="outline" disabled={busy || !summary.trim()} onClick={review}>Review summary only</Button><Button emphasis="ghost" onClick={() => router.back()}>Cancel</Button></div>
    </section>

    {phase === "review" || items.length ? <section className="meeting-items-section">
      <div className="meeting-items-heading"><div><p className="eyebrow">Review individually</p><h2>Suggested and manual items</h2></div><span className="status">{items.filter((item) => item.included).length} included</span></div>
      {items.length ? <div className="meeting-item-list">{items.map((item) => <MeetingItemCard key={item.id} item={item} projects={data.projects} clients={data.clients} onChange={(patch) => patchItem(item.id, patch)} onRemove={() => setItems((current) => current.filter((candidate) => candidate.id !== item.id))} />)}</div> : <div className="empty-state"><span>＋</span><h2>No structured items yet</h2><p>Add one manually, or save a summary-only meeting outcome.</p></div>}
      <div className="meeting-add-actions">{meetingItemTypes.map((type) => <Button emphasis="outline" key={type} onClick={() => addItem(type)}>+ Add {labels[type].toLowerCase()}</Button>)}</div>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      <div className="meeting-final-action"><div><strong>Create meeting actions</strong><small>{Object.entries(counts).filter(([, count]) => count).map(([type, count]) => `${count} ${count === 1 ? labels[type as MeetingItemType] : pluralLabels[type as MeetingItemType]}`).join(" · ") || (summary.trim() ? "Summary only" : "Nothing selected")}</small></div><Button intent="brand" disabled={busy} onClick={review}>Review selected items</Button></div>
    </section> : <section className="data-surface meeting-manual-fallback"><p className="eyebrow">Manual capture</p><p>AI is optional. Add structured records directly whenever you prefer.</p><div className="meeting-add-actions">{meetingItemTypes.map((type) => <Button emphasis="outline" key={type} onClick={() => addItem(type)}>+ Add {labels[type].toLowerCase()}</Button>)}</div>{error ? <p className="field-error" role="alert">{error}</p> : null}</section>}

    <Modal open={confirming} onClose={() => !busy && setConfirming(false)} title="Create meeting actions" description="Only the included records below will be created.">
      <div className="meeting-confirmation">
        {Object.entries(counts).filter(([, count]) => count).map(([type, count]) => <div className="signal-row" key={type}><strong>{count} {count === 1 ? labels[type as MeetingItemType] : pluralLabels[type as MeetingItemType]}</strong></div>)}
        {!items.some((item) => item.included) ? <p className="dataset-note">Save the meeting summary without creating action records.</p> : null}
        <div className="modal__actions"><Button emphasis="ghost" disabled={busy} onClick={() => setConfirming(false)}>Back</Button><Button intent="brand" disabled={busy} onClick={() => void execute()}>{busy ? "Creating…" : "Create selected items"}</Button></div>
      </div>
    </Modal>
  </div>;
}

function MeetingItemCard({ item, projects, clients, onChange, onRemove }: { item: MeetingCaptureItem; projects: Row[]; clients: Row[]; onChange: (patch: Partial<MeetingCaptureItem>) => void; onRemove: () => void }) {
  const fieldId = (name: string) => `${item.id}-${name}`;
  return <article className={`meeting-item-card${item.included ? "" : " meeting-item-card--excluded"}`}>
    <header><div><p className="eyebrow">{labels[item.type]} · {item.source}</p>{item.evidence ? <small>Suggested because: “{item.evidence}”</small> : null}</div><label className="meeting-include"><input type="checkbox" checked={item.included} onChange={(event) => onChange({ included: event.target.checked })} /> Include</label></header>
    <div className="meeting-item-fields">
      <div className="meeting-field--wide"><label htmlFor={fieldId("title")}>Title</label><input id={fieldId("title")} value={item.title} onChange={(event) => onChange({ title: event.target.value })} /></div>
      {item.type === "task" ? <><LongTextField id={fieldId("description")} label="Description" value={item.description} onChange={(description) => onChange({ description })} /><Field id={fieldId("due") } label="Due date" type="date" value={item.due_date} onChange={(due_date) => onChange({ due_date })} /><div><label htmlFor={fieldId("priority")}>Priority</label><select id={fieldId("priority")} value={item.priority ?? "none"} onChange={(event) => onChange({ priority: event.target.value as MeetingCaptureItem["priority"] })}>{["none","low","medium","high","urgent"].map((value) => <option value={value} key={value}>{value}</option>)}</select></div></> : null}
      {item.type === "decision" ? <><LongTextField id={fieldId("context")} label="Context" value={item.context} onChange={(context) => onChange({ context })} /><LongTextField id={fieldId("outcome")} label="Decision / outcome" value={item.outcome} onChange={(outcome) => onChange({ outcome })} /><Field id={fieldId("review") } label="Review date" type="date" value={item.review_date} onChange={(review_date) => onChange({ review_date })} /></> : null}
      {item.type === "followup" ? <><Field id={fieldId("due") } label="Due" type="datetime-local" value={toDateTimeInput(item.due_at)} onChange={(due_at) => onChange({ due_at })} /><LongTextField id={fieldId("notes")} label="Notes" value={item.notes} onChange={(notes) => onChange({ notes })} /></> : null}
      {item.type === "waiting" ? <><Field id={fieldId("waiting") } label="Waiting on" value={item.waiting_on} onChange={(waiting_on) => onChange({ waiting_on })} /><Field id={fieldId("expected") } label="Follow-up date" type="datetime-local" value={toDateTimeInput(item.expected_by)} onChange={(expected_by) => onChange({ expected_by })} /><LongTextField id={fieldId("notes")} label="Notes" value={item.notes} onChange={(notes) => onChange({ notes })} /></> : null}
      {item.type === "note" ? <><LongTextField id={fieldId("content")} label="Content" value={item.content} onChange={(content) => onChange({ content })} /><Field id={fieldId("category") } label="Category" value={item.category} onChange={(category) => onChange({ category })} /></> : null}
      <SearchLink label="Project" rows={projects} field="name" selected={item.project_id ?? ""} onChange={(project_id) => onChange({ project_id: project_id || null })} />
      <SearchLink label="Client" rows={clients} field="name" selected={item.client_id ?? ""} onChange={(client_id) => onChange({ client_id: client_id || null })} />
    </div>
    <Button emphasis="ghost" intent="danger" onClick={onRemove}>Remove item</Button>
  </article>;
}

function Field({ id, label, value, onChange, type = "text" }: { id: string; label: string; value: string | null | undefined; onChange: (value: string) => void; type?: "text" | "date" | "datetime-local" }) {
  return <div><label htmlFor={id}>{label} <span>Optional</span></label><input id={id} type={type} value={value ?? ""} onChange={(event) => onChange(event.target.value)} /></div>;
}
function LongTextField({ id, label, value, onChange }: { id: string; label: string; value: string | null | undefined; onChange: (value: string) => void }) {
  return <div className="meeting-field--wide"><label htmlFor={id}>{label} <span>Optional</span></label><textarea className="resize-none" id={id} rows={3} value={value ?? ""} onChange={(event) => onChange(event.target.value)} /></div>;
}

function MeetingCaptureSuccess({ result, data, onDone }: { result: CaptureResult; data: ContextData; onDone: () => void }) {
  return <section className="data-surface meeting-capture-success"><p className="eyebrow">Meeting outcome saved</p><h2>{result.records.length ? `${result.records.length} record${result.records.length === 1 ? "" : "s"} created` : "Summary saved"}</h2>{result.summary ? <p>{result.summary}</p> : null}{result.records.length ? <div className="meeting-created-list">{result.records.map((record) => <Link className="signal-row" href={record.route} key={`${record.type}-${record.id}`}><span><strong>{labels[record.type]} — {record.title}</strong>Open record</span></Link>)}</div> : <p className="dataset-note">No action records were created for this meeting.</p>}<div className="integration-actions"><Button intent="brand" onClick={onDone}>Done</Button>{data.context.clientId ? <Link className="button button--outline button--neutral" href={`/clients/${data.context.clientId}`}>Open client</Link> : null}{data.context.projectId ? <Link className="button button--outline button--neutral" href={`/projects/${data.context.projectId}`}>Open project</Link> : null}</div></section>;
}

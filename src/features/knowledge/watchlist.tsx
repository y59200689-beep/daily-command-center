"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useDeferredEffect } from "@/lib/use-deferred-effect";

type WatchEntity = { id: string; name: string; watch_type: string; status: string; next_check_at: string | null; last_checked_at: string | null; notes: string | null; topic_id: string | null };
type WatchUpdate = { id: string; watch_id: string; update_type: string; summary: string; observed_at: string; created_at: string };
type Topic = { id: string; title: string };

const WATCH_TYPES = ["competitor","brand","supplier","market","technology","platform","regulation","product_category","custom","other"];
const STATUS_LABELS: Record<string,string> = { active:"Active", paused:"Paused", archived:"Archived" };

function WatchForm({ item, topics, onClose, onSave }: { item?: WatchEntity | null; topics: Topic[]; onClose: () => void; onSave: (v: Record<string,unknown>) => Promise<void> }) {
  const [name, setName] = useState(item?.name ?? "");
  const [watchType, setWatchType] = useState(item?.watch_type ?? "competitor");
  const [topicId, setTopicId] = useState(item?.topic_id ?? "");
  const [nextCheck, setNextCheck] = useState(item?.next_check_at ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [saving, setSaving] = useState(false);
  return (
    <Modal open onClose={onClose} title={item ? "Edit watch item" : "New watch item"} description="Track a competitor, brand, market, or custom signal without fabricating data.">
      <form className="simple-form" onSubmit={async (e) => { e.preventDefault(); setSaving(true); await onSave({ name, watch_type: watchType, topic_id: topicId || null, next_check_at: nextCheck || null, notes: notes || null }); setSaving(false); onClose(); }}>
        <label>Name<input required value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>Watch type
          <select value={watchType} onChange={(e) => setWatchType(e.target.value)}>
            {WATCH_TYPES.map((t) => <option key={t} value={t}>{t.replaceAll("_"," ")}</option>)}
          </select>
        </label>
        {topics.length ? (
          <label>Linked topic (optional)
            <select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
              <option value="">No topic</option>
              {topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </label>
        ) : null}
        <label>Next review date (optional)<input type="date" value={nextCheck} onChange={(e) => setNextCheck(e.target.value)} /></label>
        <label>Notes (optional)<textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        <div className="modal__actions">
          <Button emphasis="ghost" type="button" onClick={onClose}>Cancel</Button>
          <Button intent="brand" type="submit" disabled={saving}>{saving ? "Saving…" : item ? "Save changes" : "Create watch item"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function UpdateForm({ watchId, onClose, onSave }: { watchId: string; onClose: () => void; onSave: () => Promise<void> }) {
  const [summary, setSummary] = useState("");
  const [updateType, setUpdateType] = useState("observation");
  const [observedAt, setObservedAt] = useState(new Date().toISOString().slice(0,10));
  const [saving, setSaving] = useState(false);
  const UPDATE_TYPES = ["observation","pricing_change","product_change","announcement","market_shift","regulatory","partnership","other"];
  return (
    <Modal open onClose={onClose} title="Add watch update" description="Record an observation. Use your own sourced information only.">
      <form className="simple-form" onSubmit={async (e) => { e.preventDefault(); setSaving(true); const body = JSON.stringify({ watch_id: watchId, summary, update_type: updateType, observed_at: new Date(observedAt + "T12:00:00Z").toISOString() }); await fetch("/api/knowledge/watch_updates", { method: "POST", headers: { "Content-Type": "application/json" }, body }); await onSave(); setSaving(false); onClose(); }}>
        <label>Summary <small style={{ fontWeight: 400, color: "var(--muted)" }}>(your own sourced observation)</small>
          <textarea required rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={4000} />
        </label>
        <label>Update type
          <select value={updateType} onChange={(e) => setUpdateType(e.target.value)}>
            {UPDATE_TYPES.map((t) => <option key={t} value={t}>{t.replaceAll("_"," ")}</option>)}
          </select>
        </label>
        <label>Observed on<input type="date" required value={observedAt} onChange={(e) => setObservedAt(e.target.value)} /></label>
        <div className="modal__actions">
          <Button emphasis="ghost" type="button" onClick={onClose}>Cancel</Button>
          <Button intent="brand" type="submit" disabled={saving}>{saving ? "Adding…" : "Add update"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function WatchDetail({ item, updates, topics, onChanged, onBack }: { item: WatchEntity; updates: WatchUpdate[]; topics: Topic[]; onChanged: () => Promise<void>; onBack: () => void }) {
  const [editing, setEditing] = useState(false);
  const [addingUpdate, setAddingUpdate] = useState(false);
  const [error, setError] = useState("");
  const itemUpdates = updates.filter((u) => u.watch_id === item.id).sort((a,b) => Date.parse(b.observed_at) - Date.parse(a.observed_at));
  const patch = async (values: Record<string,unknown>) => {
    const r = await fetch(`/api/knowledge/watches/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    if (!r.ok) { setError("Watch item could not be updated."); return; }
    await onChanged();
  };
  const markReviewed = () => patch({ last_checked_at: new Date().toISOString(), next_check_at: new Date(Date.now() + 7*86400000).toISOString().slice(0,10) });
  const archive = () => patch({ status: "archived" });
  const togglePause = () => patch({ status: item.status === "paused" ? "active" : "paused" });
  const deleteUpdate = async (id: string) => {
    await fetch(`/api/knowledge/watch_updates/${id}`, { method: "DELETE" });
    await onChanged();
  };
  return (
    <div className="knowledge-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Knowledge · Watchlist</p>
          <h1>{item.name}</h1>
          <p>{item.watch_type.replaceAll("_"," ")} · {STATUS_LABELS[item.status] ?? item.status}{item.next_check_at ? ` · Review by ${item.next_check_at}` : ""}</p>
        </div>
        <div className="strategy-actions">
          <Button emphasis="ghost" onClick={onBack}>← All watches</Button>
          <Button emphasis="outline" onClick={() => void markReviewed()}>Mark reviewed</Button>
          <Button emphasis="outline" onClick={() => void togglePause()}>{item.status === "paused" ? "Resume" : "Pause"}</Button>
          <Button emphasis="ghost" onClick={() => void archive()}>Archive</Button>
          <Button intent="brand" onClick={() => setEditing(true)}>Edit</Button>
        </div>
      </header>
      {error ? <p role="alert" className="field-error">{error}</p> : null}
      {item.notes ? <p style={{ color: "var(--muted)", maxWidth: 640 }}>{item.notes}</p> : null}
      {item.topic_id ? <p className="dataset-note"><Link href={`/knowledge/topics/${item.topic_id}`} style={{ color: "var(--attention)" }}>Open linked topic →</Link></p> : null}
      <section className="knowledge-section data-surface">
        <header>
          <div>
            <p className="eyebrow">Updates</p>
            <h2>Observation timeline</h2>
          </div>
          <Button intent="brand" onClick={() => setAddingUpdate(true)}>Add update</Button>
        </header>
        {itemUpdates.length ? (
          <div className="signal-stack">
            {itemUpdates.map((u) => (
              <article className="signal-row" key={u.id}>
                <span>
                  <strong>{u.update_type.replaceAll("_"," ")}</strong>
                  <small>{u.observed_at.slice(0,10)}</small>
                </span>
                <p style={{ margin: "6px 0 0", gridColumn: "1 / -1", color: "var(--ink)", fontSize: 12 }}>{u.summary}</p>
                <div className="integration-actions">
                  <Button emphasis="ghost" onClick={() => void deleteUpdate(u.id)}>Remove</Button>
                </div>
              </article>
            ))}
          </div>
        ) : <p className="dataset-note">No updates recorded yet. Add your first observation.</p>}
      </section>
      {editing ? <WatchForm item={item} topics={topics} onClose={() => setEditing(false)} onSave={async (v) => { await patch(v); }} /> : null}
      {addingUpdate ? <UpdateForm watchId={item.id} onClose={() => setAddingUpdate(false)} onSave={onChanged} /> : null}
    </div>
  );
}

export function Watchlist({ selectedId }: { selectedId?: string }) {
  const [items, setItems] = useState<WatchEntity[]>([]);
  const [updates, setUpdates] = useState<WatchUpdate[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<WatchEntity | null>(null);
  const [error, setError] = useState("");
  const [schemaUnavailable, setSchemaUnavailable] = useState(false);
  const [filter, setFilter] = useState<"all"|"active"|"paused">("active");

  const load = useCallback(async () => {
    const [watchesRes, updatesRes, topicsRes] = await Promise.all([
      fetch("/api/knowledge/watches", { cache: "no-store" }),
      fetch("/api/knowledge/watch_updates", { cache: "no-store" }),
      fetch("/api/knowledge/topics", { cache: "no-store" }),
    ]);
    const [wBody, uBody, tBody] = await Promise.all([watchesRes.json(), updatesRes.json(), topicsRes.json()]);
    if (watchesRes.ok) {
      setSchemaUnavailable([wBody, uBody, tBody].some((body) => body.schemaStatus === "unavailable"));
      setItems(wBody.items ?? []);
      if (selectedId) setSelected((wBody.items ?? []).find((i: WatchEntity) => i.id === selectedId) ?? null);
    } else setError(wBody.error ?? "Watchlist could not be loaded.");
    if (updatesRes.ok) setUpdates(uBody.items ?? []);
    if (topicsRes.ok) setTopics(tBody.items ?? []);
  }, [selectedId]);

  useDeferredEffect(useCallback(() => { void load(); }, [load]));

  const filtered = filter === "all" ? items : items.filter((i) => i.status === filter);
  const today = new Date().toISOString().slice(0,10);

  if (selected) {
    return <WatchDetail item={selected} updates={updates} topics={topics} onChanged={async () => { await load(); const refreshed = items.find((i) => i.id === selected.id); if (refreshed) setSelected(refreshed); }} onBack={() => setSelected(null)} />;
  }

  return (
    <main className="domain-page knowledge-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Knowledge · Observation</p>
          <h1>Watchlist.</h1>
          <p>{items.filter((i) => i.status === "active").length} active · {items.filter((i) => i.next_check_at && i.next_check_at <= today && i.status === "active").length} due for review</p>
        </div>
        <div className="strategy-actions">
          <Link className="button button--outline" href="/knowledge">Knowledge</Link>
          {!schemaUnavailable ? <Button intent="brand" onClick={() => setCreating(true)}>New watch item</Button> : null}
        </div>
      </header>
      {error ? <p role="alert" className="field-error">{error}</p> : null}
      {schemaUnavailable ? <section className="data-surface empty-state"><h2>Knowledge is not configured</h2><p>This environment is missing the V9 knowledge schema. Watch items will be available after that dependency is installed.</p></section> : <><div className="content-stage-strip">
        {(["active","paused","all"] as const).map((f) => (
          <button key={f} className={filter === f ? "active" : ""} onClick={() => setFilter(f)}>{f === "all" ? "All" : STATUS_LABELS[f]}</button>
        ))}
      </div>
      <section className="knowledge-section data-surface">
        <div className="signal-stack">
          {filtered.length ? filtered.map((item) => (
            <button key={item.id} className="signal-row data-row--button" onClick={() => setSelected(item)}>
              <span>
                <strong>{item.name}</strong>
                <small>{item.watch_type.replaceAll("_"," ")} · {STATUS_LABELS[item.status]}{item.next_check_at && item.next_check_at <= today ? " · Due for review" : item.next_check_at ? ` · Review ${item.next_check_at}` : ""}</small>
              </span>
            </button>
          )) : <p className="dataset-note">No {filter === "all" ? "" : filter + " "}watch items. Create one to start tracking signals.</p>}
        </div>
      </section>
      </>}
      {creating ? <WatchForm topics={topics} onClose={() => setCreating(false)} onSave={async (v) => { await fetch("/api/knowledge/watches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) }); await load(); }} /> : null}
    </main>
  );
}

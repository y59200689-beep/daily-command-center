"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/toast-provider";
import { calendarSourceLabel, type CalendarConflictDisplayType, type ScheduleOverlap } from "@/lib/calendar-conflicts";
import { useDeferredEffect } from "@/lib/use-deferred-effect";
import { announceWorkspaceMutation, subscribeToWorkspaceMutations } from "@/lib/workspace-mutations";
import type { DomainRecord } from "@/lib/domains";
import type { CalendarSnapshot } from "@/lib/v4";

type SyncConflict = {
  id: string;
  kind: "sync";
  conflict_type: CalendarConflictDisplayType;
  local_event: DomainRecord;
  local_snapshot: CalendarSnapshot;
  remote_snapshot: CalendarSnapshot | null;
  conflicting_fields: Array<keyof CalendarSnapshot>;
  provider_deleted: boolean;
  local_delete_intent: boolean;
  conflict_detected_at: string | null;
  recurrence_scope: string;
  recurrence_ambiguous: boolean;
};

type ResolutionAction = "keep_local" | "keep_google" | "restore_google" | "delete_local" | "delete_anyway" | "keep_google_after_delete" | "refresh";
type Selected = { kind: "overlap"; value: ScheduleOverlap } | { kind: "sync"; value: SyncConflict };

const conflictCopy: Record<CalendarConflictDisplayType, { label: string; description: string }> = {
  concurrent_edit: { label: "Needs review", description: "Edited both locally and in Google Calendar" },
  external_deleted: { label: "Deleted externally", description: "Deleted in Google Calendar with local changes remaining" },
  remote_changed_before_local_delete: { label: "Delete conflict", description: "Google changed before the local deletion could finish" },
  manual_review: { label: "Manual review", description: "Calendar identity or synchronization history needs review" },
};

const fieldLabels: Record<keyof CalendarSnapshot, string> = {
  title: "Title", description: "Description", start: "Start", end: "End", all_day: "All-day", timezone: "Timezone", recurrence: "Recurrence", recurring_event_id: "Recurring event", original_start_time: "Original occurrence",
};

function relativeTime(value: string | null) {
  if (!value) return "Recently detected";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "Detected just now";
  if (minutes < 60) return `Detected ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `Detected ${hours}h ago` : `Detected ${Math.round(hours / 24)}d ago`;
}

function snapshotValue(field: keyof CalendarSnapshot, value: CalendarSnapshot[keyof CalendarSnapshot], allDay: boolean) {
  if (field === "all_day") return value ? "Yes" : "No";
  if (value === null || value === "") return "—";
  if (field === "start" || field === "end") {
    if (allDay) return new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(new Date(`${String(value).slice(0, 10)}T12:00:00`));
    return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(String(value)));
  }
  return String(value);
}

function EventCard({ event }: { event: ScheduleOverlap["first"] }) {
  const start = new Date(event.starts_at);
  const end = new Date(event.ends_at);
  const allDayDate = event.all_day ? new Date(`${event.starts_at.slice(0, 10)}T12:00:00`) : null;
  return <article className="conflict-event-card"><p className="eyebrow">{calendarSourceLabel(event.source)}</p><h3>{event.title}</h3><p>{allDayDate ? allDayDate.toLocaleDateString([], { dateStyle: "long" }) : `${start.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}–${end.toLocaleTimeString([], { timeStyle: "short" })}`}</p>{event.timezone ? <small>{event.timezone}</small> : null}</article>;
}

function SnapshotComparison({ conflict }: { conflict: SyncConflict }) {
  const remote = conflict.remote_snapshot;
  if (!remote) return <div className="conflict-version"><p className="eyebrow">Local version</p><h3>{conflict.local_snapshot.title}</h3><p>{snapshotValue("start", conflict.local_snapshot.start, conflict.local_snapshot.all_day)}</p><small>{conflict.recurrence_scope}</small></div>;
  return <div className="conflict-comparison" aria-label="Local and Google Calendar versions">
    <section className="conflict-version"><p className="eyebrow">Local version</p>{(Object.keys(fieldLabels) as Array<keyof CalendarSnapshot>).map((field) => <div className={conflict.conflicting_fields.includes(field) ? "conflict-field conflict-field--changed" : "conflict-field"} key={field}><span>{fieldLabels[field]}</span><strong>{snapshotValue(field, conflict.local_snapshot[field], conflict.local_snapshot.all_day)}</strong></div>)}</section>
    <section className="conflict-version"><p className="eyebrow">Google version</p>{(Object.keys(fieldLabels) as Array<keyof CalendarSnapshot>).map((field) => <div className={conflict.conflicting_fields.includes(field) ? "conflict-field conflict-field--changed" : "conflict-field"} key={field}><span>{fieldLabels[field]}</span><strong>{snapshotValue(field, remote[field], remote.all_day)}</strong></div>)}</section>
  </div>;
}

export function CalendarConflicts({ onEdit, onResolved }: { onEdit: (event: DomainRecord) => void; onResolved: () => Promise<void> }) {
  const [overlaps, setOverlaps] = useState<ScheduleOverlap[]>([]);
  const [syncConflicts, setSyncConflicts] = useState<SyncConflict[]>([]);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [confirming, setConfirming] = useState<ResolutionAction | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const searchParams = useSearchParams();
  const requestedConflictId = searchParams.get("conflict");
  const router = useRouter();
  const { showToast } = useToast();

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/calendar/conflicts", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      const nextOverlaps = body.conflicts ?? [];
      const nextSync = body.syncConflicts ?? [];
      setOverlaps(nextOverlaps);
      setSyncConflicts(nextSync);
      setSelected((current) => current?.kind === "sync" ? (nextSync.find((item: SyncConflict) => item.id === current.value.id) ? { kind: "sync", value: nextSync.find((item: SyncConflict) => item.id === current.value.id) } : null) : current);
      if (requestedConflictId) {
        const match = nextSync.find((item: SyncConflict) => item.id === requestedConflictId);
        if (match) setSelected({ kind: "sync", value: match });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Calendar conflicts could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [requestedConflictId]);

  useDeferredEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => subscribeToWorkspaceMutations(["calendar"], () => { void load(); }), [load]);

  async function completeRefresh(message: string) {
    await load();
    await onResolved();
    announceWorkspaceMutation("calendar");
    showToast(message);
  }

  async function keepBoth() {
    if (selected?.kind !== "overlap") return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/calendar/conflicts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "overlap", action: "keep_both", versionKey: selected.value.versionKey }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setSelected(null);
      await completeRefresh("Overlap kept intentionally.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The overlap could not be acknowledged."); } finally { setBusy(false); }
  }

  async function resolve(action: ResolutionAction) {
    if (selected?.kind !== "sync") return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/calendar/conflicts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "sync", conflictId: selected.value.id, action }) });
      const body = await response.json();
      if (!response.ok) {
        if (body.status === "stale_conflict") await load();
        throw new Error(body.error);
      }
      setSelected(null); setConfirming(null);
      await completeRefresh(action === "restore_google" ? "Event restored to Google Calendar." : action === "delete_local" || action === "delete_anyway" ? "Calendar event deleted." : "Calendar conflict resolved.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Calendar conflict could not be resolved."); } finally { setBusy(false); }
  }

  function openOverlapItem(item: ScheduleOverlap["first"]) {
    setSelected(null);
    if (item.source === "google" || item.source === "local") onEdit({ ...item, id: item.source_record_id ?? item.id });
    else router.push(item.source === "focus" ? "/focus" : "/plan");
  }

  const count = overlaps.length + syncConflicts.length;
  if (!count && !error && !loading) return null;
  return <section className="calendar-conflict-center data-surface" aria-labelledby="calendar-conflicts-title">
    <div className="conflict-center-heading"><div><p className="eyebrow">Conflicts</p><h2 id="calendar-conflicts-title">Review before anything is overwritten.</h2></div>{count ? <span className="status status--amber">{count} unresolved</span> : null}</div>
    {loading ? <p className="dataset-note" role="status">Checking Calendar conflicts…</p> : null}
    {error && !selected ? <div className="inline-error" role="alert"><p>{error}</p><Button emphasis="ghost" onClick={() => void load()}>Try again</Button></div> : null}
    {syncConflicts.slice(0, 5).map((conflict) => <article className="conflict-list-row" key={conflict.id}><div><span className="conflict-badge">{conflictCopy[conflict.conflict_type].label}</span><h3>{String(conflict.local_event.title ?? conflict.local_snapshot.title)}</h3><p>{conflictCopy[conflict.conflict_type].description}</p><small>{relativeTime(conflict.conflict_detected_at)} · {conflict.recurrence_scope}</small></div><Button emphasis="outline" onClick={() => { setError(""); setSelected({ kind: "sync", value: conflict }); }}>Review</Button></article>)}
    {overlaps.slice(0, Math.max(0, 5 - syncConflicts.length)).map((conflict) => <article className="conflict-list-row" key={conflict.id}><div><span className="conflict-badge">Time overlap</span><h3>{conflict.first.title} overlaps {conflict.second.title}</h3><p>{conflict.overlapMinutes} min overlap · {calendarSourceLabel(conflict.first.source)} and {calendarSourceLabel(conflict.second.source)}</p></div><Button emphasis="outline" onClick={() => { setError(""); setSelected({ kind: "overlap", value: conflict }); }}>Review</Button></article>)}

    {selected?.kind === "overlap" ? <Modal open onClose={() => { if (!busy) setSelected(null); }} title="Calendar conflict" description={`${selected.value.overlapMinutes} minutes overlap. Nothing will be rescheduled automatically.`}><div className="form-stack"><EventCard event={selected.value.first} /><p className="conflict-between">overlaps with</p><EventCard event={selected.value.second} />{error ? <p className="field-error" role="alert">{error}</p> : null}<div className="modal__actions modal__actions--wrap"><Button disabled={busy} onClick={() => void keepBoth()}>{busy ? "Saving…" : "Keep both"}</Button><Button emphasis="outline" disabled={busy} onClick={() => openOverlapItem(selected.value.first)}>{selected.value.first.source === "focus" ? "Open focus" : selected.value.first.source === "daily_plan" ? "Open plan" : "Edit first"}</Button><Button emphasis="outline" disabled={busy} onClick={() => openOverlapItem(selected.value.second)}>{selected.value.second.source === "focus" ? "Open focus" : selected.value.second.source === "daily_plan" ? "Open plan" : "Edit second"}</Button><Button emphasis="ghost" disabled={busy} onClick={() => setSelected(null)}>Cancel</Button></div></div></Modal> : null}

    {selected?.kind === "sync" ? <SyncConflictModal conflict={selected.value} busy={busy} error={error} confirming={confirming} onConfirming={setConfirming} onClose={() => { if (!busy) { setSelected(null); setConfirming(null); } }} onResolve={resolve} onEdit={() => { const event = selected.value.local_event; setSelected(null); onEdit(event); }} /> : null}
  </section>;
}

function SyncConflictModal({ conflict, busy, error, confirming, onConfirming, onClose, onResolve, onEdit }: { conflict: SyncConflict; busy: boolean; error: string; confirming: ResolutionAction | null; onConfirming: (action: ResolutionAction | null) => void; onClose: () => void; onResolve: (action: ResolutionAction) => Promise<void>; onEdit: () => void }) {
  const title = conflict.conflict_type === "external_deleted" ? "Event deleted in Google" : conflict.conflict_type === "remote_changed_before_local_delete" ? "Delete conflict" : conflict.conflict_type === "manual_review" ? "Manual review required" : "Sync conflict";
  const description = conflict.conflict_type === "external_deleted" ? "This event was deleted in Google Calendar, but you still have local changes." : conflict.conflict_type === "remote_changed_before_local_delete" ? "You tried to delete this event locally, but the Google version changed first." : conflict.conflict_type === "manual_review" ? "The event needs a deliberate source choice before synchronization can continue." : "This event was changed both in Daily Command Center and Google Calendar.";
  const destructive = confirming === "delete_local" || confirming === "delete_anyway";
  return <Modal open onClose={onClose} title={title} description={description}><div className="form-stack"><SnapshotComparison conflict={conflict} /><p className="conflict-scope"><strong>Scope</strong><span>{conflict.recurrence_scope}</span></p>{conflict.recurrence_ambiguous ? <div className="inline-error" role="alert"><p>This recurring occurrence has ambiguous provider identity. Resolve it manually, then sync again.</p></div> : null}{error ? <div className="inline-error" role="alert"><p>{error}</p>{error.includes("changed while") ? <Button emphasis="outline" disabled={busy} onClick={() => void onResolve("refresh")}>Review latest</Button> : null}</div> : null}{destructive ? <div className="conflict-confirm" role="alert"><p>{confirming === "delete_anyway" ? "Delete the current Google event and archive the local event?" : "Archive the local event and discard its remaining local changes?"}</p><div className="integration-actions"><Button emphasis="danger" disabled={busy} onClick={() => void onResolve(confirming)}>{busy ? "Deleting…" : confirming === "delete_anyway" ? "Delete anyway" : "Delete local"}</Button><Button emphasis="ghost" disabled={busy} onClick={() => onConfirming(null)}>Cancel</Button></div></div> : <div className="modal__actions modal__actions--wrap">
    {conflict.conflict_type === "concurrent_edit" ? <><Button disabled={busy || conflict.recurrence_ambiguous} onClick={() => void onResolve("keep_local")}>{busy ? "Resolving…" : "Keep local"}</Button><Button emphasis="outline" disabled={busy || conflict.recurrence_ambiguous} onClick={() => void onResolve("keep_google")}>Keep Google</Button></> : null}
    {conflict.conflict_type === "external_deleted" ? <><Button disabled={busy || conflict.recurrence_ambiguous} onClick={() => void onResolve("restore_google")}>{busy ? "Restoring…" : "Restore to Google"}</Button><Button emphasis="danger" disabled={busy} onClick={() => onConfirming("delete_local")}>Delete local</Button></> : null}
    {conflict.conflict_type === "remote_changed_before_local_delete" ? <><Button emphasis="danger" disabled={busy || conflict.recurrence_ambiguous} onClick={() => onConfirming("delete_anyway")}>Delete anyway</Button><Button disabled={busy || conflict.recurrence_ambiguous} onClick={() => void onResolve("keep_google_after_delete")}>Keep Google event</Button></> : null}
    {conflict.conflict_type === "manual_review" ? <><Button emphasis="outline" disabled={busy} onClick={onEdit}>Open local event</Button><a className="button button--outline button--neutral" href="https://calendar.google.com/calendar/" target="_blank" rel="noreferrer">Open Google Calendar</a>{!conflict.recurrence_ambiguous && conflict.remote_snapshot ? <><Button disabled={busy} onClick={() => void onResolve("keep_local")}>Choose local</Button><Button emphasis="outline" disabled={busy} onClick={() => void onResolve("keep_google")}>Choose Google</Button></> : null}</> : null}
    <Button emphasis="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
  </div>}</div></Modal>;
}

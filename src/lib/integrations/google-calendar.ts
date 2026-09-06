import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptToken, encryptToken } from "@/lib/integrations/crypto";
import { calendarSyncDecision, canonicalizeCalendarEvent, type CalendarSnapshot } from "@/lib/v4";
import type { DomainRecord } from "@/lib/domains";
import { calendarConflictDisplayType, recurrenceIdentityIsAmbiguous } from "@/lib/calendar-conflicts";

type Client = SupabaseClient;
type Integration = Record<string, unknown> & { id: string; access_token_encrypted: string; refresh_token_encrypted?: string; expires_at?: string; provider_metadata?: Record<string, unknown> };
type SyncState = Record<string, unknown> & { calendar_event_id: string; base_snapshot?: CalendarSnapshot | null; remote_snapshot?: CalendarSnapshot | null; conflict_type?: string | null; last_synced_etag?: string | null };
type GoogleEvent = Record<string, unknown> & { id?: string; status?: string; etag?: string; updated?: string; summary?: string; description?: string; start?: Record<string, string>; end?: Record<string, string>; recurrence?: string[]; recurringEventId?: string; originalStartTime?: Record<string, string> };

async function integration(client: Client, userId: string) { const { data, error } = await client.from("integrations").select("*").eq("user_id", userId).eq("provider", "google").eq("status", "connected").maybeSingle(); if (error) throw error; if (!data) throw new Error("Google Calendar is not connected."); return data as Integration; }
async function accessToken(client: Client, userId: string, item?: Integration) { const value = item ?? await integration(client, userId); if (value.expires_at && new Date(value.expires_at).getTime() > Date.now() + 60_000) return decryptToken(value.access_token_encrypted); if (!value.refresh_token_encrypted) throw new Error("Google authorization expired. Reconnect Google Calendar."); const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID ?? "", client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "", refresh_token: decryptToken(value.refresh_token_encrypted), grant_type: "refresh_token" }) }); if (!response.ok) { await client.from("integrations").update({ status: "expired" }).eq("id", value.id).eq("user_id", userId); throw new Error("Google authorization expired. Reconnect Google Calendar."); } const token = await response.json() as { access_token: string; expires_in: number }; await client.from("integrations").update({ access_token_encrypted: encryptToken(token.access_token), expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString() }).eq("id", value.id).eq("user_id", userId); return token.access_token; }
class GoogleCalendarError extends Error { constructor(public status: number) { super(status === 401 ? "Google authorization expired. Reconnect Google Calendar." : status === 404 ? "Google Calendar event no longer exists." : status === 412 ? "Google Calendar event changed before it could be saved." : `Google Calendar request failed (${status}).`); } }
async function google(token: string, path: string, init?: RequestInit) { const response = await fetch(`https://www.googleapis.com/calendar/v3${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init?.headers } }); if (!response.ok) throw new GoogleCalendarError(response.status); return response.status === 204 ? null : response.json(); }
export async function listGoogleCalendars(client: Client, userId: string) { const item = await integration(client, userId); const token = await accessToken(client, userId, item); const data = await google(token, "/users/me/calendarList") as { items?: Record<string, unknown>[] }; return { integration: item, calendars: data.items ?? [] }; }

function eventBody(event: Record<string, unknown>) { const allDay = Boolean(event.all_day); const start = allDay ? { date: String(event.starts_at).slice(0, 10) } : { dateTime: String(event.starts_at), timeZone: String(event.timezone ?? "UTC") }; const end = allDay ? { date: String(event.ends_at).slice(0, 10) } : { dateTime: String(event.ends_at), timeZone: String(event.timezone ?? "UTC") }; return { summary: event.title, description: event.description ?? undefined, start, end, recurrence: event.recurrence_rule ? [String(event.recurrence_rule)] : undefined, status: event.status ?? "confirmed" }; }
function hash(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }

export type CalendarPushStatus = "created" | "pushed" | "remote_applied" | "already_synced" | "conflict" | "external_deleted" | "deleted" | "manual_review";
export type CalendarPushResult = { status: CalendarPushStatus; record: DomainRecord; conflict?: Record<string, unknown> };

async function ownedPushState(client: Client, userId: string, integrationId: string, eventId: string) { const result = await client.from("calendar_event_sync_state").select("*").eq("user_id", userId).eq("integration_id", integrationId).eq("calendar_event_id", eventId).maybeSingle(); if (result.error) throw result.error; return result.data as SyncState | null; }
function snapshotRemote(event: GoogleEvent, userId: string, timezone: string) { const row = googleEventToLocalRow(event, userId, timezone); return { row, snapshot: canonicalizeCalendarEvent({ ...row, recurring_event_id: event.recurringEventId ?? null, original_start_time: event.originalStartTime?.dateTime ?? event.originalStartTime?.date ?? null }) }; }
async function updatePushBaseline(client: Client, userId: string, item: Integration, eventId: string, remote: GoogleEvent, snapshot: CalendarSnapshot, localUpdatedAt: unknown) { const result = await client.from("calendar_event_sync_state").upsert({ user_id: userId, calendar_event_id: eventId, integration_id: item.id, provider: "google", provider_event_id: String(remote.id), last_synced_etag: remote.etag ?? null, last_synced_provider_updated_at: remote.updated ?? null, last_synced_local_updated_at: localUpdatedAt ?? new Date().toISOString(), base_snapshot: snapshot, remote_snapshot: null, conflict_type: null, conflict_detected_at: null, provider_deleted: false, local_delete_intent: false }, { onConflict: "user_id,calendar_event_id" }); if (result.error) throw result.error; }
async function persistPushConflict(client: Client, userId: string, item: Integration, event: Record<string, unknown>, state: SyncState | null, remote: GoogleEvent | null, snapshot: CalendarSnapshot | null, type: "sync_conflict" | "external_deleted" | "manual_review", deleteIntent = false) { const fingerprint = hash({ type, base: state?.base_snapshot ?? null, local: canonicalizeCalendarEvent(event), remote: snapshot, etag: remote?.etag ?? null, deleteIntent }); const previous = state?.remote_snapshot ? hash({ type: state.conflict_type, base: state.base_snapshot, local: canonicalizeCalendarEvent(event), remote: state.remote_snapshot, etag: state.last_synced_etag ?? null, deleteIntent: Boolean(state.local_delete_intent) }) : ""; const result = await client.from("calendar_event_sync_state").upsert({ user_id: userId, calendar_event_id: event.id, integration_id: item.id, provider: "google", provider_event_id: String(event.external_event_id), last_synced_etag: remote?.etag ?? state?.last_synced_etag ?? null, last_synced_provider_updated_at: remote?.updated ?? null, base_snapshot: state?.base_snapshot ?? null, remote_snapshot: snapshot, conflict_type: type, conflict_detected_at: fingerprint === previous ? state?.conflict_detected_at : new Date().toISOString(), provider_deleted: type === "external_deleted", local_delete_intent: deleteIntent }, { onConflict: "user_id,calendar_event_id" }); if (result.error) throw result.error; await auditPushConflict(client, userId, String(event.id), type, fingerprint, deleteIntent); return result.data; }
async function auditPushConflict(client: Client, userId: string, eventId: string, type: string, fingerprint: string, deleteIntent: boolean) { const actionType = type === "external_deleted" ? "calendar_remote_deleted_before_push" : deleteIntent ? "calendar_local_delete_remote_conflict" : "calendar_push_conflict_detected"; const existing = await client.from("action_audit_log").select("id").eq("user_id", userId).eq("entity_id", eventId).eq("action_type", actionType).contains("metadata", { fingerprint }).maybeSingle(); if (existing.error) throw existing.error; if (existing.data) return; const inserted = await client.from("action_audit_log").insert({ user_id: userId, actor: "provider", action_type: actionType, entity_type: "calendar_event", entity_id: eventId, provider: "google", summary: deleteIntent ? "Remote Calendar event changed before local deletion." : type === "external_deleted" ? "Google deleted an event with local changes." : "Calendar push stopped because Google also changed.", status: "success", metadata: { fingerprint } }); if (inserted.error) throw inserted.error; }
async function auditPushSuccess(client: Client, userId: string, eventId: string, actionType: string) { const result = await client.from("action_audit_log").insert({ user_id: userId, actor: "provider", action_type: actionType, entity_type: "calendar_event", entity_id: eventId, provider: "google", summary: "Calendar synchronization completed.", status: "success" }); if (result.error) throw result.error; }

export async function pushGoogleEvent(client: Client, userId: string, event: DomainRecord, retry = true): Promise<DomainRecord> {
  let item: Integration; try { item = await integration(client, userId); } catch { return { ...event, sync_result: { status: "already_synced" } }; }
  const owned = await client.from("calendar_events").select("*").eq("id", String(event.id)).eq("user_id", userId).is("deleted_at", null).maybeSingle(); if (owned.error) throw owned.error; if (!owned.data) throw new Error("Calendar event is not available in your workspace."); event = owned.data as DomainRecord;
  const token = await accessToken(client, userId, item); const timezone = String(item.provider_metadata?.timezone ?? event.timezone ?? "UTC"); const calendarId = encodeURIComponent(String(item.provider_metadata?.calendar_id ?? "primary")); const external = event.external_event_id;
  if (!external) {
    const created = await google(token, `/calendars/${calendarId}/events`, { method: "POST", body: JSON.stringify(eventBody(event)) }) as GoogleEvent; const canonical = snapshotRemote(created, userId, timezone); const now = new Date().toISOString(); const saved = await client.from("calendar_events").update({ ...canonical.row, last_synced_at: now }).eq("id", String(event.id)).eq("user_id", userId).select("*").single(); if (saved.error) throw new Error("Google event was created, but local synchronization metadata could not be saved. Sync again to reconcile it."); await updatePushBaseline(client, userId, item, String(event.id), created, canonical.snapshot, saved.data.updated_at); await auditPushSuccess(client, userId, String(event.id), "calendar_local_created_remote"); return { ...saved.data, sync_result: { status: "created" } };
  }
  const state = await ownedPushState(client, userId, item.id, String(event.id)); let remote: GoogleEvent;
  try { remote = await google(token, `/calendars/${calendarId}/events/${encodeURIComponent(String(external))}`) as GoogleEvent; } catch (error) { if (error instanceof GoogleCalendarError && error.status === 404) { const localBase = canonicalizeCalendarEvent(event); const local = state?.base_snapshot ? { ...localBase, recurring_event_id: state.base_snapshot.recurring_event_id, original_start_time: state.base_snapshot.original_start_time } : localBase; if (state?.base_snapshot && sameSnapshot(local, state.base_snapshot)) { const removed = await client.from("calendar_events").update({ status: "cancelled", deleted_at: new Date().toISOString() }).eq("id", String(event.id)).eq("user_id", userId).select("*").single(); if (removed.error) throw removed.error; const marked = await client.from("calendar_event_sync_state").update({ provider_deleted: true, local_delete_intent: false, conflict_type: null, remote_snapshot: null }).eq("calendar_event_id", String(event.id)).eq("user_id", userId).eq("integration_id", item.id); if (marked.error) throw marked.error; return { ...removed.data, sync_result: { status: "external_deleted" } }; } await persistPushConflict(client, userId, item, event, state, null, null, "external_deleted"); return { ...event, sync_result: { status: "external_deleted", conflict: true } }; } throw error; }
  const remoteValue = snapshotRemote(remote, userId, timezone); const localBase = canonicalizeCalendarEvent(event); const localSnapshot = state?.base_snapshot ? { ...localBase, recurring_event_id: state.base_snapshot.recurring_event_id, original_start_time: state.base_snapshot.original_start_time } : localBase;
  if (!state?.base_snapshot) { if (sameSnapshot(localSnapshot, remoteValue.snapshot)) { await updatePushBaseline(client, userId, item, String(event.id), remote, remoteValue.snapshot, event.updated_at); return { ...event, sync_result: { status: "already_synced" } }; } await persistPushConflict(client, userId, item, event, state, remote, remoteValue.snapshot, "manual_review"); return { ...event, sync_result: { status: "manual_review", conflict: true } }; }
  if (state.base_snapshot.recurring_event_id !== remoteValue.snapshot.recurring_event_id || state.base_snapshot.original_start_time !== remoteValue.snapshot.original_start_time) { await persistPushConflict(client, userId, item, event, state, remote, remoteValue.snapshot, "manual_review"); return { ...event, sync_result: { status: "manual_review", conflict: true } }; }
  const decision = calendarSyncDecision(state.base_snapshot, localSnapshot, remoteValue.snapshot);
  if (decision.action === "apply_remote") { const applied = await client.from("calendar_events").update(remoteValue.row).eq("id", String(event.id)).eq("user_id", userId).select("*").single(); if (applied.error) throw applied.error; await updatePushBaseline(client, userId, item, String(event.id), remote, remoteValue.snapshot, applied.data.updated_at); await auditPushSuccess(client, userId, String(event.id), "calendar_remote_applied_before_push"); return { ...applied.data, sync_result: { status: "remote_applied" } }; }
  if (decision.action === "conflict") { await persistPushConflict(client, userId, item, event, state, remote, remoteValue.snapshot, "sync_conflict"); return { ...event, sync_result: { status: "conflict", conflicting_fields: decision.conflictingFields } }; }
  if (decision.action === "noop" || decision.action === "advance_identical") { const metadata = await client.from("calendar_events").update({ external_updated_at: remote.updated ?? null, google_etag: remote.etag ?? null, last_synced_at: new Date().toISOString() }).eq("id", String(event.id)).eq("user_id", userId).select("*").single(); if (metadata.error) throw metadata.error; await updatePushBaseline(client, userId, item, String(event.id), remote, remoteValue.snapshot, metadata.data.updated_at); return { ...metadata.data, sync_result: { status: "already_synced" } }; }
  try {
    const pushed = await google(token, `/calendars/${calendarId}/events/${encodeURIComponent(String(external))}`, { method: "PUT", body: JSON.stringify(eventBody(event)), headers: { "If-Match": String(remote.etag ?? state.last_synced_etag ?? "") } }) as GoogleEvent; const canonical = snapshotRemote(pushed, userId, timezone); const now = new Date().toISOString(); const saved = await client.from("calendar_events").update({ ...canonical.row, last_synced_at: now }).eq("id", String(event.id)).eq("user_id", userId).select("*").single(); if (saved.error) throw new Error("Google was updated, but local synchronization metadata could not be saved. Sync again to reconcile it."); await updatePushBaseline(client, userId, item, String(event.id), pushed, canonical.snapshot, saved.data.updated_at); await auditPushSuccess(client, userId, String(event.id), "calendar_local_pushed"); return { ...saved.data, sync_result: { status: "pushed" } };
  } catch (error) { if (retry && error instanceof GoogleCalendarError && error.status === 412) { await auditPushSuccess(client, userId, String(event.id), "calendar_push_stale_etag"); return pushGoogleEvent(client, userId, event, false); } throw error; }
}

export async function deleteGoogleEvent(client: Client, userId: string, event: DomainRecord, retry = true): Promise<CalendarPushResult> {
  if (!event.external_event_id) return { status: "deleted", record: event }; const item = await integration(client, userId); const owned = await client.from("calendar_events").select("*").eq("id", String(event.id)).eq("user_id", userId).is("deleted_at", null).maybeSingle(); if (owned.error) throw owned.error; if (!owned.data) throw new Error("Calendar event is not available in your workspace."); event = owned.data as DomainRecord;
  const token = await accessToken(client, userId, item); const calendarId = encodeURIComponent(String(item.provider_metadata?.calendar_id ?? "primary")); const state = await ownedPushState(client, userId, item.id, String(event.id)); let remote: GoogleEvent;
  try { remote = await google(token, `/calendars/${calendarId}/events/${encodeURIComponent(String(event.external_event_id))}`) as GoogleEvent; } catch (error) { if (error instanceof GoogleCalendarError && error.status === 404) { const marked = await client.from("calendar_event_sync_state").update({ provider_deleted: true, local_delete_intent: false, conflict_type: null, remote_snapshot: null }).eq("calendar_event_id", String(event.id)).eq("user_id", userId).eq("integration_id", item.id); if (marked.error) throw marked.error; return { status: "deleted", record: event }; } throw error; }
  const remoteValue = snapshotRemote(remote, userId, String(item.provider_metadata?.timezone ?? event.timezone ?? "UTC"));
  if (!state?.base_snapshot) { await persistPushConflict(client, userId, item, event, state, remote, remoteValue.snapshot, "manual_review", true); return { status: "manual_review", record: event, conflict: { delete_intent: true } }; }
  if (!sameSnapshot(remoteValue.snapshot, state.base_snapshot)) { await persistPushConflict(client, userId, item, event, state, remote, remoteValue.snapshot, "sync_conflict", true); return { status: "conflict", record: event, conflict: { delete_intent: true } }; }
  try { await google(token, `/calendars/${calendarId}/events/${encodeURIComponent(String(event.external_event_id))}`, { method: "DELETE", headers: { "If-Match": String(remote.etag ?? state.last_synced_etag ?? "") } }); } catch (error) { if (retry && error instanceof GoogleCalendarError && error.status === 412) { await auditPushSuccess(client, userId, String(event.id), "calendar_push_stale_etag"); return deleteGoogleEvent(client, userId, event, false); } throw error; } const marked = await client.from("calendar_event_sync_state").update({ provider_deleted: true, local_delete_intent: false, conflict_type: null, remote_snapshot: null, last_synced_etag: remote.etag ?? null }).eq("calendar_event_id", String(event.id)).eq("user_id", userId).eq("integration_id", item.id); if (marked.error) throw marked.error; await auditPushSuccess(client, userId, String(event.id), "calendar_local_deleted_remote"); return { status: "deleted", record: event };
}

export type CalendarConflictResolutionAction = "keep_local" | "keep_google" | "restore_google" | "delete_local" | "delete_anyway" | "keep_google_after_delete" | "refresh";
export type CalendarConflictResolutionResult = { status: "resolved" | "stale_conflict" | "manual_review" | "already_resolved"; action: CalendarConflictResolutionAction; record?: DomainRecord; conflict?: Record<string, unknown> };

async function auditResolution(client: Client, userId: string, eventId: string, action: CalendarConflictResolutionAction) {
  const actionType = action === "keep_local" ? "calendar_keep_local" : action === "keep_google" || action === "keep_google_after_delete" ? "calendar_keep_google" : action === "restore_google" ? "calendar_external_delete_restored" : action === "delete_anyway" ? "calendar_local_delete_remote_removed" : "calendar_external_delete_local_removed";
  const result = await client.from("action_audit_log").insert({ user_id: userId, actor: "user", action_type: actionType, entity_type: "calendar_event", entity_id: eventId, provider: "google", summary: "Calendar conflict resolved by the user.", status: "success", metadata: { resolution: action } });
  if (result.error) throw result.error;
}

export async function resolveGoogleCalendarConflict(client: Client, userId: string, conflictId: string, action: CalendarConflictResolutionAction): Promise<CalendarConflictResolutionResult> {
  const stateResult = await client.from("calendar_event_sync_state").select("*").eq("id", conflictId).eq("user_id", userId).maybeSingle();
  if (stateResult.error) throw stateResult.error;
  const state = stateResult.data as SyncState | null;
  if (!state?.conflict_type) return { status: "already_resolved", action };
  const eventResult = await client.from("calendar_events").select("*").eq("id", state.calendar_event_id).eq("user_id", userId).maybeSingle();
  if (eventResult.error) throw eventResult.error;
  if (!eventResult.data) throw new Error("Calendar event is no longer available.");
  const event = eventResult.data as DomainRecord;
  const displayType = calendarConflictDisplayType(String(state.conflict_type), Boolean(state.local_delete_intent));
  const allowed: Record<string, CalendarConflictResolutionAction[]> = {
    concurrent_edit: ["keep_local", "keep_google", "refresh"],
    external_deleted: ["restore_google", "delete_local", "refresh"],
    remote_changed_before_local_delete: ["delete_anyway", "keep_google_after_delete", "refresh"],
    manual_review: ["keep_local", "keep_google", "refresh"],
  };
  if (!allowed[displayType]?.includes(action)) return { status: "manual_review", action, record: event };
  if (action === "delete_local") {
    const saved = await client.from("calendar_events").update({ status: "cancelled", deleted_at: new Date().toISOString() }).eq("id", String(event.id)).eq("user_id", userId).select("*").single();
    if (saved.error) throw saved.error;
    const cleared = await client.from("calendar_event_sync_state").update({ conflict_type: null, conflict_detected_at: null, remote_snapshot: null, local_delete_intent: false, provider_deleted: true }).eq("id", conflictId).eq("user_id", userId);
    if (cleared.error) throw cleared.error;
    await auditResolution(client, userId, String(event.id), action);
    return { status: "resolved", action, record: saved.data as DomainRecord };
  }
  const item = await integration(client, userId);
  if (item.id !== state.integration_id) throw new Error("This Calendar conflict belongs to a different connection.");
  const token = await accessToken(client, userId, item);
  const calendarId = encodeURIComponent(String(item.provider_metadata?.calendar_id ?? "primary"));
  const timezone = String(item.provider_metadata?.timezone ?? event.timezone ?? "UTC");
  const providerPath = `/calendars/${calendarId}/events/${encodeURIComponent(String(state.provider_event_id))}`;
  let remote: GoogleEvent | null = null;
  try { remote = await google(token, providerPath) as GoogleEvent; } catch (error) { if (!(error instanceof GoogleCalendarError) || error.status !== 404) throw error; }
  const remoteValue = remote ? snapshotRemote(remote, userId, timezone) : null;

  if (action === "refresh") {
    if (remote && remoteValue) await persistPushConflict(client, userId, item, event, state, remote, remoteValue.snapshot, state.conflict_type as "sync_conflict" | "external_deleted" | "manual_review", Boolean(state.local_delete_intent));
    return { status: "stale_conflict", action, record: event };
  }

  if ((action === "keep_local" || action === "delete_anyway") && remote?.etag !== state.last_synced_etag) {
    if (remote && remoteValue) await persistPushConflict(client, userId, item, event, state, remote, remoteValue.snapshot, state.conflict_type as "sync_conflict" | "external_deleted" | "manual_review", Boolean(state.local_delete_intent));
    return { status: "stale_conflict", action, record: event, conflict: { provider_etag: remote?.etag ?? null } };
  }
  if ((action === "keep_local" || action === "delete_anyway") && recurrenceIdentityIsAmbiguous(state.base_snapshot ?? null, remoteValue?.snapshot ?? null)) return { status: "manual_review", action, record: event };

  if (action === "keep_local") {
    if (!remote) return { status: "stale_conflict", action, record: event };
    let pushed: GoogleEvent;
    try { pushed = await google(token, providerPath, { method: "PUT", body: JSON.stringify(eventBody(event)), headers: { "If-Match": String(remote.etag ?? "") } }) as GoogleEvent; } catch (error) {
      if (!(error instanceof GoogleCalendarError) || error.status !== 412) throw error;
      const latest = await google(token, providerPath) as GoogleEvent; const latestValue = snapshotRemote(latest, userId, timezone);
      await persistPushConflict(client, userId, item, event, state, latest, latestValue.snapshot, state.conflict_type as "sync_conflict" | "manual_review", Boolean(state.local_delete_intent));
      await auditPushSuccess(client, userId, String(event.id), "calendar_conflict_stale_provider");
      return { status: "stale_conflict", action, record: event };
    }
    const canonical = snapshotRemote(pushed, userId, timezone);
    const saved = await client.from("calendar_events").update({ ...canonical.row, last_synced_at: new Date().toISOString() }).eq("id", String(event.id)).eq("user_id", userId).select("*").single();
    if (saved.error) throw saved.error;
    await updatePushBaseline(client, userId, item, String(event.id), pushed, canonical.snapshot, saved.data.updated_at);
    await auditResolution(client, userId, String(event.id), action);
    return { status: "resolved", action, record: saved.data as DomainRecord };
  }

  if (action === "keep_google" || action === "keep_google_after_delete") {
    if (!remote || !remoteValue) return { status: "stale_conflict", action, record: event };
    const saved = await client.from("calendar_events").update({ ...remoteValue.row, deleted_at: null, status: "confirmed" }).eq("id", String(event.id)).eq("user_id", userId).select("*").single();
    if (saved.error) throw saved.error;
    await updatePushBaseline(client, userId, item, String(event.id), remote, remoteValue.snapshot, saved.data.updated_at);
    await auditResolution(client, userId, String(event.id), action);
    return { status: "resolved", action, record: saved.data as DomainRecord };
  }

  if (action === "restore_google") {
    if (remote) { if (remoteValue) await persistPushConflict(client, userId, item, event, state, remote, remoteValue.snapshot, "sync_conflict", false); return { status: "stale_conflict", action, record: event }; }
    const restored = await google(token, `/calendars/${calendarId}/events`, { method: "POST", body: JSON.stringify(eventBody(event)) }) as GoogleEvent;
    const canonical = snapshotRemote(restored, userId, timezone);
    const saved = await client.from("calendar_events").update({ ...canonical.row, deleted_at: null, status: "confirmed" }).eq("id", String(event.id)).eq("user_id", userId).select("*").single();
    if (saved.error) throw saved.error;
    await updatePushBaseline(client, userId, item, String(event.id), restored, canonical.snapshot, saved.data.updated_at);
    await auditResolution(client, userId, String(event.id), action);
    return { status: "resolved", action, record: saved.data as DomainRecord };
  }

  if (action === "delete_anyway") {
    if (remote) { try { await google(token, providerPath, { method: "DELETE", headers: { "If-Match": String(remote.etag ?? "") } }); } catch (error) { if (!(error instanceof GoogleCalendarError) || error.status !== 412) throw error; const latest = await google(token, providerPath) as GoogleEvent; const latestValue = snapshotRemote(latest, userId, timezone); await persistPushConflict(client, userId, item, event, state, latest, latestValue.snapshot, "sync_conflict", true); await auditPushSuccess(client, userId, String(event.id), "calendar_conflict_stale_provider"); return { status: "stale_conflict", action, record: event }; } }
    const saved = await client.from("calendar_events").update({ status: "cancelled", deleted_at: new Date().toISOString() }).eq("id", String(event.id)).eq("user_id", userId).select("*").single();
    if (saved.error) throw saved.error;
    const cleared = await client.from("calendar_event_sync_state").update({ conflict_type: null, conflict_detected_at: null, remote_snapshot: null, local_delete_intent: false, provider_deleted: true, last_synced_etag: remote?.etag ?? state.last_synced_etag }).eq("id", conflictId).eq("user_id", userId);
    if (cleared.error) throw cleared.error;
    await auditResolution(client, userId, String(event.id), action);
    return { status: "resolved", action, record: saved.data as DomainRecord };
  }

  return { status: "manual_review", action, record: event };
}

export function googleEventToLocalRow(event: GoogleEvent, userId: string, timezone: string) {
  const start = event.start ?? {}; const end = event.end ?? {}; const allDay = Boolean(start.date);
  return { user_id: userId, title: event.summary ?? "Untitled event", description: event.description ?? null, starts_at: start.dateTime ?? `${start.date}T00:00:00.000Z`, ends_at: end.dateTime ?? `${end.date}T00:00:00.000Z`, all_day: allDay, timezone: start.timeZone ?? timezone, provider: "google", external_event_id: String(event.id), external_updated_at: event.updated ?? null, google_etag: event.etag ?? null, sync_hash: hash(eventBody({ title: event.summary, description: event.description, starts_at: start.dateTime ?? start.date, ends_at: end.dateTime ?? end.date, all_day: allDay, timezone: start.timeZone, recurrence_rule: event.recurrence?.[0] ?? null })), last_synced_at: new Date().toISOString(), recurrence_rule: event.recurrence?.[0] ?? null, status: "confirmed", deleted_at: null };
}

function sameSnapshot(first: CalendarSnapshot, second: CalendarSnapshot) { return hash(first) === hash(second); }
function sameConflict(state: SyncState | undefined, type: string, remote: CalendarSnapshot | null, etag: string | null) { return state?.conflict_type === type && state.last_synced_etag === etag && hash(state.remote_snapshot ?? null) === hash(remote); }
async function auditConflict(client: Client, userId: string, eventId: string, type: string, fingerprint: string) { const actionType = type === "external_deleted" ? "calendar_external_delete_conflict_detected" : "calendar_sync_conflict_detected"; const existing = await client.from("action_audit_log").select("id").eq("user_id", userId).eq("entity_id", eventId).eq("action_type", actionType).contains("metadata", { fingerprint }).maybeSingle(); if (existing.error) throw existing.error; if (existing.data) return; const inserted = await client.from("action_audit_log").insert({ user_id: userId, actor: "provider", action_type: actionType, entity_type: "calendar_event", entity_id: eventId, provider: "google", summary: type === "external_deleted" ? "Google deleted an event with unsynchronized local changes." : "Calendar event changed locally and in Google.", status: "success", metadata: { fingerprint } }); if (inserted.error) throw inserted.error; }

export type GoogleToLocalCounts = { imported: number; updated: number; unchanged: number; local_pending_push: number; conflicts: number; deleted: number; errors: number };

export async function applyGoogleIncrementalEvents(client: Client, userId: string, item: Integration, events: GoogleEvent[]) {
  const counts: GoogleToLocalCounts = { imported: 0, updated: 0, unchanged: 0, local_pending_push: 0, conflicts: 0, deleted: 0, errors: 0 };
  const localResult = await client.from("calendar_events").select("*").eq("user_id", userId).eq("provider", "google").not("external_event_id", "is", null);
  const stateResult = await client.from("calendar_event_sync_state").select("*").eq("user_id", userId).eq("integration_id", item.id);
  if (localResult.error) throw localResult.error; if (stateResult.error) throw stateResult.error;
  const localByProvider = new Map((localResult.data ?? []).map((event) => [String(event.external_event_id), event]));
  const stateByEvent = new Map((stateResult.data ?? []).map((state) => [String(state.calendar_event_id), state as SyncState]));
  const timezone = String(item.provider_metadata?.timezone ?? "UTC");
  for (const remoteEvent of events) {
    try {
      const providerId = String(remoteEvent.id ?? ""); if (!providerId) { counts.errors++; continue; }
      const local = localByProvider.get(providerId); const state = local ? stateByEvent.get(String(local.id)) : undefined;
      if (remoteEvent.status === "cancelled") {
        if (!local) { counts.unchanged++; continue; }
        const base = state?.base_snapshot ?? null; const localCanonical = canonicalizeCalendarEvent(local); const localSnapshot = base ? { ...localCanonical, recurring_event_id: base.recurring_event_id, original_start_time: base.original_start_time } : localCanonical; const conflictType = base ? "external_deleted" : "manual_review";
        if (base && sameSnapshot(localSnapshot, base)) {
          const removed = await client.from("calendar_events").update({ status: "cancelled", deleted_at: new Date().toISOString(), external_updated_at: remoteEvent.updated ?? null, google_etag: remoteEvent.etag ?? null }).eq("id", local.id).eq("user_id", userId); if (removed.error) throw removed.error;
          const cleared = await client.from("calendar_event_sync_state").upsert({ user_id: userId, calendar_event_id: local.id, integration_id: item.id, provider: "google", provider_event_id: providerId, last_synced_etag: remoteEvent.etag ?? null, last_synced_provider_updated_at: remoteEvent.updated ?? null, base_snapshot: base, remote_snapshot: null, conflict_type: null, conflict_detected_at: null, provider_deleted: true }, { onConflict: "user_id,calendar_event_id" }); if (cleared.error) throw cleared.error; counts.deleted++; continue;
        }
        const duplicate = sameConflict(state, conflictType, null, remoteEvent.etag ?? null);
        const persisted = await client.from("calendar_event_sync_state").upsert({ user_id: userId, calendar_event_id: local.id, integration_id: item.id, provider: "google", provider_event_id: providerId, last_synced_etag: remoteEvent.etag ?? null, last_synced_provider_updated_at: remoteEvent.updated ?? null, base_snapshot: base, remote_snapshot: null, conflict_type: conflictType, conflict_detected_at: duplicate ? state?.conflict_detected_at : new Date().toISOString(), provider_deleted: true }, { onConflict: "user_id,calendar_event_id" }); if (persisted.error) throw persisted.error; await auditConflict(client, userId, String(local.id), "external_deleted", hash({ base, local: localSnapshot, remote: null, etag: remoteEvent.etag ?? null, conflictType })); counts.conflicts++; continue;
      }
      const remoteRow = googleEventToLocalRow(remoteEvent, userId, timezone); const remoteSnapshot = canonicalizeCalendarEvent({ ...remoteRow, recurring_event_id: remoteEvent.recurringEventId ?? null, original_start_time: remoteEvent.originalStartTime?.dateTime ?? remoteEvent.originalStartTime?.date ?? null });
      if (!local) {
        const inserted = await client.from("calendar_events").insert(remoteRow).select("*").single(); if (inserted.error) throw inserted.error;
        const baseline = await client.from("calendar_event_sync_state").insert({ user_id: userId, calendar_event_id: inserted.data.id, integration_id: item.id, provider: "google", provider_event_id: providerId, last_synced_etag: remoteEvent.etag ?? null, last_synced_provider_updated_at: remoteEvent.updated ?? null, last_synced_local_updated_at: inserted.data.updated_at, base_snapshot: remoteSnapshot, remote_snapshot: null, conflict_type: null, provider_deleted: false }); if (baseline.error) throw baseline.error; localByProvider.set(providerId, inserted.data); counts.imported++; continue;
      }
      const localCanonical = canonicalizeCalendarEvent(local); const localSnapshot = state?.base_snapshot ? { ...localCanonical, recurring_event_id: state.base_snapshot.recurring_event_id, original_start_time: state.base_snapshot.original_start_time } : localCanonical;
      if (!state?.base_snapshot) {
        const equivalent = sameSnapshot(localSnapshot, remoteSnapshot); const conflictType = equivalent ? null : "manual_review";
        const duplicate = !equivalent && sameConflict(state, "manual_review", remoteSnapshot, remoteEvent.etag ?? null);
        const bootstrap = await client.from("calendar_event_sync_state").upsert({ user_id: userId, calendar_event_id: local.id, integration_id: item.id, provider: "google", provider_event_id: providerId, last_synced_etag: remoteEvent.etag ?? null, last_synced_provider_updated_at: remoteEvent.updated ?? null, last_synced_local_updated_at: equivalent ? local.updated_at : null, base_snapshot: equivalent ? remoteSnapshot : null, remote_snapshot: equivalent ? null : remoteSnapshot, conflict_type: conflictType, conflict_detected_at: equivalent ? null : duplicate ? state?.conflict_detected_at : new Date().toISOString(), provider_deleted: false }, { onConflict: "user_id,calendar_event_id" }); if (bootstrap.error) throw bootstrap.error;
        if (equivalent) counts.unchanged++; else { await auditConflict(client, userId, String(local.id), "manual_review", hash({ base: null, local: localSnapshot, remote: remoteSnapshot, etag: remoteEvent.etag ?? null })); counts.conflicts++; } continue;
      }
      const decision = calendarSyncDecision(state.base_snapshot, localSnapshot, remoteSnapshot);
      if (state.base_snapshot.recurring_event_id !== remoteSnapshot.recurring_event_id || state.base_snapshot.original_start_time !== remoteSnapshot.original_start_time) {
        const duplicate = sameConflict(state, "manual_review", remoteSnapshot, remoteEvent.etag ?? null);
        const conflict = await client.from("calendar_event_sync_state").update({ remote_snapshot: remoteSnapshot, conflict_type: "manual_review", conflict_detected_at: duplicate ? state.conflict_detected_at : new Date().toISOString(), provider_deleted: false, last_synced_etag: remoteEvent.etag ?? null, last_synced_provider_updated_at: remoteEvent.updated ?? null }).eq("calendar_event_id", local.id).eq("user_id", userId).eq("integration_id", item.id); if (conflict.error) throw conflict.error; await auditConflict(client, userId, String(local.id), "manual_review", hash({ base: state.base_snapshot, local: localSnapshot, remote: remoteSnapshot, etag: remoteEvent.etag ?? null })); counts.conflicts++; continue;
      }
      if (decision.action === "apply_remote") {
        const updated = await client.from("calendar_events").update(remoteRow).eq("id", local.id).eq("user_id", userId).select("*").single(); if (updated.error) throw updated.error;
        const advanced = await client.from("calendar_event_sync_state").update({ base_snapshot: remoteSnapshot, remote_snapshot: null, conflict_type: null, conflict_detected_at: null, provider_deleted: false, last_synced_etag: remoteEvent.etag ?? null, last_synced_provider_updated_at: remoteEvent.updated ?? null, last_synced_local_updated_at: updated.data.updated_at }).eq("calendar_event_id", local.id).eq("user_id", userId).eq("integration_id", item.id); if (advanced.error) throw advanced.error; localByProvider.set(providerId, updated.data); counts.updated++; continue;
      }
      if (decision.action === "push_local") { counts.local_pending_push++; continue; }
      if (decision.action === "conflict") {
        const duplicate = sameConflict(state, "sync_conflict", remoteSnapshot, remoteEvent.etag ?? null);
        const conflict = await client.from("calendar_event_sync_state").update({ remote_snapshot: remoteSnapshot, conflict_type: "sync_conflict", conflict_detected_at: duplicate ? state.conflict_detected_at : new Date().toISOString(), provider_deleted: false, last_synced_etag: remoteEvent.etag ?? null, last_synced_provider_updated_at: remoteEvent.updated ?? null }).eq("calendar_event_id", local.id).eq("user_id", userId).eq("integration_id", item.id); if (conflict.error) throw conflict.error; await auditConflict(client, userId, String(local.id), "sync_conflict", hash({ base: state.base_snapshot, local: localSnapshot, remote: remoteSnapshot, etag: remoteEvent.etag ?? null })); counts.conflicts++; continue;
      }
      const advanced = await client.from("calendar_event_sync_state").update({ base_snapshot: decision.action === "advance_identical" ? remoteSnapshot : state.base_snapshot, remote_snapshot: null, conflict_type: null, conflict_detected_at: null, provider_deleted: false, last_synced_etag: remoteEvent.etag ?? null, last_synced_provider_updated_at: remoteEvent.updated ?? null, last_synced_local_updated_at: local.updated_at }).eq("calendar_event_id", local.id).eq("user_id", userId).eq("integration_id", item.id); if (advanced.error) throw advanced.error; counts.unchanged++;
    } catch { counts.errors++; }
  }
  return counts;
}

export async function syncGoogleCalendar(client: Client, userId: string) {
  const item = await integration(client, userId); const token = await accessToken(client, userId, item); const calendarId = String(item.provider_metadata?.calendar_id ?? "primary");
  const state = await client.from("calendar_sync_state").select("*").eq("user_id", userId).eq("integration_id", item.id).eq("calendar_id", calendarId).maybeSingle(); if (state.error) throw state.error;
  const params = new URLSearchParams({ singleEvents: "false", showDeleted: "true", maxResults: "2500" }); if (state.data?.sync_token) params.set("syncToken", state.data.sync_token); else params.set("timeMin", new Date(Date.now() - 90 * 86400000).toISOString());
  let remote: { items?: GoogleEvent[]; nextSyncToken?: string }; try { remote = await google(token, `/calendars/${encodeURIComponent(calendarId)}/events?${params}`) as typeof remote; } catch (error) { if (state.data?.sync_token) { await client.from("calendar_sync_state").update({ sync_token: null }).eq("id", state.data.id); return syncGoogleCalendar(client, userId); } throw error; }
  const counts = await applyGoogleIncrementalEvents(client, userId, item, remote.items ?? []);
  const local = await client.from("calendar_events").select("*").eq("user_id", userId).is("deleted_at", null).or("provider.eq.local,external_event_id.is.null"); if (local.error) throw local.error; for (const event of local.data ?? []) await pushGoogleEvent(client, userId, event);
  const now = new Date().toISOString(); await client.from("calendar_sync_state").upsert({ user_id: userId, integration_id: item.id, calendar_id: calendarId, sync_token: counts.errors ? state.data?.sync_token ?? null : remote.nextSyncToken ?? state.data?.sync_token, last_synced_at: now }, { onConflict: "user_id,integration_id,calendar_id" }); await client.from("integrations").update({ last_synced_at: now }).eq("id", item.id).eq("user_id", userId);
  return { ...counts, pushed: local.data?.length ?? 0, removed: counts.deleted, lastSyncedAt: now };
}

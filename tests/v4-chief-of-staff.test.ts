import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { decryptToken, encryptToken } from "../src/lib/integrations/crypto";
import { actionNeedsApproval, calendarSyncDecision, canonicalizeCalendarEvent, compareCalendarSnapshots, detectCalendarConflicts, inferConservativeReplyState, inferReplyState, normalizeEmail, normalizeParticipants, safeAutomationTypes, shouldReactivateHandled, stravaActivityType } from "../src/lib/v4";
import { googleEventToLocalRow } from "../src/lib/integrations/google-calendar";
import { calendarConflictDisplayType, conflictFieldDifferences, detectScheduleOverlaps, nearTermCalendarConflict, planBlockConflicts, recurrenceIdentityIsAmbiguous, recurrenceScope, scheduleOverlapVersionKey, type ScheduleItem } from "../src/lib/calendar-conflicts";

test("reply state is conservative and derived from the latest meaningful sender", () => {
  assert.equal(inferReplyState([]), "unknown");
  assert.equal(inferReplyState([{ fromUser: true }]), "waiting_for_other");
  assert.equal(inferReplyState([{ fromUser: true }, { fromUser: false }]), "awaiting_user_reply");
  assert.equal(inferReplyState([{ fromUser: false, meaningful: false }, { fromUser: true }]), "waiting_for_other");
});

test("Strava activities map deterministically without treating unknown values as known", () => {
  assert.equal(stravaActivityType("Run"), "Running");
  assert.equal(stravaActivityType("Ride"), "Cycling");
  assert.equal(stravaActivityType("Yoga"), "Other");
});

test("external or financial action classes always require approval", () => {
  for (const action of ["send_email", "record_payment", "reschedule_calendar_event", "create_automation", "disable_automation"]) assert.equal(actionNeedsApproval(action), true);
  assert.equal(actionNeedsApproval("draft_email_reply"), false);
  assert.ok(safeAutomationTypes.includes("calendar_sync"));
});

test("integration encryption does not expose provider tokens", () => {
  const original = process.env.INTEGRATION_ENCRYPTION_KEY; process.env.INTEGRATION_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
  try { const encrypted = encryptToken("provider-refresh-token"); assert.equal(encrypted.includes("provider-refresh-token"), false); assert.equal(decryptToken(encrypted), "provider-refresh-token"); }
  finally { if (original === undefined) delete process.env.INTEGRATION_ENCRYPTION_KEY; else process.env.INTEGRATION_ENCRYPTION_KEY = original; }
});

test("email participant normalization ignores display names, case, and duplicates", () => {
  assert.equal(normalizeEmail('"John Doe" <John@Example.com>'), "john@example.com");
  assert.deepEqual(normalizeParticipants(["John <JOHN@example.com>", "john@example.com", "bad value"]), ["john@example.com"]);
});

test("reply state stays unclear when ownership or recipient ambiguity exists", () => {
  assert.equal(inferConservativeReplyState({ latestFrom: "client@example.com", userAddresses: ["me@example.com"], participants: ["client@example.com", "me@example.com"] }), "awaiting_user_reply");
  assert.equal(inferConservativeReplyState({ latestFrom: "me@example.com", userAddresses: ["me@example.com"], participants: ["client@example.com", "me@example.com"] }), "waiting_for_other");
  assert.equal(inferConservativeReplyState({ latestFrom: "client@example.com", userAddresses: ["me@example.com", "alias@example.com"], participants: ["client@example.com"] }), "unknown");
});

test("handled threads reactivate only for a newer actionable external message", () => {
  assert.equal(shouldReactivateHandled({ handledMessageId: "old", latestMessageId: "new", latestFrom: "client@example.com", userAddresses: ["me@example.com"] }), true);
  assert.equal(shouldReactivateHandled({ handledMessageId: "old", latestMessageId: "new", latestFrom: "me@example.com", userAddresses: ["me@example.com"] }), false);
  assert.equal(shouldReactivateHandled({ handledMessageId: "old", latestMessageId: "new", latestFrom: "client@example.com", userAddresses: ["me@example.com"], automated: true }), false);
  assert.equal(shouldReactivateHandled({ handledMessageId: "same", latestMessageId: "same", latestFrom: "client@example.com", userAddresses: ["me@example.com"] }), false);
});

test("normalization persists only address identities suitable for linking", () => {
  assert.deepEqual(normalizeParticipants(["Client <CLIENT@example.com>", "me@example.com", "Client <client@example.com>"]), ["client@example.com", "me@example.com"]);
  assert.equal(normalizeEmail("not an email"), null);
});

test("calendar overlap detection includes timed and all-day conflicts but not touching boundaries", () => {
  const conflicts = detectCalendarConflicts([
    { id: "a", starts_at: "2026-09-05T14:00:00+01:00", ends_at: "2026-09-05T15:00:00+01:00" },
    { id: "b", starts_at: "2026-09-05T14:30:00+01:00", ends_at: "2026-09-05T16:00:00+01:00" },
    { id: "c", starts_at: "2026-09-05T16:00:00+01:00", ends_at: "2026-09-05T17:00:00+01:00" },
    { id: "d", starts_at: "2026-09-06T00:00:00Z", ends_at: "2026-09-07T00:00:00Z" },
    { id: "e", starts_at: "2026-09-06T12:00:00Z", ends_at: "2026-09-06T13:00:00Z" },
  ]);
  assert.deepEqual(conflicts.map((item) => [item.firstId, item.secondId]), [["a", "b"], ["d", "e"]]);
});

test("calendar three-way comparison preserves semantic all-day and timezone-safe baselines", () => {
  const base = canonicalizeCalendarEvent({ title: "Review", description: null, starts_at: "2026-09-10", ends_at: "2026-09-11", all_day: true, timezone: "Africa/Casablanca" });
  const local = canonicalizeCalendarEvent({ title: "Review", description: "", starts_at: "2026-09-10T00:00:00Z", ends_at: "2026-09-11T00:00:00Z", all_day: true, timezone: "Africa/Casablanca" });
  const remote = canonicalizeCalendarEvent({ title: "Review", description: "", starts_at: "2026-09-10", ends_at: "2026-09-11", all_day: true, timezone: "Africa/Casablanca" });
  assert.equal(compareCalendarSnapshots(base, local, remote).conflict, false);
});

test("calendar three-way comparison distinguishes one-sided, identical, and divergent edits", () => {
  const base = canonicalizeCalendarEvent({ title: "Review", starts_at: "2026-09-10T09:00:00Z", ends_at: "2026-09-10T10:00:00Z", timezone: "UTC" });
  const local = { ...base, title: "Local review" }; const remote = { ...base, title: "Google review" };
  assert.equal(compareCalendarSnapshots(base, local, base).conflict, false);
  assert.equal(compareCalendarSnapshots(base, local, local).sameResult, true);
  const divergent = compareCalendarSnapshots(base, local, remote);
  assert.equal(divergent.conflict, true); assert.deepEqual(divergent.conflictingFields, ["title"]);
});

test("Google-to-local decisions preserve local-only edits and apply remote-only edits", () => {
  const base = canonicalizeCalendarEvent({ title: "Base", starts_at: "2026-09-10T09:00:00Z", ends_at: "2026-09-10T10:00:00Z", timezone: "UTC" });
  assert.equal(calendarSyncDecision(base, { ...base, title: "Local" }, base).action, "push_local");
  assert.equal(calendarSyncDecision(base, base, { ...base, title: "Remote" }).action, "apply_remote");
});

test("identical dual edits advance while divergent edits become conflicts", () => {
  const base = canonicalizeCalendarEvent({ title: "Base", starts_at: "2026-09-10T09:00:00Z", ends_at: "2026-09-10T10:00:00Z", timezone: "UTC" });
  const shared = { ...base, title: "Shared" };
  assert.equal(calendarSyncDecision(base, shared, shared).action, "advance_identical");
  assert.equal(calendarSyncDecision(base, { ...base, title: "Local" }, { ...base, title: "Remote" }).action, "conflict");
});

test("Google event conversion preserves all-day date boundaries without raw payload storage", () => {
  const row = googleEventToLocalRow({ id: "google-1", summary: "Holiday", start: { date: "2026-09-10" }, end: { date: "2026-09-11" } }, "user-1", "Africa/Casablanca");
  assert.equal(row.all_day, true); assert.equal(row.starts_at, "2026-09-10T00:00:00.000Z"); assert.equal(row.timezone, "Africa/Casablanca");
  assert.equal("access_token" in row, false);
});

test("production Google incremental sync is wired to per-event baselines and batch counts", async () => {
  const source = await readFile(new URL("../src/lib/integrations/google-calendar.ts", import.meta.url), "utf8");
  for (const expected of ["calendar_event_sync_state", "calendarSyncDecision", "local_pending_push", "remote_snapshot", "sync_conflict", "provider_deleted"]) assert.match(source, new RegExp(expected));
  assert.match(source, /catch \{ counts\.errors\+\+; \}/);
});

test("legacy divergent events bootstrap as manual review rather than overwriting local", async () => {
  const source = await readFile(new URL("../src/lib/integrations/google-calendar.ts", import.meta.url), "utf8");
  assert.match(source, /equivalent \? null : "manual_review"/);
  assert.match(source, /base_snapshot: equivalent \? remoteSnapshot : null/);
});

test("remote deletion compares local to baseline before applying cancellation", async () => {
  const source = await readFile(new URL("../src/lib/integrations/google-calendar.ts", import.meta.url), "utf8");
  assert.match(source, /base && sameSnapshot\(localSnapshot, base\)/);
  assert.match(source, /conflictType = base \? "external_deleted" : "manual_review"/);
});

test("persisted Calendar conflicts are exposed through the owner-scoped conflict API", async () => {
  const source = await readFile(new URL("../src/app/api/calendar/conflicts/route.ts", import.meta.url), "utf8");
  assert.match(source, /calendar_event_sync_state/); assert.match(source, /\.eq\("user_id",\s*userId\)/); assert.match(source, /syncConflicts/);
});

test("production local Calendar create establishes provider identity and BASE", async () => {
  const source = await readFile(new URL("../src/lib/integrations/google-calendar.ts", import.meta.url), "utf8");
  assert.match(source, /if \(!external\)/);
  assert.match(source, /updatePushBaseline\(client, userId, item, String\(event\.id\), created/);
  assert.match(source, /calendar_local_created_remote/);
});

test("production local Calendar updates preflight BASE, LOCAL, and current Google state", async () => {
  const source = await readFile(new URL("../src/lib/integrations/google-calendar.ts", import.meta.url), "utf8");
  assert.match(source, /ownedPushState/);
  assert.match(source, /calendarSyncDecision\(state\.base_snapshot, localSnapshot, remoteValue\.snapshot\)/);
  assert.match(source, /sync_result: \{ status: "remote_applied" \}/);
});

test("Calendar push blocks divergent writes and records a shared sync conflict", async () => {
  const source = await readFile(new URL("../src/lib/integrations/google-calendar.ts", import.meta.url), "utf8");
  assert.match(source, /decision\.action === "conflict"/);
  assert.match(source, /persistPushConflict\(client, userId, item, event, state, remote, remoteValue\.snapshot, "sync_conflict"\)/);
  assert.match(source, /calendar_push_conflict_detected/);
});

test("Calendar push uses conditional ETags and permits only one stale-version retry", async () => {
  const source = await readFile(new URL("../src/lib/integrations/google-calendar.ts", import.meta.url), "utf8");
  assert.match(source, /"If-Match": String\(remote\.etag/);
  assert.match(source, /retry && error instanceof GoogleCalendarError && error\.status === 412/);
  assert.match(source, /pushGoogleEvent\(client, userId, event, false\)/);
});

test("local Calendar delete retains intent when Google changed", async () => {
  const source = await readFile(new URL("../src/lib/integrations/google-calendar.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../supabase/migrations/20260905210000_calendar_local_delete_intent.sql", import.meta.url), "utf8");
  assert.match(source, /persistPushConflict\(client, userId, item, event, state, remote, remoteValue\.snapshot, "sync_conflict", true\)/);
  assert.match(migration, /local_delete_intent boolean not null default false/);
});

test("generic Calendar deletion archives only after safe provider deletion", async () => {
  const source = await readFile(new URL("../src/app/api/entities/[domain]/[id]/route.ts", import.meta.url), "utf8");
  assert.match(source, /if\(deletion\.status!=="deleted"\).*status:409/);
  assert.match(source, /await archiveRecord/);
});

test("Calendar push results are structured and ownership filters every mutable record", async () => {
  const source = await readFile(new URL("../src/lib/integrations/google-calendar.ts", import.meta.url), "utf8");
  for (const status of ["created", "pushed", "remote_applied", "already_synced", "conflict", "external_deleted", "deleted", "manual_review"]) assert.match(source, new RegExp(`\\"${status}\\"`));
  assert.match(source, /\.eq\("id", String\(event\.id\)\)\.eq\("user_id", userId\)/);
  assert.match(source, /\.eq\("calendar_event_id", String\(event\.id\)\)\.eq\("user_id", userId\)\.eq\("integration_id", item\.id\)/);
});

test("persisted Calendar conflict types become user-facing resolution states", () => {
  assert.equal(calendarConflictDisplayType("sync_conflict"), "concurrent_edit");
  assert.equal(calendarConflictDisplayType("external_deleted"), "external_deleted");
  assert.equal(calendarConflictDisplayType("sync_conflict", true), "remote_changed_before_local_delete");
  assert.equal(calendarConflictDisplayType("manual_review"), "manual_review");
});

test("Calendar comparison highlights only fields that differ", () => {
  const local = canonicalizeCalendarEvent({ title: "Local title", description: "Same", starts_at: "2026-09-10T14:00:00+01:00", ends_at: "2026-09-10T15:00:00+01:00", timezone: "Africa/Casablanca" });
  const remote = canonicalizeCalendarEvent({ title: "Google title", description: "Same", starts_at: "2026-09-10T14:00:00+01:00", ends_at: "2026-09-10T15:00:00+01:00", timezone: "Africa/Casablanca" });
  assert.deepEqual(conflictFieldDifferences(local, remote), ["title"]);
});

test("recurrence scope distinguishes a series, occurrence, and ambiguous mapping", () => {
  const series = canonicalizeCalendarEvent({ title: "Weekly review", starts_at: "2026-09-10T14:00:00Z", ends_at: "2026-09-10T15:00:00Z", recurrence_rule: "RRULE:FREQ=WEEKLY" });
  const occurrence = { ...series, recurring_event_id: "series-1", original_start_time: "2026-09-10T14:00:00Z" };
  assert.equal(recurrenceScope(series), "Entire series");
  assert.equal(recurrenceScope(occurrence), "This occurrence");
  assert.equal(recurrenceIdentityIsAmbiguous(occurrence, { ...occurrence, original_start_time: "2026-09-17T14:00:00Z" }), true);
});

test("schedule overlap detection includes Calendar vs Focus without boundary false positives", () => {
  const items: ScheduleItem[] = [
    { id: "calendar", title: "Campaign review", starts_at: "2026-09-10T13:00:00Z", ends_at: "2026-09-10T14:00:00Z", source: "google" },
    { id: "focus", title: "Focus", starts_at: "2026-09-10T13:30:00Z", ends_at: "2026-09-10T14:30:00Z", source: "focus" },
    { id: "boundary", title: "Later event", starts_at: "2026-09-10T14:30:00Z", ends_at: "2026-09-10T15:00:00Z", source: "local" },
  ];
  const conflicts = detectScheduleOverlaps(items);
  assert.equal(conflicts.some((item) => item.firstId === "calendar" && item.secondId === "focus"), true);
  assert.equal(conflicts.some((item) => item.firstId === "focus" && item.secondId === "boundary"), false);
});

test("accepted Daily Plan blocks participate in Calendar overlap detection", () => {
  const conflicts = detectScheduleOverlaps([
    { id: "event", title: "Meeting", starts_at: "2026-09-10T09:00:00Z", ends_at: "2026-09-10T10:00:00Z", source: "google" },
    { id: "plan", title: "Plan block", starts_at: "2026-09-10T09:30:00Z", ends_at: "2026-09-10T10:30:00Z", source: "daily_plan" },
  ]);
  assert.equal(conflicts[0]?.overlapMinutes, 30);
});

test("overlap acknowledgement keys invalidate when either schedule version changes", () => {
  const first: ScheduleItem = { id: "a", title: "A", starts_at: "2026-09-10T09:00:00Z", ends_at: "2026-09-10T10:00:00Z", source: "google" };
  const second: ScheduleItem = { id: "b", title: "B", starts_at: "2026-09-10T09:30:00Z", ends_at: "2026-09-10T10:30:00Z", source: "focus" };
  assert.notEqual(scheduleOverlapVersionKey(first, second), scheduleOverlapVersionKey(first, { ...second, starts_at: "2026-09-10T09:45:00Z" }));
});

test("planner detects proposed blocks against owned Calendar inputs", () => {
  const conflicts = planBlockConflicts([{ startsAt: "2026-09-10T09:30:00Z", endsAt: "2026-09-10T10:15:00Z", title: "Write brief", kind: "focus" }], [{ id: "event", title: "Client call", starts_at: "2026-09-10T09:00:00Z", ends_at: "2026-09-10T10:00:00Z", source: "google" }]);
  assert.equal(conflicts.length, 1);
  assert.match(conflicts[0].firstId + conflicts[0].secondId, /proposed:/);
});

test("Today selects only near-term Calendar conflicts", () => {
  const now = new Date("2026-09-10T09:00:00Z");
  const conflicts = [{ id: "later", local_event: { starts_at: "2026-09-13T09:00:00Z" } }, { id: "soon", local_event: { starts_at: "2026-09-10T10:00:00Z" } }];
  assert.equal(nearTermCalendarConflict(conflicts, now)?.id, "soon");
  assert.equal(nearTermCalendarConflict([conflicts[0]], now), null);
});

test("Calendar resolution API exposes every safe action and owner-scopes conflicts", async () => {
  const route = await readFile(new URL("../src/app/api/calendar/conflicts/route.ts", import.meta.url), "utf8");
  for (const action of ["keep_local", "keep_google", "restore_google", "delete_local", "delete_anyway", "keep_google_after_delete"]) assert.match(route, new RegExp(`\\"${action}\\"`));
  assert.match(route, /calendar_event_sync_state/);
  assert.match(route, /\.eq\("user_id", userId\)/);
  assert.match(route, /already been resolved/);
});

test("Calendar resolution rechecks provider versions and blocks ambiguous recurrence", async () => {
  const source = await readFile(new URL("../src/lib/integrations/google-calendar.ts", import.meta.url), "utf8");
  assert.match(source, /remote\?\.etag !== state\.last_synced_etag/);
  assert.match(source, /error\.status !== 412/);
  assert.match(source, /recurrenceIdentityIsAmbiguous/);
  assert.match(source, /status: "stale_conflict"/);
});

test("Calendar conflict UI includes comparison, deletion, manual review, and immediate refresh actions", async () => {
  const source = await readFile(new URL("../src/features/calendar/calendar-conflicts.tsx", import.meta.url), "utf8");
  for (const label of ["Local version", "Google version", "Keep local", "Keep Google", "Restore to Google", "Delete anyway", "Manual review required", "Review latest"]) assert.match(source, new RegExp(label));
  assert.match(source, /announceWorkspaceMutation\("calendar"\)/);
  assert.match(source, /setSelected\(null\)/);
});

test("Calendar conflict UI preserves all-day semantics, timezone display, and mobile stacking", async () => {
  const [component, styles] = await Promise.all([readFile(new URL("../src/features/calendar/calendar-conflicts.tsx", import.meta.url), "utf8"), readFile(new URL("../src/app/globals.css", import.meta.url), "utf8")]);
  assert.match(component, /allDayDate/);
  assert.match(component, /Timezone/);
  assert.match(component, /recurrence_scope/);
  assert.match(styles, /@media\(max-width:767px\)[\s\S]*\.conflict-comparison\{grid-template-columns:1fr\}/);
});

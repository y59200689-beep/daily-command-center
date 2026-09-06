import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createdRecordRoute, meetingCaptureItemSchema, meetingItemCounts, prepareMeetingRecord, suggestMeetingItems, validateSelectedMeetingItems, type MeetingCaptureItem } from "../src/lib/meeting-capture";

const base = (type: MeetingCaptureItem["type"], patch: Partial<MeetingCaptureItem> = {}): MeetingCaptureItem => ({ id: `${type}-1`, type, included: true, source: "manual", title: `${type} title`, ...patch });

test("raw meeting notes create an explicit task suggestion", () => {
  const [item] = suggestMeetingItems("Task: Finalize campaign caption");
  assert.equal(item.type, "task"); assert.equal(item.title, "Finalize campaign caption");
});

test("explicit decision language creates a decision suggestion", () => {
  const [item] = suggestMeetingItems("Decision: Visual 2 approved");
  assert.equal(item.type, "decision"); assert.equal(item.outcome, "Visual 2 approved");
});

test("explicit follow-up language creates a follow-up suggestion without inventing a date", () => {
  const [item] = suggestMeetingItems("Follow-up: Send invoice next week");
  assert.equal(item.type, "followup"); assert.equal(item.due_at, undefined);
});

test("explicit waiting language creates a waiting suggestion", () => {
  const [item] = suggestMeetingItems("Waiting on: Client approval");
  assert.equal(item.type, "waiting"); assert.equal(item.title, "Client approval");
});

test("explicit note language creates a note suggestion", () => {
  const [item] = suggestMeetingItems("Note: Client prefers the second visual");
  assert.equal(item.type, "note"); assert.equal(item.category, "meeting");
});

test("unlabelled language is not converted into invented commitments", () => {
  assert.deepEqual(suggestMeetingItems("Maybe launch sometime next week."), []);
});

test("excluded meeting items are not prepared for creation", () => {
  const records = validateSelectedMeetingItems([base("task"), base("note", { included: false, content: "Not selected" })], "2026-09-05");
  assert.deepEqual(records.map((record) => record.type), ["task"]);
});

test("edited title is preserved in the domain payload", () => {
  const [record] = validateSelectedMeetingItems([base("task", { title: "Edited campaign task" })], "2026-09-05");
  assert.equal(record.input.title, "Edited campaign task");
});

test("edited due date is preserved while optional blank dates remain null", () => {
  assert.equal((prepareMeetingRecord(base("task", { due_date: "2026-09-12" })) as Record<string, unknown>).due_date, "2026-09-12");
  assert.equal((prepareMeetingRecord(base("task")) as Record<string, unknown>).due_date, null);
});

test("all supported selected item types map to existing domain schemas", () => {
  const items = [base("task"), base("decision", { outcome: "Approved" }), base("followup"), base("waiting"), base("note", { content: "Context" })];
  assert.deepEqual(validateSelectedMeetingItems(items, "2026-09-05").map((record) => record.domain), ["tasks", "decisions", "followups", "waiting", "notes"]);
});

test("invalid selected decision blocks the complete batch", () => {
  assert.throws(() => validateSelectedMeetingItems([base("task"), base("decision", { outcome: "" })], "2026-09-05"));
});

test("meeting item schema rejects malformed relationship identifiers", () => {
  assert.equal(meetingCaptureItemSchema.safeParse(base("task", { project_id: "another-user-project" })).success, false);
});

test("meeting item counts include only confirmed records", () => {
  assert.deepEqual(meetingItemCounts([base("task"), base("task", { id: "task-2", included: false }), base("note")]), { task: 1, decision: 0, followup: 0, waiting: 0, note: 1 });
});

test("created meeting records return direct routes", () => {
  assert.equal(createdRecordRoute("followup", "record-id"), "/followups/record-id");
  assert.equal(createdRecordRoute("waiting", "record-id"), "/waiting/record-id");
});

test("capture API owner-scopes meeting and relationship validation", async () => {
  const source = await readFile(new URL("../src/app/api/meetings/[id]/capture/route.ts", import.meta.url), "utf8");
  assert.match(source, /\.eq\("id", eventId\)\.eq\("user_id", userId\)/);
  assert.match(source, /assertOwnedRelations\(supabase, userId/);
  assert.match(source, /\.eq\("user_id", userId\)\.is\("deleted_at", null\)\.in\("id", projectIds\)/);
});

test("meeting context prefills owned project and client relationships", async () => {
  const [route, component] = await Promise.all([readFile(new URL("../src/app/api/meetings/[id]/capture/route.ts", import.meta.url), "utf8"), readFile(new URL("../src/features/v4/meeting-capture.tsx", import.meta.url), "utf8")]);
  assert.match(route, /task\.data\?\.project_id/); assert.match(route, /task\.data\?\.client_id/);
  assert.match(component, /project_id: data\?\.context\.projectId/); assert.match(component, /client_id: data\?\.context\.clientId/);
});

test("summary-only execution is supported without forcing an action record", async () => {
  const [route, migration] = await Promise.all([readFile(new URL("../src/app/api/meetings/[id]/capture/route.ts", import.meta.url), "utf8"), readFile(new URL("../supabase/migrations/20260905224457_post_meeting_capture_execution.sql", import.meta.url), "utf8")]);
  assert.match(route, /!selected\.length && !input\.summary\.trim\(\)/);
  assert.match(migration, /jsonb_array_length\(v_created\)=0 and v_summary is null/);
});

test("meeting execution uses an atomic RPC and durable idempotency key", async () => {
  const [route, migration] = await Promise.all([readFile(new URL("../src/app/api/meetings/[id]/capture/route.ts", import.meta.url), "utf8"), readFile(new URL("../supabase/migrations/20260905224457_post_meeting_capture_execution.sql", import.meta.url), "utf8")]);
  assert.match(route, /rpc\("execute_meeting_capture"/);
  assert.match(migration, /approval_items_owner_action_idempotency_idx/);
  assert.match(migration, /if v_approval\.status = 'executed' then return/);
});

test("atomic execution creates every supported record inside one database function", async () => {
  const migration = await readFile(new URL("../supabase/migrations/20260905224457_post_meeting_capture_execution.sql", import.meta.url), "utf8");
  for (const table of ["tasks", "decisions", "followups", "waiting_items", "notes"]) assert.match(migration, new RegExp(`insert into ${table}`));
  assert.match(migration, /status='executed'/);
});

test("meeting execution records owner-scoped audit and timeline entries", async () => {
  const migration = await readFile(new URL("../supabase/migrations/20260905224457_post_meeting_capture_execution.sql", import.meta.url), "utf8");
  assert.match(migration, /meeting_outcome_executed/); assert.match(migration, /meeting_outcome_captured/);
  assert.match(migration, /v_user_id uuid := auth\.uid\(\)/);
});

test("manual fallback and all five add-item controls remain available without suggestions", async () => {
  const component = await readFile(new URL("../src/features/v4/meeting-capture.tsx", import.meta.url), "utf8");
  assert.match(component, /AI is optional/);
  assert.match(component, /meetingItemTypes\.map/);
  assert.match(component, /\+ Add/);
});

test("capture uses per-item include editing, final confirmation, and immediate workspace refresh", async () => {
  const component = await readFile(new URL("../src/features/v4/meeting-capture.tsx", import.meta.url), "utf8");
  for (const expected of ["Include", "Remove item", "Review selected items", "Create selected items", "Meeting outcome saved"]) assert.match(component, new RegExp(expected));
  assert.match(component, /announceWorkspaceMutation\(domain\)/); assert.match(component, /router\.refresh\(\)/);
});

test("mobile meeting cards stack and keep touch actions reachable", async () => {
  const styles = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.match(styles, /@media\(max-width:767px\)[\s\S]*\.meeting-item-fields\{grid-template-columns:1fr\}/);
  assert.match(styles, /\.meeting-add-actions \.button[\s\S]*min-height:44px/);
});

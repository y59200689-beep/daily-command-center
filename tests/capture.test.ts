import test from "node:test";
import assert from "node:assert/strict";
import { parseCapture } from "../src/lib/capture";

const now = new Date("2026-09-03T12:00:00Z");
test("quick capture recognizes supported explicit commands", () => {
  assert.deepEqual(parseCapture("idea create AI recommendation engine", now), { kind: "idea", text: "create AI recommendation engine", confidence: .98, due: undefined });
  assert.equal(parseCapture("note client wants different campaign", now).kind, "note");
  assert.equal(parseCapture("follow up with radiology center Friday", now).kind, "followup");
});
test("quick capture extracts relative dates", () => {
  const task = parseCapture("task send invoice tomorrow", now);
  assert.equal(task.kind, "task");
  assert.equal(task.text, "send invoice");
  assert.equal(task.due?.slice(0, 10), "2026-09-04");
});
test("uncertain captures remain in Inbox", () => {
  assert.deepEqual(parseCapture("remember what Karim mentioned", now), { kind: "inbox", text: "remember what Karim mentioned", confidence: .35 });
});

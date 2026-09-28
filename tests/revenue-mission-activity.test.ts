import assert from "node:assert/strict";
import test from "node:test";
import { reconcileMissionActivity, sumMissionActivity } from "../src/lib/revenue-mission-activity";

test("mission activity sums only the requested action and inclusive dates", () => {
  const logs = [
    { log_date: "2026-09-27", action_id: "audits", quantity: 2 },
    { log_date: "2026-09-28", action_id: "audits", quantity: 3 },
    { log_date: "2026-09-28", action_id: "outreach", quantity: 9 },
    { log_date: "2026-09-29", action_id: "audits", quantity: 4 },
  ];
  assert.equal(sumMissionActivity(logs, "audits", "2026-09-27", "2026-09-28"), 5);
  assert.equal(sumMissionActivity(logs, "audits", "2026-09-28", "2026-09-28"), 3);
  assert.equal(sumMissionActivity(logs, "meetings", "2026-09-27", "2026-09-29"), 0);
});

test("manual tallies and linked records are not added twice", () => {
  assert.equal(reconcileMissionActivity(3, 3), 3);
  assert.equal(reconcileMissionActivity(5, 3), 5);
  assert.equal(reconcileMissionActivity(2, 4), 4);
});

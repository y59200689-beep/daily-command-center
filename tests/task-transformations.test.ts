import test from "node:test";
import assert from "node:assert/strict";
import { moveToTomorrow, orderDailyPriorities, toggleTaskComplete } from "../src/lib/task-transformations";

const task = { id: "t1", title: "Ship", status: "planned" as const, priority: "high" as const };
test("completion is reversible", () => { const done = toggleTaskComplete(task, new Date("2026-09-03T12:00:00Z")); assert.equal(done.status, "completed"); assert.equal(toggleTaskComplete(done).status, "planned"); });
test("move to tomorrow updates inbox tasks", () => { const moved = moveToTomorrow({ ...task, status: "inbox" }, new Date("2026-09-03T22:00:00Z")); assert.equal(moved.dueDate, "2026-09-04"); assert.equal(moved.status, "planned"); });
test("daily wins allow no more than three unique tasks", () => { assert.deepEqual(orderDailyPriorities(["a", "b"]), [{ taskId: "a", position: 1 }, { taskId: "b", position: 2 }]); assert.throws(() => orderDailyPriorities(["a", "b", "c", "d"])); assert.throws(() => orderDailyPriorities(["a", "a"])); });

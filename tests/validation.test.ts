import test from "node:test";
import assert from "node:assert/strict";
import { captureInputSchema, taskInputSchema } from "../src/lib/validation";

test("task validation rejects blank and oversized task input", () => { assert.equal(taskInputSchema.safeParse({ title: " " }).success, false); assert.equal(taskInputSchema.safeParse({ title: "A".repeat(241) }).success, false); });
test("task validation accepts safe defaults", () => { const result = taskInputSchema.parse({ title: "Send invoice" }); assert.equal(result.status, "inbox"); assert.equal(result.priority, "none"); });
test("capture type is constrained", () => { assert.equal(captureInputSchema.safeParse({ text: "Remember this", type: "unknown" }).success, false); });

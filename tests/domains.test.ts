import test from "node:test";
import assert from "node:assert/strict";
import { domainConfig, domainKeys, parseDomainInput } from "../src/lib/domains";

test("every persisted domain has a table and validating schema", () => {
  for (const domain of domainKeys) {
    assert.ok(domainConfig[domain].table);
    assert.ok(domainConfig[domain].schema);
  }
});
test("task relationships require UUIDs and progress is bounded", () => {
  assert.equal(parseDomainInput("tasks", { title: "Ship", project_id: "another-user" }).success, false);
  assert.equal(parseDomainInput("projects", { name: "Launch", progress: 101 }).success, false);
});
test("partial updates cannot make an invalid status valid", () => {
  assert.equal(parseDomainInput("tasks", { status: "made_up" }, true).success, false);
  assert.equal(parseDomainInput("tasks", { status: "completed" }, true).success, true);
});
test("optional daily win positions preserve blank and bounded values", () => {
  const omitted = parseDomainInput("tasks", { title: "Ship" });
  assert.equal(omitted.success, true);
  if (omitted.success) assert.equal(Object.hasOwn(omitted.data as object, "daily_position"), false);

  for (const empty of ["", null]) {
    const result = parseDomainInput("tasks", { title: "Ship", daily_position: empty });
    assert.equal(result.success, true);
    if (result.success) assert.equal((result.data as Record<string, unknown>).daily_position, null);
  }

  for (const position of ["1", "3"]) {
    const result = parseDomainInput("tasks", { title: "Ship", daily_position: position });
    assert.equal(result.success, true);
    if (result.success) assert.equal((result.data as Record<string, unknown>).daily_position, Number(position));
  }

  for (const position of [0, -1, 4]) {
    assert.equal(parseDomainInput("tasks", { title: "Ship", daily_position: position }).success, false);
  }
});
test("blank optional task estimates do not coerce to zero", () => {
  const result = parseDomainInput("tasks", { title: "Ship", estimated_minutes: "" });
  assert.equal(result.success, true);
  if (result.success) assert.equal((result.data as Record<string, unknown>).estimated_minutes, null);
  assert.equal(parseDomainInput("tasks", { title: "Ship", estimated_minutes: 0 }).success, false);
});

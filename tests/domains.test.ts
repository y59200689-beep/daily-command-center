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

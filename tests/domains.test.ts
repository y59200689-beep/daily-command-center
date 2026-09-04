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

test("notes accept title-only and normalized nullable optional fields", () => {
  const titleOnly = parseDomainInput("notes", { title: "Meeting context" });
  assert.equal(titleOnly.success, true);
  if (titleOnly.success) {
    assert.equal((titleOnly.data as Record<string, unknown>).content, "");
    assert.equal((titleOnly.data as Record<string, unknown>).category, "note");
  }

  const nullContent = parseDomainInput("notes", { title: "Meeting context", content: null });
  assert.equal(nullContent.success, true);
  if (nullContent.success) assert.equal((nullContent.data as Record<string, unknown>).content, "");

  for (const category of [null, ""]) {
    const result = parseDomainInput("notes", { title: "Meeting context", category });
    assert.equal(result.success, true);
    if (result.success) assert.equal((result.data as Record<string, unknown>).category, "note");
  }

  for (const relation of ["project_id", "client_id"] as const) {
    const result = parseDomainInput("notes", { title: "Meeting context", [relation]: null });
    assert.equal(result.success, true);
    if (result.success) assert.equal((result.data as Record<string, unknown>)[relation], null);
  }

  assert.equal(parseDomainInput("notes", { title: "Meeting context", project_id: "not-a-uuid" }).success, false);
  assert.equal(parseDomainInput("notes", { title: "Meeting context", client_id: "not-a-uuid" }).success, false);

  const cleared = parseDomainInput("notes", { category: null, project_id: null, client_id: null }, true);
  assert.equal(cleared.success, true);
  if (cleared.success) {
    assert.equal((cleared.data as Record<string, unknown>).category, "note");
    assert.equal((cleared.data as Record<string, unknown>).project_id, null);
    assert.equal((cleared.data as Record<string, unknown>).client_id, null);
  }
});

test("fitness accepts nullable optional values without coercing numeric blanks to zero", () => {
  const required = { activity_type: "Running", date: "2026-09-04" };
  const requiredOnly = parseDomainInput("fitness", required);
  assert.equal(requiredOnly.success, true);
  if (requiredOnly.success) assert.equal((requiredOnly.data as Record<string, unknown>).source, "manual");

  for (const source of [null, ""]) {
    const result = parseDomainInput("fitness", { ...required, source });
    assert.equal(result.success, true);
    if (result.success) assert.equal((result.data as Record<string, unknown>).source, "manual");
  }

  for (const input of [
    { notes: null },
    { notes: "" },
    { distance_km: "" },
    { distance_km: null },
    { calories: "" },
    { calories: null },
    { effort: "" },
    { effort: null },
    { external_id: null },
  ]) {
    const result = parseDomainInput("fitness", { ...required, ...input });
    assert.equal(result.success, true);
  }

  const blankNumbers = parseDomainInput("fitness", { ...required, distance_km: "", calories: "" });
  assert.equal(blankNumbers.success, true);
  if (blankNumbers.success) {
    assert.equal((blankNumbers.data as Record<string, unknown>).distance_km, null);
    assert.equal((blankNumbers.data as Record<string, unknown>).calories, null);
  }

  const distance = parseDomainInput("fitness", { ...required, distance_km: "5.5" });
  assert.equal(distance.success, true);
  if (distance.success) assert.equal((distance.data as Record<string, unknown>).distance_km, 5.5);
  assert.equal(parseDomainInput("fitness", { ...required, distance_km: -1 }).success, false);
  assert.equal(parseDomainInput("fitness", { ...required, calories: -1 }).success, false);
  assert.equal(parseDomainInput("fitness", { ...required, duration_minutes: 0 }).success, false);

  const cleared = parseDomainInput("fitness", { source: null, notes: null, distance_km: "", calories: "" }, true);
  assert.equal(cleared.success, true);
  if (cleared.success) {
    assert.equal((cleared.data as Record<string, unknown>).source, "manual");
    assert.equal((cleared.data as Record<string, unknown>).notes, null);
    assert.equal((cleared.data as Record<string, unknown>).distance_km, null);
    assert.equal((cleared.data as Record<string, unknown>).calories, null);
    assert.equal(Object.hasOwn(cleared.data as object, "activity_type"), false);
  }
});

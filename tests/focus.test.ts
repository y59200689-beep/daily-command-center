import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveFocusProject } from "../src/lib/focus";
import { parseDomainInput } from "../src/lib/domains";

function client(records: Record<string, { id: string; user_id: string; project_id?: string }[]>) {
  return { from(table: string) {
    const filters: Record<string, unknown> = {};
    const query = {
      select() { return query; },
      eq(key: string, value: unknown) { filters[key] = value; return query; },
      is() { return query; },
      async maybeSingle() { return { data: records[table]?.find(row => Object.entries(filters).every(([key, value]) => row[key as keyof typeof row] === value)) ?? null, error: null }; },
    };
    return query;
  } } as unknown as SupabaseClient;
}
const owner = "owner";
test("task focus derives its project and rejects an unrelated project", async () => {
  const db = client({ tasks: [{ id: "task", user_id: owner, project_id: "project" }], projects: [{ id: "project", user_id: owner }] });
  assert.equal(await resolveFocusProject(db, owner, { taskId: "task" }), "project");
  await assert.rejects(resolveFocusProject(db, owner, { taskId: "task", projectId: "other" }), /selected project/);
});
test("project-only focus requires an owned project", async () => {
  const db = client({ projects: [{ id: "project", user_id: owner }, { id: "private", user_id: "other" }] });
  assert.equal(await resolveFocusProject(db, owner, { projectId: "project" }), "project");
  await assert.rejects(resolveFocusProject(db, owner, { projectId: "private" }), /not found/);
});
test("standalone tasks remain unlinked and another owner's task cannot be selected", async () => {
  const db = client({ tasks: [{ id: "task", user_id: owner }, { id: "private", user_id: "other" }] });
  assert.equal(await resolveFocusProject(db, owner, { taskId: "task" }), null);
  await assert.rejects(resolveFocusProject(db, owner, { taskId: "private" }), /not found/);
});
test("subtask creation preserves the parent association through the entity schema", () => {
  const parent = "476ef1cd-ec1e-465c-a058-7ad96824d626";
  const parsed = parseDomainInput("tasks", { title: "Next step", parent_task_id: parent });
  assert.ok(parsed.success);
  assert.equal((parsed.data as Record<string, unknown>).parent_task_id, parent);
  assert.equal(parseDomainInput("tasks", { title: "Next step", parent_task_id: "invalid" }).success, false);
});

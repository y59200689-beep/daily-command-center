import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { announceWorkspaceMutation, subscribeToWorkspaceMutations } from "../src/lib/workspace-mutations";

test("workspace mutation subscribers refresh only for their owned domains", () => {
  let refreshes = 0;
  const unsubscribe = subscribeToWorkspaceMutations(["content"], () => { refreshes += 1; });
  announceWorkspaceMutation("notes");
  announceWorkspaceMutation("content");
  unsubscribe();
  announceWorkspaceMutation("content");
  assert.equal(refreshes, 1);
});

test("content refetches and fitness replaces saved records after CRUD mutations", () => {
  const contentSource = readFileSync(path.join(process.cwd(), "src/features/v2/content-command-center.tsx"), "utf8");
  const fitnessSource = readFileSync(path.join(process.cwd(), "src/features/v2/fitness-dashboard.tsx"), "utf8");
  const domainSource = readFileSync(path.join(process.cwd(), "src/features/domains/domain-page.tsx"), "utf8");

  assert.match(contentSource, /<DomainPage domain="content" embedded onMutationSuccess=\{load\}/);
  assert.match(fitnessSource, /setTargets\(old=>editing\?old\.map/);
  assert.match(fitnessSource, /setActivities\(old=>editing\?old\.map/);
  assert.match(fitnessSource, /if\(!preview\)announceWorkspaceMutation/);
  assert.match(domainSource, /await onMutationSuccess\?\.\(\);/);
});

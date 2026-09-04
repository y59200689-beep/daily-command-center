import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { signOutCurrentSession } from "../src/lib/auth";

test("logout clears only the current Supabase session", async () => {
  let receivedScope = "";
  await signOutCurrentSession({ auth: { signOut: async ({ scope }) => {
    receivedScope = scope;
    return { error: null };
  } } });
  assert.equal(receivedScope, "local");
});

test("logout surfaces Supabase failures", async () => {
  const failure = new Error("Auth service unavailable");
  await assert.rejects(
    signOutCurrentSession({ auth: { signOut: async () => ({ error: failure }) } }),
    failure,
  );
});

test("the shell redirects, refreshes, and exposes account actions", () => {
  const shell = readFileSync(path.join(process.cwd(), "src/components/app-shell.tsx"), "utf8");
  assert.match(shell, /router\.replace\("\/login"\)/);
  assert.match(shell, /router\.refresh\(\)/);
  assert.match(shell, /aria-expanded=\{accountOpen\}/);
  assert.match(shell, />Settings</);
  assert.match(shell, /Signing out…/);
  assert.match(shell, /"Sign out"/);
});

test("the proxy continues to protect workspace routes", () => {
  const proxy = readFileSync(path.join(process.cwd(), "src/proxy.ts"), "utf8");
  assert.match(proxy, /supabase\.auth\.getClaims\(\)/);
  assert.match(proxy, /if \(!data\?\.claims && !publicPath\)/);
  assert.match(proxy, /url\.pathname = "\/login"/);
});

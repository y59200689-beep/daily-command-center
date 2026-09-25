import test from "node:test";
import assert from "node:assert/strict";
import { assertLocalDatabaseUrl, assertLocalSupabaseUrl, getLocalSupabase, parseStatusEnv } from "../scripts/e2e/local-supabase.mjs";

test("local Supabase status parser handles CLI env output without evaluating shell text", () => {
  const parsed = parseStatusEnv('API_URL="http://127.0.0.1:54321"\nANON_KEY="local-public"\nSERVICE_ROLE_KEY="local-secret"');
  assert.equal(parsed.API_URL, "http://127.0.0.1:54321");
  assert.equal(parsed.ANON_KEY, "local-public");
  assert.equal(parsed.SERVICE_ROLE_KEY, "local-secret");
  assert.equal(parseStatusEnv('API_URL=$(touch /tmp/should-not-run)').API_URL, "$(touch /tmp/should-not-run)");
});

test("E2E Supabase target guard allows only the local API port", () => {
  assert.equal(assertLocalSupabaseUrl("http://127.0.0.1:54321"), "http://127.0.0.1:54321");
  assert.equal(assertLocalSupabaseUrl("http://localhost:54321"), "http://localhost:54321");
  for (const target of ["https://project.supabase.co", "http://10.0.0.5:54321", "http://127.0.0.1:54322", "http://127.0.0.1:54321?next=https://evil.example"]) {
    assert.throws(() => assertLocalSupabaseUrl(target), /Refusing E2E authentication/);
  }
});

test("local database guard rejects linked and nonstandard database endpoints", () => {
  assert.equal(assertLocalDatabaseUrl("postgresql://postgres:local@127.0.0.1:54322/postgres").port, "54322");
  for (const target of ["postgres://u:p@db.project.supabase.co:5432/postgres", "postgresql://postgres@127.0.0.1:5432/postgres"]) {
    assert.throws(() => assertLocalDatabaseUrl(target), /Refusing E2E database access/);
  }
});

test("local E2E bootstrap requires explicit test mode and refuses production runtime", () => {
  const original = Object.fromEntries(["NODE_ENV", "FOUNDER_E2E_LOCAL", "VERCEL", "VERCEL_ENV", "NEXT_PHASE"].map(key => [key, process.env[key]]));
  try {
    Reflect.set(process.env, "NODE_ENV", "test");
    Reflect.deleteProperty(process.env, "FOUNDER_E2E_LOCAL");
    assert.throws(() => getLocalSupabase(), /explicit local E2E scripts/);
    Reflect.set(process.env, "FOUNDER_E2E_LOCAL", "1");
    Reflect.set(process.env, "VERCEL", "1");
    assert.throws(() => getLocalSupabase(), /production build\/deployment/);
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) Reflect.deleteProperty(process.env, key);
      else Reflect.set(process.env, key, value);
    }
  }
});

import { assertRemoteTarget } from "../scripts/e2e/target.mjs";
const project = "abcdefghijklmnopqrst";
const remoteEnv = {
  E2E_TARGET: "remote-test", E2E_REMOTE_ALLOW: "1", NODE_ENV: "test",
  E2E_REMOTE_PROJECT_ID: project, E2E_REMOTE_URL: `https://${project}.supabase.co`,
  E2E_REMOTE_PUBLIC_KEY: "sb_publishable_test", E2E_REMOTE_SERVICE_KEY: "sb_secret_test",
};
test("remote E2E requires every explicit guard and matching linked identity", () => {
  assert.equal(assertRemoteTarget(remoteEnv, project).projectId, project);
  for (const key of Object.keys(remoteEnv)) {
    assert.throws(() => assertRemoteTarget({ ...remoteEnv, [key]: undefined }, project), /REMOTE E2E REFUSED/);
  }
  assert.throws(() => assertRemoteTarget(remoteEnv, "zzzzzzzzzzzzzzzzzzzz"), /allowlist/);
  for (const overrides of [
    { E2E_TARGET: "local" }, { VERCEL: "1" }, { NEXT_PUBLIC_SUPABASE_URL: "https://wrong.supabase.co" },
    { E2E_REMOTE_URL: `${remoteEnv.E2E_REMOTE_URL}/` }, { E2E_REMOTE_SERVICE_KEY: remoteEnv.E2E_REMOTE_PUBLIC_KEY },
  ]) assert.throws(() => assertRemoteTarget({ ...remoteEnv, ...overrides }, project), /REMOTE E2E REFUSED/);
});
test("remote E2E rejects swapped JWT roles and foreign project credentials", () => {
  const jwt = (role: string, ref: string) => `eyJ.${Buffer.from(JSON.stringify({ role, ref })).toString("base64url")}.signature`;
  const env = { ...remoteEnv, E2E_REMOTE_PUBLIC_KEY: jwt("anon", project), E2E_REMOTE_SERVICE_KEY: jwt("service_role", project) };
  assert.equal(assertRemoteTarget(env, project).projectId, project);
  assert.throws(() => assertRemoteTarget({ ...env, E2E_REMOTE_PUBLIC_KEY: jwt("service_role", project) }, project), /REFUSED/);
  assert.throws(() => assertRemoteTarget({ ...env, E2E_REMOTE_SERVICE_KEY: jwt("service_role", "wrong") }, project), /mismatch/);
});

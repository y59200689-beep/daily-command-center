import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(new URL("../supabase/migrations/20260903190000_v2_intelligence.sql", import.meta.url), "utf8");

test("V2 persisted tables enable RLS and grant authenticated Data API access", () => {
  assert.match(migration, /enable row level security/);
  assert.match(migration, /to authenticated using \(user_id=\(select auth\.uid\(\)\)\)/);
  assert.match(migration, /grant select,insert,update,delete on table %I to authenticated/);
});

test("sensitive mutations are authenticated database functions", () => {
  assert.match(migration, /record_invoice_payment[\s\S]+security definer[\s\S]+auth\.uid\(\)/);
  assert.match(migration, /supersede_decision[\s\S]+for update/);
  assert.match(migration, /revoke all on function record_invoice_payment[\s\S]+from public,anon/);
  assert.match(migration, /revoke insert,update,delete on table payments from authenticated/);
});

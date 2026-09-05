import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(new URL("../supabase/migrations/20260905104602_v3_intelligence.sql", import.meta.url), "utf8");

test("V3 tables use additive owner-scoped RLS and indexes", () => {
  for (const table of ["memory_items", "insight_feedback", "daily_recommendations", "weekly_reviews", "risk_snapshots", "pattern_snapshots"]) assert.match(migration, new RegExp(`create table ${table}`));
  assert.match(migration, /enable row level security/);
  assert.match(migration, /using \(user_id=\(select auth\.uid\(\)\)\)/);
  assert.match(migration, /memory_items_owner_type_idx/);
});

test("memory sources are owner-validated in Postgres", () => {
  assert.match(migration, /validate_memory_source/);
  assert.match(migration, /user_id=new\.user_id and deleted_at is null/);
  assert.match(migration, /Memory source must be an owned active record/);
});

test("accepted plans atomically validate owned tasks and replace daily wins", () => {
  assert.match(migration, /accept_daily_plan[\s\S]+tasks\.user_id=auth\.uid\(\)[\s\S]+delete from daily_priorities[\s\S]+insert into daily_priorities/);
  assert.match(migration, /cardinality\(priority_task_ids\)[\s\S]+> 3/);
  assert.match(migration, /grant execute on function accept_daily_plan/);
});

test("V3 search keeps explicit derived-table aliases and source results ahead of intelligence", () => {
  assert.match(migration, /as results\(entity_type,entity_id,title,snippet,rank,updated_at\)/);
  assert.match(migration, /order by results\.rank desc,results\.updated_at desc/);
  assert.match(migration, /from search_workspace_sources/);
});

import { spawnSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { getE2ETarget } from "./target.mjs";

export function queryMetadata(sql) {
  const target = getE2ETarget();
  const result = spawnSync("supabase", ["db", "query", ...(target.target === "local" ? ["--local"] : ["--linked", "--project-ref", target.projectId]), sql, "-o", "json"], {
    encoding: "utf8", env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: "1" }, maxBuffer: 8 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error("E2E metadata/cleanup database access unavailable; no fallback permitted");
  return result.stdout;
}

export function snapshotRegistry(identity = JSON.parse(readFileSync(".playwright-auth/user-meta.json", "utf8"))) {
  if (!/^[0-9a-f-]{36}$/.test(identity.userId) || identity.projectId !== getE2ETarget().projectId) throw new Error("Invalid registry identity");
  const output = queryMetadata(`select c.relname as table_name,
    xpath('/table/row/resource_id/text()', query_to_xml(
      format('select coalesce(to_jsonb(r)->>''id'',to_jsonb(r)::text) as resource_id from public.%I r where user_id = %L::uuid', c.relname, '${identity.userId}'),
      true, false, ''))::text[] as resource_ids
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    join pg_attribute a on a.attrelid=c.oid and a.attname='user_id' and not a.attisdropped
    where n.nspname='public' and c.relkind in ('r','p') order by c.relname`);
  appendFileSync(".playwright-auth/resources.jsonl", JSON.stringify({ userId: identity.userId, at: new Date().toISOString(), output }) + "\n", { mode: 0o600 });
}

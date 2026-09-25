import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { getE2ETarget } from "./target.mjs";
import { join } from "node:path";

export async function cleanupOwnedRows({ userId, email, runId, projectId = "local" }) {
  const target = getE2ETarget();
  if (projectId !== target.projectId) throw new Error("Cleanup registry project mismatch");
  const scope = target.target === "remote-test" ? "remote-tier1" : "local-tier1";
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !/^[0-9a-f-]{36}$/i.test(runId) || !/^tier1-e2e-[0-9a-f-]{36}@example\.com$/i.test(email)) {
    throw new Error("Refusing local cleanup: identity metadata does not match the generated E2E format.");
  }
  const sql = `DO $e2e_cleanup$
DECLARE
  target uuid := '${userId}';
  passes integer := 0;
  tbl record;
  remaining bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = target)
    AND NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = target
      AND email = '${email}'
      AND raw_user_meta_data ->> 'e2e_run_id' = '${runId}'
      AND raw_user_meta_data ->> 'e2e_scope' = '${scope}'
  ) THEN
    RAISE EXCEPTION 'E2E cleanup identity marker mismatch; no rows were removed';
  END IF;

  LOOP
    passes := passes + 1;
    FOR tbl IN
      SELECT n.nspname, c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'user_id' AND NOT a.attisdropped
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
      ORDER BY c.relname
    LOOP
      BEGIN
        EXECUTE format('DELETE FROM %I.%I WHERE user_id = $1', tbl.nspname, tbl.relname) USING target;
      EXCEPTION WHEN foreign_key_violation THEN
        -- A dependent owned row is later in the pass; retry in the next pass.
        NULL;
      END;
    END LOOP;

    remaining := 0;
    FOR tbl IN
      SELECT n.nspname, c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'user_id' AND NOT a.attisdropped
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
    LOOP
      EXECUTE format('SELECT count(*) FROM %I.%I WHERE user_id = $1', tbl.nspname, tbl.relname) INTO remaining USING target;
      IF remaining > 0 THEN EXIT; END IF;
    END LOOP;
    EXIT WHEN remaining = 0 OR passes >= 8;
  END LOOP;

  FOR tbl IN
    SELECT n.nspname, c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'user_id' AND NOT a.attisdropped
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('SELECT count(*) FROM %I.%I WHERE user_id = $1', tbl.nspname, tbl.relname) INTO remaining USING target;
    IF remaining > 0 THEN RAISE EXCEPTION 'E2E cleanup left rows in public.%', tbl.relname; END IF;
  END LOOP;
END
$e2e_cleanup$;`;
  const dir = await mkdtemp(join(tmpdir(), "tier1-e2e-cleanup-"));
  const path = join(dir, "cleanup.sql");
  try {
    await writeFile(path, sql, { mode: 0o600 });
    const result = spawnSync("supabase", ["db", "query", ...(target.target === "local" ? ["--local"] : ["--linked", "--project-ref", target.projectId]), "--file", path], {
      encoding: "utf8",
      env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: "1" },
      maxBuffer: 2 * 1024 * 1024,
    });
    if (result.status !== 0) throw new Error("Owned-row cleanup failed. The E2E identity metadata was retained for retry.");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

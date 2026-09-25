import { spawnSync } from "node:child_process";

export function parseStatusEnv(output) {
  /** @type {Record<string, string>} */
  const values = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)=(.*)\s*$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values[match[1]] = value;
  }
  return values;
}

export function assertLocalSupabaseUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("Local E2E requires a valid Supabase API URL."); }
  const allowedHost = ["127.0.0.1", "localhost", "::1"].includes(url.hostname);
  if (url.protocol !== "http:" || !allowedHost || url.port !== "54321" || url.username || url.password || url.search || url.hash) {
    throw new Error("Refusing E2E authentication: Supabase must be the local API at http://127.0.0.1:54321 (or localhost).");
  }
  return url.origin;
}

export function assertLocalDatabaseUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("Local E2E requires a valid Supabase database URL."); }
  const allowedHost = ["127.0.0.1", "localhost", "::1"].includes(url.hostname);
  if (!allowedHost || url.port !== "54322" || !["postgres:", "postgresql:"].includes(url.protocol) || url.search || url.hash) {
    throw new Error("Refusing E2E database access: expected the local PostgreSQL endpoint on port 54322.");
  }
  return url;
}

export function getLocalSupabase() {
  if (process.env.FOUNDER_E2E_LOCAL !== "1" || process.env.NODE_ENV !== "test") {
    throw new Error("Refusing to set up E2E auth: run through the explicit local E2E scripts with NODE_ENV=test.");
  }
  if (process.env.VERCEL === "1" || process.env.VERCEL_ENV === "production" || process.env.NEXT_PHASE === "phase-production-build") {
    throw new Error("Refusing E2E authentication from a production build/deployment environment.");
  }
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"]) {
    const configured = process.env[key];
    if (configured && !["127.0.0.1", "localhost", "::1"].includes(new URL(configured).hostname)) {
      throw new Error(`Refusing E2E because ${key} points outside loopback.`);
    }
  }
  const result = spawnSync("supabase", ["status", "-o", "env"], {
    encoding: "utf8",
    env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: "1" },
    maxBuffer: 2 * 1024 * 1024,
  });
  const values = parseStatusEnv(result.stdout ?? "");
  const apiUrl = values.API_URL ?? values.SUPABASE_URL;
  if (result.status !== 0 || !apiUrl) {
    throw new Error("Local Supabase is unavailable. Install/start Docker or Podman, run `supabase start`, then apply local migrations without seeds. No remote fallback is permitted.");
  }
  const url = assertLocalSupabaseUrl(apiUrl);
  const dbUrl = values.DB_URL;
  if (!dbUrl) throw new Error("Local Supabase did not report its database endpoint.");
  assertLocalDatabaseUrl(dbUrl);
  const anonKey = values.ANON_KEY || values.PUBLISHABLE_KEY;
  const serviceKey = values.SERVICE_ROLE_KEY || values.SECRET_KEY;
  if (!anonKey || !serviceKey || anonKey === serviceKey) throw new Error("Local Supabase did not provide distinct anon and service-role keys.");
  return { url, anonKey, serviceKey };
}

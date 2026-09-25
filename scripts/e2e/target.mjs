import { readFileSync } from "node:fs";
import { getLocalSupabase } from "./local-supabase.mjs";

export function assertRemoteTarget(env, linkedProject) {
  const refuse = reason => { throw new Error(`REMOTE E2E REFUSED: ${reason}`); };
  if (env.E2E_TARGET !== "remote-test" || env.E2E_REMOTE_ALLOW !== "1" || env.NODE_ENV !== "test") refuse("explicit remote-test target, E2E_REMOTE_ALLOW=1 and NODE_ENV=test required");
  if (env.VERCEL || env.VERCEL_ENV || env.NEXT_PHASE === "phase-production-build") refuse("deployment environment");
  const expected = env.E2E_REMOTE_PROJECT_ID;
  if (!expected || !/^[a-z]{20}$/.test(expected) || expected !== linkedProject) refuse("allowlist does not match linked project");
  const canonical = `https://${expected}.supabase.co`;
  if (env.E2E_REMOTE_URL !== canonical) refuse(`Expected project: ${expected}; URL must exactly match ${canonical}`);
  for (const key of ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]) {
    if (env[key] && env[key] !== canonical) refuse(`${key} is inconsistent with the allowlist`);
  }
  const anonKey = env.E2E_REMOTE_PUBLIC_KEY;
  const serviceKey = env.E2E_REMOTE_SERVICE_KEY;
  if (!anonKey || !serviceKey || anonKey === serviceKey) refuse("distinct public and admin/server credentials required");
  for (const [key, role] of [[anonKey, "anon"], [serviceKey, "service_role"]]) {
    if (key.startsWith("eyJ")) {
      let payload;
      try { payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()); } catch { refuse("malformed credential"); }
      if (payload.role !== role || payload.ref !== expected) refuse("credential role/project mismatch");
    } else if (!key.startsWith(role === "anon" ? "sb_publishable_" : "sb_secret_")) refuse("unsupported credential format");
  }
  return { target: "remote-test", projectId: expected, url: canonical, anonKey, serviceKey };
}

export function getE2ETarget() {
  const mode = process.env.E2E_TARGET ?? "local";
  if (mode === "local") return { ...getLocalSupabase(), target: "local", projectId: "local" };
  if (mode !== "remote-test") throw new Error("Unknown E2E_TARGET; expected local or remote-test");
  const linked = readFileSync("supabase/.temp/project-ref", "utf8").trim();
  console.log(`Remote E2E target: ${linked}; expected: ${process.env.E2E_REMOTE_PROJECT_ID ?? "<missing>"}`);
  return assertRemoteTarget(process.env, linked);
}

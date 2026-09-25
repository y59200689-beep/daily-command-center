// Build the browser bundle for loopback Supabase without exporting privileged credentials.
import { spawnSync } from "node:child_process";
import { getLocalSupabase } from "./local-supabase.mjs";
const target=getLocalSupabase();
const env={...process.env,NODE_ENV:"production",NEXT_PUBLIC_SUPABASE_URL:target.url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:target.anonKey,SUPABASE_URL:target.url,SUPABASE_SECRET_KEY:"",SUPABASE_SERVICE_ROLE_KEY:"",E2E_REMOTE_SERVICE_KEY:"",SUPABASE_ACCESS_TOKEN:""};
console.log(`Building for local Supabase: ${target.url}`);
const result=spawnSync("pnpm",["run","build"],{env,stdio:"inherit"});
process.exit(result.status??1);

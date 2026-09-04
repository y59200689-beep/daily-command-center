import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { encryptToken } from "@/lib/integrations/crypto";
import { requireUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url=new URL(request.url); const code=url.searchParams.get("code"); const state=url.searchParams.get("state"); const store=await cookies(); const expected=store.get("google_oauth_state")?.value; store.delete("google_oauth_state");
  if(!code||!state||!expected||state.length!==expected.length||!timingSafeEqual(Buffer.from(state),Buffer.from(expected))) return NextResponse.redirect(new URL("/settings/integrations?error=state",url.origin));
  try { const {supabase,userId}=await requireUser(); const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({code,client_id:process.env.GOOGLE_CLIENT_ID!,client_secret:process.env.GOOGLE_CLIENT_SECRET!,redirect_uri:process.env.GOOGLE_REDIRECT_URI!,grant_type:"authorization_code"})}); if(!response.ok) throw new Error("TOKEN_EXCHANGE_FAILED"); const token=await response.json(); await supabase.from("integrations").upsert({user_id:userId,provider:"google",account_identifier:null,status:"connected",access_token_encrypted:encryptToken(token.access_token),refresh_token_encrypted:token.refresh_token?encryptToken(token.refresh_token):null,expires_at:new Date(Date.now()+token.expires_in*1000).toISOString(),provider_metadata:{scope:token.scope},last_synced_at:null},{onConflict:"user_id,provider"}); return NextResponse.redirect(new URL("/settings/integrations?connected=google",url.origin)); } catch { return NextResponse.redirect(new URL("/settings/integrations?error=google",url.origin)); }
}

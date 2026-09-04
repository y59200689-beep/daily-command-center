import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try { await requireUser(); const clientId=process.env.GOOGLE_CLIENT_ID; const redirectUri=process.env.GOOGLE_REDIRECT_URI; if(!clientId||!redirectUri) return NextResponse.json({error:"Google OAuth credentials are not configured."},{status:503}); const state=randomBytes(32).toString("base64url"); const store=await cookies(); store.set("google_oauth_state",state,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:600}); const url=new URL("https://accounts.google.com/o/oauth2/v2/auth"); url.searchParams.set("client_id",clientId); url.searchParams.set("redirect_uri",redirectUri); url.searchParams.set("response_type","code"); url.searchParams.set("access_type","offline"); url.searchParams.set("prompt","consent"); url.searchParams.set("state",state); url.searchParams.set("scope",["openid","email","https://www.googleapis.com/auth/calendar.events","https://www.googleapis.com/auth/calendar.calendarlist.readonly"].join(" ")); return NextResponse.redirect(url); } catch { return NextResponse.redirect(new URL("/login",request.url)); }
}

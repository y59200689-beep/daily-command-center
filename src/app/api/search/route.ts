import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try { const { supabase } = await requireUser(); const query = new URL(request.url).searchParams.get("q")?.trim() ?? ""; if (query.length < 2) return NextResponse.json({ data: [] }); const { data, error } = await supabase.rpc("search_workspace", { search_query: query, result_limit: 30 }); if (error) throw error; return NextResponse.json({ data }); } catch (error) { return NextResponse.json({ error: error instanceof Error && error.message === "AUTH_REQUIRED" ? "Authentication required." : "Search is unavailable." }, { status: error instanceof Error && error.message === "AUTH_REQUIRED" ? 401 : 500 }); }
}

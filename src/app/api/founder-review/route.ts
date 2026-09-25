import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";
import { loadFounderReview } from "@/lib/founder-os/review-server";
import { timeCategories } from "@/lib/founder-os/review";
export async function GET(request: Request) {
  try { const period = z.enum(["week", "month", "quarter"]).parse(new URL(request.url).searchParams.get("period") ?? "week"); const { supabase, userId } = await requireUser(); return NextResponse.json(await loadFounderReview(supabase, userId, new Date().toISOString().slice(0, 10), period)); }
  catch (error) { return apiError(error, "Founder review could not be loaded."); }
}
export async function PATCH(request: Request) {
  try {
    const { id, category } = z.object({ id: z.uuid(), category: z.enum(timeCategories) }).strict().parse(await request.json());
    const { supabase, userId } = await requireUser();
    const { data, error } = await supabase.from("focus_sessions").update({ category }).eq("id", id).eq("user_id", userId).select("id").maybeSingle();
    if (error) throw error;
    return data ? NextResponse.json({ record: data }) : NextResponse.json({ error: "Focus session not found." }, { status: 404 });
  } catch (error) { return apiError(error, "Time category could not be saved."); }
}

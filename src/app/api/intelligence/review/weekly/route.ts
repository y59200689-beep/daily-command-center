import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { buildWeeklyReview } from "@/lib/intelligence/reviews";
import { getIntelligence } from "@/lib/intelligence/server";
import { requireUser } from "@/lib/supabase/server";

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();
    const { snapshot, overview } = await getIntelligence(supabase, userId);
    const review = buildWeeklyReview(snapshot, overview);
    const saved = await supabase.from("weekly_reviews").select("id,status,created_at,updated_at").eq("user_id", userId).eq("period_start", review.periodStart).maybeSingle();
    if (saved.error) throw saved.error;
    return NextResponse.json({ review, saved: saved.data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, "Weekly review could not be prepared.");
  }
}

export async function POST() {
  try {
    const { supabase, userId } = await requireUser();
    const { snapshot, overview } = await getIntelligence(supabase, userId);
    const review = buildWeeklyReview(snapshot, overview);
    const result = await supabase.from("weekly_reviews").upsert({ user_id: userId, period_start: review.periodStart, period_end: review.periodEnd, status: "accepted", summary: review } as never, { onConflict: "user_id,period_start" }).select("*").single();
    if (result.error) throw result.error;
    return NextResponse.json({ review: result.data }, { status: 201 });
  } catch (error) {
    return apiError(error, "Weekly review could not be saved.");
  }
}

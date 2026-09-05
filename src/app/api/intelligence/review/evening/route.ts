import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { buildEveningReview } from "@/lib/intelligence/reviews";
import { getIntelligence } from "@/lib/intelligence/server";
import { requireUser } from "@/lib/supabase/server";

const schema = z.object({ wentWell: z.string().trim().max(5000).nullable().optional(), needsAttention: z.string().trim().max(5000).nullable().optional(), capture: z.string().trim().max(10000).nullable().optional(), carryOverTaskIds: z.array(z.uuid()).max(25).default([]) }).strict();

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();
    const { snapshot } = await getIntelligence(supabase, userId);
    const review = buildEveningReview(snapshot);
    const saved = await supabase.from("daily_reviews").select("*").eq("user_id", userId).eq("review_date", snapshot.today).maybeSingle();
    if (saved.error) throw saved.error;
    return NextResponse.json({ review, saved: saved.data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, "Evening review could not be prepared.");
  }
}

export async function PUT(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const { supabase, userId } = await requireUser();
    const { snapshot } = await getIntelligence(supabase, userId);
    const allowed = new Set(snapshot.tasks.map((task) => task.id));
    if (input.carryOverTaskIds.some((id) => !allowed.has(id))) return NextResponse.json({ error: "One carry-over task is no longer available." }, { status: 409 });
    const metrics = buildEveningReview(snapshot);
    const result = await supabase.from("daily_reviews").upsert({ user_id: userId, review_date: snapshot.today, went_well: input.wentWell || null, needs_attention: input.needsAttention || null, capture: input.capture || null, carry_over_task_ids: input.carryOverTaskIds, metrics } as never, { onConflict: "user_id,review_date" }).select("*").single();
    if (result.error) throw result.error;
    return NextResponse.json({ review: result.data });
  } catch (error) {
    return apiError(error, "Evening review could not be saved.");
  }
}

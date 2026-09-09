import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";
import { z } from "zod";

const feedbackSchema = z.object({
  recommendation_id: z.string().min(1),
  recommendation_type: z.string().min(1),
  domain: z.string().min(1),
  entity_id: z.string().optional(),
  rating: z.enum(["helpful", "not_useful", "wrong"]),
  comment: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const body = await request.json();
    const parsed = feedbackSchema.parse(body);

    const { data, error } = await supabase
      .from("recommendation_feedback")
      .insert({
        user_id: userId,
        recommendation_id: parsed.recommendation_id,
        recommendation_type: parsed.recommendation_type,
        domain: parsed.domain,
        entity_id: parsed.entity_id || null,
        rating: parsed.rating,
        comment: parsed.comment || null,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return apiError(error, "Failed to record recommendation feedback.");
  }
}

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";
import { loadRetrospectives } from "@/lib/learning-server";
import { z } from "zod";

const createRetroSchema = z.object({
  title: z.string().trim().min(3).max(200),
  retro_type: z.enum(["project", "client", "incident", "campaign", "decision", "quarter", "custom"]),
  domain: z.string().trim().min(2).max(50),
  period: z.string().trim().optional(),
  entity_type: z.string().trim().optional(),
  entity_id: z.string().trim().optional(),
  expected_summary: z.string().trim().optional(),
  actual_summary: z.string().trim().optional(),
  items: z.array(z.object({
    category: z.enum(["went_well", "didnt_go_well", "surprise", "action_item", "lesson_candidate"]),
    content: z.string().trim().min(1),
  })).optional(),
});

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const { searchParams } = new URL(request.url);
    const retroType = searchParams.get("retro_type") || undefined;

    const retros = await loadRetrospectives(supabase, userId, retroType);
    return NextResponse.json(retros);
  } catch (error) {
    return apiError(error, "Failed to load retrospectives.");
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const body = await request.json();
    const parsed = createRetroSchema.parse(body);

    const { data: retro, error: retroError } = await supabase
      .from("retrospectives")
      .insert({
        user_id: userId,
        title: parsed.title,
        retro_type: parsed.retro_type,
        domain: parsed.domain,
        period: parsed.period || null,
        entity_type: parsed.entity_type || null,
        entity_id: parsed.entity_id || null,
        expected_summary: parsed.expected_summary || null,
        actual_summary: parsed.actual_summary || null,
        status: "draft",
      })
      .select()
      .single();

    if (retroError) throw retroError;

    if (parsed.items && parsed.items.length > 0) {
      const itemsToInsert = parsed.items.map((item, idx) => ({
        retrospective_id: retro.id,
        user_id: userId,
        category: item.category,
        content: item.content,
        order_index: idx,
      }));
      await supabase.from("retrospective_items").insert(itemsToInsert);
    }

    return NextResponse.json(retro, { status: 201 });
  } catch (error) {
    return apiError(error, "Failed to create retrospective.");
  }
}

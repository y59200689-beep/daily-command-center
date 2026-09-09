import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";
import { loadLessons } from "@/lib/learning-server";
import { validateLessonSafety, type MemoryScope } from "@/lib/learning";
import { z } from "zod";

const proposeLessonSchema = z.object({
  title: z.string().trim().min(3).max(200),
  statement: z.string().trim().min(5).max(1000),
  why_proposed: z.string().trim().min(5).max(500),
  domain: z.string().trim().min(2).max(50),
  scope: z.enum(["business", "personal"]).default("business"),
  suggested_use: z.string().trim().optional(),
  potential_consequences: z.string().trim().optional(),
});

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get("domain") || undefined;
    const status = searchParams.get("status") || undefined;
    const scope = (searchParams.get("scope") as MemoryScope) || "business";
    const confidence = searchParams.get("confidence") || undefined;

    const lessons = await loadLessons(supabase, userId, {
      domain,
      status,
      scope,
      confidence,
    });
    return NextResponse.json(lessons);
  } catch (error) {
    return apiError(error, "Failed to load lessons.");
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const body = await request.json();
    const parsed = proposeLessonSchema.parse(body);

    const safetyCheck = validateLessonSafety(`${parsed.title} ${parsed.statement}`);
    if (!safetyCheck.valid) {
      return NextResponse.json({ error: safetyCheck.reason }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("operating_lessons")
      .insert({
        user_id: userId,
        title: parsed.title,
        statement: parsed.statement,
        why_proposed: parsed.why_proposed,
        domain: parsed.domain,
        scope: parsed.scope,
        status: "proposed",
        confidence_state: "weak",
        suggested_use: parsed.suggested_use || null,
        potential_consequences: parsed.potential_consequences || null,
      })
      .select()
      .single();

    if (error) throw error;

    await supabase.from("lesson_reviews").insert({
      lesson_id: data.id,
      user_id: userId,
      action: "proposed",
      notes: "Proposed for review.",
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return apiError(error, "Failed to propose lesson.");
  }
}

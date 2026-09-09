import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";
import { loadLessonDetail } from "@/lib/learning-server";
import { validateLessonSafety } from "@/lib/learning";
import { z } from "zod";

const patchLessonSchema = z.object({
  action: z.enum(["edit", "accept", "reject", "supersede", "retire"]),
  title: z.string().trim().optional(),
  statement: z.string().trim().optional(),
  suggested_use: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  superseded_by: z.string().uuid().optional(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, userId } = await requireUser();
    const { id } = await context.params;

    const detail = await loadLessonDetail(supabase, userId, id);
    if (!detail.lesson) {
      return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    return apiError(error, "Failed to load lesson detail.");
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, userId } = await requireUser();
    const { id } = await context.params;
    const body = await request.json();
    const parsed = patchLessonSchema.parse(body);

    const now = new Date().toISOString();

    if (parsed.action === "edit") {
      const updates: Record<string, unknown> = { updated_at: now };
      if (parsed.title) updates.title = parsed.title;
      if (parsed.statement) {
        const safetyCheck = validateLessonSafety(parsed.statement);
        if (!safetyCheck.valid) {
          return NextResponse.json({ error: safetyCheck.reason }, { status: 400 });
        }
        updates.statement = parsed.statement;
      }
      if (parsed.suggested_use !== undefined) updates.suggested_use = parsed.suggested_use;

      const { data, error } = await supabase
        .from("operating_lessons")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) throw error;

      await supabase.from("lesson_reviews").insert({
        lesson_id: id,
        user_id: userId,
        action: "edited",
        notes: parsed.notes || "Lesson updated.",
      });

      return NextResponse.json(data);
    }

    if (parsed.action === "accept") {
      const nextReview = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("operating_lessons")
        .update({
          status: "accepted",
          last_reviewed_at: now,
          review_at: nextReview,
          updated_at: now,
        })
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) throw error;

      await supabase.from("lesson_reviews").insert({
        lesson_id: id,
        user_id: userId,
        action: "accepted",
        notes: parsed.notes || "Accepted into active operating memory.",
      });

      return NextResponse.json(data);
    }

    if (parsed.action === "reject") {
      const { data, error } = await supabase
        .from("operating_lessons")
        .update({
          status: "rejected",
          updated_at: now,
        })
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) throw error;

      await supabase.from("lesson_reviews").insert({
        lesson_id: id,
        user_id: userId,
        action: "rejected",
        notes: parsed.notes || "Rejected during review.",
      });

      return NextResponse.json(data);
    }

    if (parsed.action === "supersede") {
      if (!parsed.superseded_by) {
        return NextResponse.json({ error: "superseded_by is required." }, { status: 400 });
      }

      const { data, error } = await supabase
        .from("operating_lessons")
        .update({
          status: "superseded",
          superseded_by: parsed.superseded_by,
          updated_at: now,
        })
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) throw error;

      await supabase.from("memory_supersessions").insert({
        user_id: userId,
        old_lesson_id: id,
        new_lesson_id: parsed.superseded_by,
        reason: parsed.notes || "Superseded by newer lesson.",
      });

      return NextResponse.json(data);
    }

    if (parsed.action === "retire") {
      const { data, error } = await supabase
        .from("operating_lessons")
        .update({
          status: "retired",
          updated_at: now,
        })
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) throw error;

      await supabase.from("lesson_reviews").insert({
        lesson_id: id,
        user_id: userId,
        action: "retired",
        notes: parsed.notes || "Retired from active operating memory.",
      });

      return NextResponse.json(data);
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (error) {
    return apiError(error, "Failed to update lesson.");
  }
}

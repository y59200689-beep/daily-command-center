import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";

const bodySchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    energy: z.enum(["low", "normal", "high"]),
    focus: z.enum(["poor", "normal", "strong"]),
    stress_load: z.enum(["low", "normal", "high"]),
    cognitive_notes: z.string().max(2000).nullable().optional(),
  })
  .strict();

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "14"), 60);
    const { data, error } = await supabase
      .from("founder_daily_states")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return NextResponse.json({ entries: data ?? [] });
  } catch (error) {
    return apiError(error, "Daily state could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const body = bodySchema.parse(await request.json());
    const { data, error } = await supabase
      .from("founder_daily_states")
      .upsert(
        { user_id: userId, ...body },
        { onConflict: "user_id,date" }
      )
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ entry: data });
  } catch (error) {
    return apiError(error, "Daily state could not be saved.");
  }
}

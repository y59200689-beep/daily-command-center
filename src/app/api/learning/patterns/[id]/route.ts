import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";
import { loadPatternDetail } from "@/lib/learning-server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, userId } = await requireUser();
    const { id } = await context.params;

    const detail = await loadPatternDetail(supabase, userId, id);
    if (!detail.pattern) {
      return NextResponse.json({ error: "Pattern not found." }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    return apiError(error, "Failed to load pattern detail.");
  }
}

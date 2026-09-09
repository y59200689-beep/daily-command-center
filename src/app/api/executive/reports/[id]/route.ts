import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, userId } = await requireUser();
    const res = await supabase
      .from("executive_reports")
      .select("*")
      .eq("user_id", userId)
      .eq("id", id)
      .single();
    if (res.error) throw res.error;
    return NextResponse.json({ report: res.data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, "Executive report not found.");
  }
}

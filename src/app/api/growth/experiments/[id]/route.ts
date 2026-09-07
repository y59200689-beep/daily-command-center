import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(240).optional(),
  hypothesis: z.string().trim().min(1).max(2000).optional(),
  target_metric: z.string().trim().min(1).max(240).optional(),
  status: z.enum(["idea", "planned", "running", "completed", "cancelled"]).optional(),
  result: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  budget: z.coerce.number().finite().nonnegative().optional().nullable(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, userId } = await requireUser();

    const { data: experiment, error } = await supabase
      .from("growth_experiments")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!experiment) return NextResponse.json({ error: "Experiment not found." }, { status: 404 });

    return NextResponse.json({ experiment });
  } catch (error) {
    return apiError(error, "Experiment could not be loaded.");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const input = updateSchema.parse(await request.json());
    const { supabase, userId } = await requireUser();

    const { data, error } = await supabase
      .from("growth_experiments")
      .update(input)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ experiment: data });
  } catch (error) {
    return apiError(error, "Experiment update failed.");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, userId } = await requireUser();

    const { data, error } = await supabase
      .from("growth_experiments")
      .update({ status: "cancelled" })
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ experiment: data });
  } catch (error) {
    return apiError(error, "Experiment cancellation failed.");
  }
}
